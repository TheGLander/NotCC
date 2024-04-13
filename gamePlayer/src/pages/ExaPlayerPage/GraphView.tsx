import { GameState, KeyInputs, keyInputToChar } from "@notcc/logic"
import {
	ConnPtr,
	GraphModel,
	GraphMoveSequence,
	MovePtr,
	Node,
} from "./models/graph"
import { graphlib, layout } from "@dagrejs/dagre"
import { twJoin, twMerge } from "tailwind-merge"
import { twUnit } from "@/components/DumbLevelPlayer"
import { VNode } from "preact"
import { Timeline, formatTicks } from "./exaPlayer"
import { useCallback, useState } from "preact/hooks"
import { HTMLAttributes } from "preact/compat"

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
					class="fill-neutral-50 stroke-neutral-50"
				>
					<path d="M 0 0 L 10 5 L 0 10 z" />
				</marker>
				<marker
					id="arrow-route"
					viewBox="0 0 10 10"
					refX="11"
					refY="5"
					orient="auto"
					class="fill-theme-500 stroke-theme-500"
				>
					<path d="M 0 0 L 10 5 L 0 10 z" />
				</marker>
				<marker
					id="arrow-hl"
					viewBox="0 0 10 10"
					refX="8"
					refY="5"
					orient="auto"
					class="fill-theme-300 stroke-theme-300"
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
					const isRoute = props.model.constructedRoute.some(ptr =>
						conns.includes(ptr.m)
					)
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
								class={twJoin(
									"fill-none",
									isRoute ? "stroke-theme-600" : "stroke-neutral-300"
								)}
								markerEnd={`url(#arrow${isRoute ? "-route" : ""})`}
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
								`fill-${getNodeColor(props.model, node)}`
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
const twClasses = `from-zinc-500 to-zinc-500 bg-zinc-500 fill-zinc-500
from-theme-400 to-theme-400 bg-theme-400 fill-theme-400
from-cyan-400 to-cyan-400 bg-cyan-400 fill-cyan-400
from-theme-600 to-theme-600 bg-theme-600 fill-theme-600`
void twClasses

function getNodeColor(model: GraphModel, node: Node) {
	return node === model.rootNode
		? "zinc-500"
		: node.loose
		  ? "theme-400"
		  : node.level.gameState === GameState.WON
		    ? "cyan-400"
		    : "theme-600"
}

const MOVE_CURSOR_CLASS =
	"bg-theme-700 text-theme-200 whitespace-break-spaces rounded-sm font-mono"

