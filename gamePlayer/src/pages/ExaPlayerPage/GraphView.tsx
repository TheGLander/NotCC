import { KeyInputs } from "@notcc/logic"
import { GraphModel, GraphMoveSequence } from "./models/graph"
import { Node } from "./models/graph"
import { graphlib, layout } from "@dagrejs/dagre"
import { useEffect, useMemo, useRef, useState } from "preact/hooks"
import { twJoin } from "tailwind-merge"
import { twUnit } from "@/components/DumbLevelPlayer"
import { MoveSequence } from "./models/linear"

interface GraphViewProps {
	model: GraphModel
	inputs: KeyInputs
	updateLevel: () => void
}

function DebugGraphView(props: GraphViewProps) {
	return (
		<>
			{Array.from(props.model.nodeHashMap.values()).map(node => (
				<div
					onClick={() => {
						props.model.goTo(node)
						props.updateLevel()
					}}
				>
					{node === props.model.current && "> "}
					{node === props.model.rootNode ? "r" : node.loose ? "l" : "m "}{" "}
					{(node.hash >>> 0).toString(16)}: {node.outConns.size === 0 && "none"}
					{Array.from(node.outConns.entries())
						.map(
							([node, seqs]) =>
								` to ${(node.hash >>> 0).toString(16)}: ${seqs
									.map(seq => seq.displayMoves.join(""))
									.join()}`
						)
						.join(";")}
				</div>
			))}
		</>
	)
}

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
		// align: "DL",
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
			for (const conn of conns) {
				graph.setEdge(node.getHashName(), tNode.getHashName(), {
					conn,
				})
			}
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
			<g>
				{graph.edges().map(id => {
					const edge = graph.edge(id)
					const seq = edge.conn as GraphMoveSequence
					const strokePath = `M${edge.points[0].x + marginLeft},${
						edge.points[0].y + marginTop
					}L${edge.points
						.slice(1)
						.map(p => `${p.x + marginLeft},${p.y + marginTop}`)
						.join(",")}`
					const isCurrent =
						"m" in props.model.current && props.model.current.m === seq
					return (
						<>
							{isCurrent && (
								<path
									d={strokePath}
									strokeWidth={(EDGE_RADIUS + OUTLINE_WIDTH) * 2}
									class={twJoin("fill-none", "stroke-theme-300")}
									ref={ref => ref?.scrollIntoView()}
								/>
							)}
							<path
								d={strokePath}
								strokeWidth={EDGE_RADIUS * 2}
								class={twJoin("fill-none", "stroke-theme-50")}
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
								node === props.model.rootNode && "fill-zinc-500",
								!node.loose &&
									node !== props.model.rootNode &&
									"fill-theme-600",
								node.loose && "fill-theme-400"
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

export function GraphView(props: GraphViewProps) {
	return (
		<div class="flex h-full flex-col">
			<div class="bg-theme-950 relative h-full flex-1 overflow-auto scroll-smooth rounded">
				<SvgView {...props} />
			</div>
			<div>
				<button
					onClick={() => {
						props.model.undo()
						props.updateLevel()
					}}
				>
					Undo
				</button>
				<button
					onClick={() => {
						props.model.redo()
						props.updateLevel()
					}}
				>
					Redo
				</button>
			</div>
		</div>
	)
}
