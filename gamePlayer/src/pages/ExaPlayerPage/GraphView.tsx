import { GameState, KeyInputs, keyInputToChar } from "@notcc/logic"
import { ConnPtr, GraphModel, GraphMoveSequence, Node } from "./models/graph"
import { graphlib, layout } from "@dagrejs/dagre"
import { twJoin } from "tailwind-merge"
import { twUnit } from "@/components/DumbLevelPlayer"
import { MoveSequence } from "./models/linear"
import { VNode } from "preact"
import { formatTicks } from "./exaPlayer"

interface GraphViewProps {
	model: GraphModel
	inputs: KeyInputs
	updateLevel: () => void
}

// function DebugGraphView(props: GraphViewProps) {
// 	return (
// 		<>
// 			{Array.from(props.model.nodeHashMap.values()).map(node => (
// 				<div
// 					onClick={() => {
// 						props.model.goTo(node)
// 						props.updateLevel()
// 					}}
// 				>
// 					{node === props.model.current && "> "}
// 					{node === props.model.rootNode ? "r" : node.loose ? "l" : "m "}{" "}
// 					{(node.hash >>> 0).toString(16)}: {node.outConns.size === 0 && "none"}
// 					{Array.from(node.outConns.entries())
// 						.map(
// 							([node, seqs]) =>
// 								` to ${(node.hash >>> 0).toString(16)}: ${seqs
// 									.map(seq => seq.displayMoves.join(""))
// 									.join()}`
// 						)
// 						.join(";")}
// 				</div>
// 			))}
// 		</>
// 	)
// }

const EDGE_RADIUS = twUnit(0.75)
const NODE_RADIUS = twUnit(4)
const OUTLINE_WIDTH = twUnit(0.75)
const PADDING = twUnit(1) + OUTLINE_WIDTH

function makeGraph(model: GraphModel) {
	const graph = new graphlib.Graph()
	graph.setGraph({
		// nodesep: twUnit(8),
		// edgesep: twUnit(8),
		// ranksep: twUnit(16),
		// marginx: PADDING,
		// marginy: PADDING,
		ranker: "tight-tree",
	})
	for (const node of model.nodeHashMap.values()) {
		graph.setNode(node.getHashName(), {
			label: node.getHashName(),
			width: NODE_RADIUS,
			height: NODE_RADIUS,
		})
	}
	for (const node of model.nodeHashMap.values()) {
		for (const [tNode, conns] of node.outConns.entries()) {
			graph.setEdge(node.getHashName(), tNode.getHashName(), {
				node,
				conns,
			})
		}
	}
	return graph
}

function SvgView(props: GraphViewProps) {
	const graph = makeGraph(props.model)
	layout(graph)
	const minPos = [Infinity, Infinity]
	const maxPos = [-Infinity, -Infinity]
	for (const id of graph.nodes()) {
		const point = graph.node(id)
		if (point.x - NODE_RADIUS < minPos[0]) {
			minPos[0] = point.x - NODE_RADIUS
		}
		if (point.x + NODE_RADIUS > maxPos[0]) {
			maxPos[0] = point.x + NODE_RADIUS
		}
		if (point.y - NODE_RADIUS < minPos[1]) {
			minPos[1] = point.y - NODE_RADIUS
		}
		if (point.y + NODE_RADIUS > maxPos[1]) {
			maxPos[1] = point.y + NODE_RADIUS
		}
	}

	for (const id of graph.edges()) {
		const edge = graph.edge(id)
		for (const point of edge.points) {
			if (point.x - EDGE_RADIUS < minPos[0]) {
				minPos[0] = point.x - EDGE_RADIUS
			} else if (point.x + EDGE_RADIUS > maxPos[0]) {
				maxPos[0] = point.x + EDGE_RADIUS
			}
			if (point.y - EDGE_RADIUS < minPos[1]) {
				minPos[1] = point.y - EDGE_RADIUS
			} else if (point.y + EDGE_RADIUS > maxPos[1]) {
				maxPos[1] = point.y + EDGE_RADIUS
			}
		}
	}
	const marginLeft = -minPos[0] + PADDING
	const marginTop = -minPos[1] + PADDING
	const lGraph = graph.graph()
	const gWidth = Math.max(lGraph.width!, maxPos[0]) + marginLeft + PADDING
	const gHeight = Math.max(lGraph.height!, maxPos[1]) + marginTop + PADDING

	return (
		<svg
			width={gWidth}
			height={gHeight}
			viewBox={`0 0 ${gWidth} ${gHeight}`}
			class="absolute m-auto"
		>
			<defs>
				<marker
					id="arrow"
					viewBox="0 0 10 10"
					refX="11"
					refY="5"
					orient="auto"
					class={twJoin("fill-theme-50", "stroke-theme-50")}
				>
					<path d="M 0 0 L 10 5 L 0 10 z" />
				</marker>
				<marker
					id="arrow-hl"
					viewBox="0 0 10 10"
					refX="8"
					refY="5"
					orient="auto"
					class={twJoin("fill-theme-300", "stroke-theme-300")}
					markerWidth="2.5px"
				>
					<path d="M 0 0 L 10 5 L 0 10 z" />
				</marker>
			</defs>

			<g>
				{graph.edges().map(id => {
					const edge = graph.edge(id)
					// const node = edge.node as Node
					const conns = edge.conns as GraphMoveSequence[]
					const strokePath = `M${edge.points[0].x + marginLeft},${
						edge.points[0].y + marginTop
					}L${edge.points
						.slice(1)
						.map(p => `${p.x + marginLeft},${p.y + marginTop}`)
						.join(",")}`
					const isCurrent =
						"m" in props.model.current && conns.includes(props.model.current.m)
					return (
						<>
							{isCurrent && (
								<path
									d={strokePath}
									strokeWidth={(EDGE_RADIUS + OUTLINE_WIDTH) * 2}
									class={twJoin("fill-none", "stroke-theme-300")}
									ref={ref => ref?.scrollIntoView()}
									markerEnd="url(#arrow-hl)"
								/>
							)}
							<path
								d={strokePath}
								strokeWidth={EDGE_RADIUS * 2}
								strokeDasharray={conns.length > 1 ? "6 3" : undefined}
								class={twJoin("fill-none", "stroke-theme-50")}
								markerEnd="url(#arrow)"
							/>
						</>
					)
				})}
			</g>
			<g>
				{Array.from(props.model.nodeHashMap.values()).map(node => {
					const gNode = graph.node(node.getHashName())
					return (
						<circle
							class={twJoin(
								node === props.model.current && "stroke-theme-300",
								node === props.model.rootNode
									? "fill-zinc-500"
									: node.loose
									  ? "fill-theme-400"
									  : node.level.gameState === GameState.WON
									    ? "fill-cyan-400"
									    : "fill-theme-600"
							)}
							strokeWidth={OUTLINE_WIDTH}
							r={twUnit(4)}
							cx={gNode.x + marginLeft}
							cy={gNode.y + marginTop}
							onClick={() => {
								props.model.goTo(node)
								props.updateLevel()
							}}
							ref={ref => node === props.model.current && ref?.scrollIntoView()}
						/>
					)
				})}
			</g>
		</svg>
	)
}