export function MovesList(props: {
	offset: number
	composeOverlay: KeyInputs
	moves: string[]
}) {
	const { moves, offset, composeOverlay } = props
	const composeText = keyInputToChar(composeOverlay, false, true)
	let futureMoves: VNode
	if (offset === moves.length) {
		futureMoves = <span class={MOVE_CURSOR_CLASS}>{composeText} </span>
	} else if (!composeText) {
		futureMoves = (
			<>
				<span class={MOVE_CURSOR_CLASS}>{moves[offset]}</span>
				{moves.slice(offset + 1).join("")}
			</>
		)
	} else {
		const movesStr = moves
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
			{moves.slice(0, offset).join("")}
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
				<MovesList
					moves={seq.displayMoves}
					offset={offset}
					composeOverlay={props.inputs}
				/>
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

export function ConstructionNode(
	props: HTMLAttributes<HTMLDivElement> & { node: Node; model: GraphModel }
) {
	const nodeColor = getNodeColor(props.model, props.node)
	const leftColor =
		props.node.inNodes.length > 1
			? "var(--tw-gradient-from)"
			: "var(--tw-gradient-to)"
	const rightColor =
		props.node.outNodes.length > 1
			? "var(--tw-gradient-from)"
			: "var(--tw-gradient-to)"

	return (
		<div
			{...props}
			class={twMerge(
				twJoin(
					"absolute left-[-0.35rem] top-[-0.1rem] z-10 h-5 w-5 rounded-full",
					props.model.current === props.node && "border-theme-200 border-2",
					`from-theme-500 to-${nodeColor}`
				),
				props.class as string
			)}
			style={{
				...((props.style as {}) ?? {}),
				backgroundImage: `linear-gradient(to right, ${leftColor} 0%, ${leftColor} 50%, ${rightColor} 50%, ${rightColor} 100%)`,
			}}
		></div>
	)
}

export function GraphScrollBar(props: {
	model: GraphModel
	updateLevel: () => void
}) {
	const tickSum = props.model.constructedRoute.reduce(
		(acc, val) => acc + val.m.tickLen,
		0
	)
	const nodeEnts: [number, ConnPtr | null, VNode][] = []
	let seenTicks = 0
	let curTicks: number | null = null
	for (const ptr of props.model.constructedRoute) {
		if (
			ptr.n === props.model.current ||
			("m" in props.model.current && props.model.current.m === ptr.m)
		) {
			curTicks =
				seenTicks + ("o" in props.model.current ? props.model.current.o : 0)
		}
		nodeEnts.push([
			seenTicks + ptr.m.tickLen,
			ptr,
			<ConstructionNode
				model={props.model}
				node={ptr.n}
				class="-top-2.5"
				style={{ left: `calc(${(seenTicks / tickSum) * 100}% - 0.625rem)` }}
			/>,
		])
		seenTicks += ptr.m.tickLen
	}
	nodeEnts.push([
		Infinity,
		null,
		<ConstructionNode
			model={props.model}
			node={props.model.constructionLastNode()}
			style={{ left: "calc(100% - 0.625rem)" }}
			class="-top-2.5"
		/>,
	])
	if (curTicks === null) {
		curTicks = tickSum
	}
	const onScrub = (progress: number) => {
		const posIdx = Math.round(progress * tickSum)
		const ent = nodeEnts.find(ent => posIdx < ent[0])!
		let pos: MovePtr | Node
		const tickPos = ent[0] - (ent[1]?.m.tickLen ?? 0)
		if (ent[1] === null) {
			pos = props.model.constructionLastNode()
		} else if (tickPos === posIdx) {
			pos = ent[1].n
		} else {
			pos = { n: ent[1].n, m: ent[1].m, o: posIdx - tickPos }
		}
		props.model.goTo(pos)
		props.updateLevel()
	}
	return (
		<Timeline onScrub={onScrub}>
			{nodeEnts.map(nodeEnt => nodeEnt[2])}
			<div
				class={twJoin(
					"bg-theme-300 absolute -top-2.5 h-5 w-3 rounded-full",
					props.model.current instanceof Node && "hidden"
				)}
				style={{ left: `calc(${(curTicks / tickSum) * 100}% - 0.375rem)` }}
			/>
		</Timeline>
	)
}

function ConstrPart(
	props: GraphViewProps & {
		ptr: ConnPtr
		offset: number
		inFuture: boolean
		inPast: boolean
	}
) {
	const goToNode = useCallback(() => {
		props.model.goTo(props.ptr.n)
		props.updateLevel()
	}, [props.model, props.ptr, props.updateLevel])
	return (
		<>
			<span class="relative ml-2">
				<ConstructionNode
					onClick={goToNode}
					node={props.ptr.n}
					model={props.model}
				/>
				<span
					class={twJoin("relative z-20", props.inFuture && "text-zinc-400")}
				>
					<span
						class={twJoin("mr-2", props.inFuture && "text-zinc-300")}
						onClick={goToNode}
					>
						{props.ptr.m.displayMoves[0]}
					</span>
					{props.inPast || props.inFuture ? (
						props.ptr.m.displayMoves.slice(1)
					) : (
						<MovesList
							moves={props.ptr.m.displayMoves.slice(1)}
							offset={props.offset === 0 ? 0 : props.offset - 1}
							composeOverlay={props.inputs}
						/>
					)}
				</span>
			</span>
		</>
	)
}

function ConstructionView(props: GraphViewProps) {
	const constrParts: VNode[] = []
	const curNode =
		props.model.current instanceof Node
			? props.model.current
			: props.model.current.n
	let constrIdx = props.model.constructedRoute.findIndex(
		ptr => ptr.n === curNode
	)
	if (constrIdx === -1) {
		constrIdx = props.model.constructedRoute.length
	}
	let idx = 0
	for (const ptr of props.model.constructedRoute) {
		constrParts.push(
			<ConstrPart
				{...props}
				ptr={ptr}
				inFuture={idx > constrIdx}
				inPast={idx < constrIdx}
				offset={
					idx < constrIdx
						? ptr.m.tickLen
						: idx === constrIdx
						  ? !(props.model.current instanceof Node)
								? props.model.current.o
								: 0
						  : 0
				}
			/>
		)
		idx += 1
	}
	const lastNode = props.model.constructionLastNode()
	constrParts.push(
		<span class="relative ml-2">
			<ConstructionNode
				onClick={() => {
					props.model.goTo(lastNode)
					props.updateLevel()
				}}
				node={lastNode}
				model={props.model}
			/>
		</span>
	)
	return (
		<span class="relative font-mono [line-break:anywhere] [overflow-wrap:anywhere]">
			{constrParts}
		</span>
	)
}

export function GraphView(props: GraphViewProps) {
	const [view, setView] = useState<"construction" | "graph">("construction")
	return (
		<div class="flex h-full flex-col gap-2">
			<div>
				<select
					class="ml-auto block w-auto"
					onChange={ev => {
						setView(ev.currentTarget.value as "graph")
					}}
				>
					<option value="construction" defaultChecked>
						Construction
					</option>
					<option value="graph">Graph</option>
				</select>
			</div>
			{view === "construction" ? (
				<div class="bg-theme-950 h-full flex-1 overflow-auto rounded">
					<ConstructionView {...props} />
				</div>
			) : (
				<>
					<div class="bg-theme-950 relative h-full flex-1 overflow-auto scroll-smooth rounded">
						<SvgView {...props} />
					</div>
					<div class="bg-theme-950 relative h-32 rounded p-1">
						<Infobox {...props} />
					</div>
				</>
			)}
		</div>
	)
}