const MOVE_CURSOR_CLASS =
	"bg-theme-700 text-theme-200 whitespace-break-spaces rounded-sm font-mono"

export function MovesList(props: {
	seq: MoveSequence
	offset: number
	composeOverlay: KeyInputs
}) {
	const { seq, offset, composeOverlay } = props
	const composeText = keyInputToChar(composeOverlay, false, true)
	let futureMoves: VNode
	if (offset === seq.tickLen) {
		futureMoves = <span class={MOVE_CURSOR_CLASS}>{composeText} </span>
	} else if (!composeText) {
		futureMoves = (
			<>
				<span class={MOVE_CURSOR_CLASS}>{seq.displayMoves[offset]}</span>
				{seq.displayMoves.slice(offset + 1).join("")}
			</>
		)
	} else {
		const movesStr = seq.displayMoves
			.slice(offset)
			.join("")
			.slice(composeText.length + 1)
		futureMoves = (
			<>
				<span class={MOVE_CURSOR_CLASS}>{composeText} </span>
				{movesStr}
			</>
		)
	}
	return (
		<span class="font-mono [line-break:anywhere] [overflow-wrap:anywhere]">
			{seq.displayMoves.slice(0, offset).join("")}
			<span class="text-zinc-400">{futureMoves}</span>
		</span>
	)
}

export function Infobox(props: GraphViewProps) {
	const model = props.model
	const composeText = keyInputToChar(props.inputs, false, true)
	if ("m" in model.current || model.current.loose) {
		let seq: GraphMoveSequence
		let offset: number
		if ("m" in model.current) {
			seq = model.current.m
			offset = model.current.o
		} else {
			seq = model.current.getLooseMoveSeq()
			offset = seq.tickLen
		}
		return (
			<>
				{"m" in model.current ? "Edge" : "Loose node"}
				<br />
				<MovesList seq={seq} offset={offset} composeOverlay={props.inputs} />
			</>
		)
	}
	return (
		<>
			{model.current === model.rootNode
				? "Root node"
				: model.current.level.gameState === GameState.WON
				  ? "Winning node"
				  : "Node"}
			<br />
			Dists: root {formatTicks(model.current.rootDistance)}s /{" "}
			{model.current.winDistance === undefined
				? "not won"
				: `win ${formatTicks(model.current.winDistance)}s`}
			<br />
			Edges:{" "}
			{Array.from(model.current.outConns.values())
				.flat()
				.map((seq, i) => (
					<>
						{i !== 0 && ", "}
						<span class="font-mono text-zinc-400">
							{seq.tickLen <= 16
								? seq.displayMoves.join("")
								: seq.displayMoves.slice(0, 16).join("") + "…"}
						</span>
					</>
				))}
			{composeText && (
				<>
					{model.current.outConns.size !== 0 && ", "}
					<span class={MOVE_CURSOR_CLASS}>{composeText}</span>
				</>
			)}
			{!composeText && model.current.outConns.size === 0 && "none"}
		</>
	)
}

export function GraphView(props: GraphViewProps) {
	return (
		<div class="flex h-full flex-col gap-2">
			<div class="bg-theme-950 relative h-full flex-1 overflow-auto scroll-smooth rounded">
				<SvgView {...props} />
			</div>
			<div class="bg-theme-950 relative h-32 rounded p-1">
				<Infobox {...props} />
			</div>
		</div>
	)
}
