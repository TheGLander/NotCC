import { GameState, KeyInputs, LevelState } from "@notcc/logic"
import { HashSettings, makeLevelHash } from "../hash"
import {
	MoveSeqenceInterval,
	MoveSequence,
	Snapshot,
	cloneLevel,
} from "./linear"

export class GraphMoveSequence extends MoveSequence {
	hashes: number[] = []
	snapshotOffset = 1
	constructor(public hashSettings: HashSettings) {
		super()
	}
	_add_tickLevel(input: KeyInputs, level: LevelState): void {
		super._add_tickLevel(input, level)
		this.hashes.push(makeLevelHash(level, this.hashSettings))
	}
	get lastHash() {
		return this.hashes[this.tickLen - 1]
	}
	trim(interval: MoveSeqenceInterval): void {
		super.trim(interval)
		this.hashes.splice(...interval)
	}
	merge(other: this): void {
		super.merge(other)
		this.hashes.push(...other.hashes)
	}
}

export class Node {
	level: LevelState
	hash: number
	hashSettings: HashSettings
	winDistance?: number
	winTargetNode?: Node
	winTargetSeq?: GraphMoveSequence
	rootDistance: number = 0
	rootTargetNode?: Node
	rootTargetSeq?: GraphMoveSequence
	constructor(node: Node)
	constructor(level: LevelState, hashSettings: HashSettings)
	constructor(level: LevelState | Node, hashSettings?: HashSettings) {
		if (level instanceof Node) {
			this.hash = level.hash
			this.level = level.level
			this.hashSettings = level.hashSettings
		} else {
			this.hashSettings = hashSettings!
			this.hash = makeLevelHash(level, hashSettings!)
			this.level = level
		}
	}
	inNodes: Node[] = []
	outConns: Map<Node, GraphMoveSequence[]> = new Map()
	get outNodes(): Node[] {
		const nodes: Node[] = []
		for (const [node, seqs] of Array.from(this.outConns.entries())) {
			for (const _ of seqs) {
				nodes.push(node)
			}
		}
		return nodes
	}
	get loose(): boolean {
		return (
			this.inNodes.length === 1 &&
			this.outConns.size === 0 &&
			this.level.gameState !== GameState.WON
		)
	}
	get dissolvable(): boolean {
		return this.inNodes.length === 1 && this.outNodes.length === 1
	}

	getWinSubtickOffset() {
		if (this.level.gameState !== GameState.WON) return 0
		return this.level.subtick - 1
	}
	newChild(inputs: GraphMoveSequence): Node {
		const child = new Node(this)
		child.inNodes.push(this)
		this.outConns.set(child, [inputs])
		child.hash = inputs.lastHash
		child.rootDistance = this.rootDistance + inputs.tickLen * 3
		child.rootTargetNode = this
		child.rootTargetSeq = inputs
		return child
	}
	findShortestParentConns(): ConnPtr[] {
		return Array.from(this.inNodes)
			.filter((node, i, arr) => arr.indexOf(node) === i)
			.map<ConnPtr>(node => {
				const connArr = node.outConns.get(this)!
				const shortestSeq = connArr.reduce(
					(acc, val) => (val.tickLen < acc.tickLen ? val : acc),
					connArr[0]
				)
				return { n: node, m: shortestSeq }
			})
	}
	findShortestChildConns(): ConnPtr[] {
		return Array.from(this.outConns).map<ConnPtr>(([node, seqs]) => {
			const shortestSeq = seqs.reduce(
				(acc, val) => (val.tickLen < acc.tickLen ? val : acc),
				seqs[0]
			)
			return { n: node, m: shortestSeq }
		})
	}
	cascadeWinDist() {
		if (this.winDistance === undefined) return
		const toCascade: Node[] = [this]
		while (toCascade.length > 0) {
			const node = toCascade.reduce(
				(acc, val) => (val.winDistance! < acc.winDistance! ? val : acc),
				toCascade[0]
			)
			toCascade.splice(toCascade.indexOf(node), 1)
			const conns = node.findShortestParentConns()
			for (const conn of conns) {
				const newDist =
					node.winDistance! + node.getWinSubtickOffset() + conn.m.tickLen * 3
				if (conn.n.winDistance !== undefined && newDist > conn.n.winDistance) {
					continue
				}
				conn.n.winDistance = newDist
				conn.n.winTargetNode = node
				conn.n.winTargetSeq = conn.m
				toCascade.push(conn.n)
			}
		}
	}
	cascadeRootDist() {
		const toCascade: Node[] = [this]
		while (toCascade.length > 0) {
			const node = toCascade.reduce(
				(acc, val) => (val.rootDistance! < acc.rootDistance! ? val : acc),
				toCascade[0]
			)
			toCascade.splice(toCascade.indexOf(node), 1)
			const conns = node.findShortestChildConns()
			for (const conn of conns) {
				const newDist =
					node.rootDistance + conn.m.tickLen * 3 + conn.n.getWinSubtickOffset()
				if (newDist > conn.n.rootDistance) {
					continue
				}
				conn.n.rootDistance = newDist
				conn.n.rootTargetNode = node
				conn.n.rootTargetSeq = conn.m
				toCascade.push(conn.n)
			}
		}
	}

	moveConnections(newNode: Node, oldNode: Node) {
		if (newNode === oldNode) return
		let newSeqs = this.outConns.get(newNode)
		if (!newSeqs) {
			newSeqs = []
			this.outConns.set(newNode, newSeqs)
		}
		const oldSeqs = this.outConns.get(oldNode)!
		newSeqs.push(...oldSeqs)
		this.outConns.delete(oldNode)
		for (const _ of oldSeqs) {
			oldNode.inNodes.splice(oldNode.inNodes.indexOf(this), 1)
			newNode.inNodes.push(this)
		}
		newNode.cascadeWinDist()
		this.cascadeRootDist()
	}
	findConnectedNode(seq: GraphMoveSequence): Node | undefined {
		return Array.from(this.outConns.entries()).find(([, seqs]) =>
			seqs.includes(seq)
		)?.[0]
	}
	removeConnection(seq: GraphMoveSequence): void {
		const [endNode, seqs] = Array.from(this.outConns.entries()).find(
			([, seqs]) => seqs.includes(seq)
		)!
		seqs.splice(seqs.indexOf(seq), 1)
		if (seqs.length === 0) {
			this.outConns.delete(endNode)
		}
		endNode.inNodes.splice(endNode.inNodes.indexOf(this), 1)
	}
	insertNodeOnSeq(
		seq: GraphMoveSequence,
		offset: number
	): { node: Node; seq1: GraphMoveSequence; seq2: GraphMoveSequence } {
		const [endNode] = Array.from(this.outConns.entries()).find(([, seqs]) =>
			seqs.includes(seq)
		)!
		this.removeConnection(seq)
		const seq2 = seq.clone()
		seq.trim([offset, seq.tickLen])
		seq2.trim([0, offset])
		const midHash = seq.lastHash
		let midNode: Node
		if (midHash === endNode.hash) {
			midNode = endNode
			const conns = this.outConns.get(endNode) ?? []
			conns.push(seq)
			this.outConns.set(endNode, conns)
			midNode.inNodes.push(this)
		} else {
			midNode = this.newChild(seq)
			midNode.level = cloneLevel(this.level)
			seq.applyToLevel(midNode.level)
		}
		midNode.outConns.set(endNode, [seq2])
		endNode.inNodes.push(midNode)
		endNode.cascadeWinDist()
		this.cascadeRootDist()
		return { node: midNode, seq1: seq, seq2 }
	}
	getLooseMoveSeq(): GraphMoveSequence {
		if (this.inNodes.length > 1) {
			throw new Error("Node has multiple move sequences")
		}
		return this.inNodes[0].outConns.get(this)![0]
	}
	dissolveNode(): void {
		if (!this.dissolvable) throw new Error("Can't dissolve undissolvable node")
		const parent: Node = this.inNodes[0]
		const child: Node | undefined = this.outNodes[0]
		const seq1 = parent.outConns.get(this)![0]
		const seq2 = this.outConns.get(child)?.[0]
		parent.outConns.delete(this)
		this.inNodes.pop()
		this.outConns.clear()
		child.inNodes.splice(child.inNodes.indexOf(this), 1)
		if (seq2) {
			const seqs = parent.outConns.get(child) ?? []
			parent.outConns.set(child, seqs)
			seq1.merge(seq2)
			seqs.push(seq1)
		}
	}
	getHashName(): string {
		return (this.hash >>> 0).toString(16)
	}
}

export interface ConnPtr {
	// `i`nput node
	n: Node
	// co`n`nection
	m: GraphMoveSequence
}

export interface MovePtr extends ConnPtr {
	// o`f`fset
	o: number
}

export class GraphModel {
	initialTimeLeft: number
	rootNode: Node
	current: MovePtr | Node
	nodeHashMap: Map<number, Node> = new Map()
	hashMap: Map<number, MovePtr> = new Map()
	constructor(
		public level: LevelState,
		public hashSettings: HashSettings
	) {
		this.initialTimeLeft = level.timeLeft
		level.timeLeft = 0
		this.rootNode = this.current = new Node(level, hashSettings)
		this.nodeHashMap.set(this.rootNode.hash, this.rootNode)
	}
	addInput(input: KeyInputs): void {
		let node: Node, moveSeq: GraphMoveSequence, parent: Node
		if (!(this.current instanceof Node)) {
			moveSeq = new GraphMoveSequence(this.hashSettings)
			moveSeq.add(input, this.level)
			const curMoveSeq = this.current.m.moves.slice(this.current.o)
			if (moveSeq.moves.every((move, i) => curMoveSeq[i] === move)) {
				if (this.current.o + moveSeq.tickLen === this.current.m.tickLen) {
					this.current = this.nodeHashMap.get(moveSeq.lastHash)!
					this.level = this.current.level
				} else {
					this.current.o += moveSeq.tickLen
				}
				return
			}
			const {
				node: parent2,
				seq1,
				seq2,
			} = this.current.n.insertNodeOnSeq(this.current.m, this.current.o)
			parent = parent2
			// Promote implied, mid-seq node to explicit
			this.hashMap.delete(parent.hash)
			this.nodeHashMap.set(parent.hash, parent)
			for (const hash of seq2.hashes) {
				const ent = this.hashMap.get(hash)
				if (!ent) continue
				ent.n = parent
				ent.m = seq2
				ent.o -= seq1.tickLen
			}
			node = parent.newChild(moveSeq)
			node.level = this.level
			this.current = node
		} else if (!this.current.loose || this.current === this.rootNode) {
			moveSeq = new GraphMoveSequence(this.hashSettings)
			this.level = cloneLevel(this.level)
			moveSeq.add(input, this.level)
			for (const [node, conns] of this.current.outConns) {
				for (const conn of conns) {
					if (moveSeq.moves.every((move, i) => move === conn.moves[i])) {
						if (conn.tickLen === moveSeq.tickLen) {
							this.current = node
							this.level = node.level
						} else {
							this.current = { n: this.current, m: conn, o: moveSeq.tickLen }
						}
						return
					}
				}
			}
			parent = this.current
			node = parent.newChild(moveSeq)
			node.level = this.level
			this.current = node
		} else {
			node = this.current
			parent = node.inNodes[0]
			moveSeq = node.getLooseMoveSeq()
			this.nodeHashMap.delete(node.hash)
			this.hashMap.set(node.hash, {
				n: parent,
				m: moveSeq,
				o: moveSeq.tickLen,
			})
			moveSeq.add(input, this.level)
			node.hash = moveSeq.lastHash
			node.rootDistance = parent.rootDistance + moveSeq.tickLen * 3
		}
		const newHash = moveSeq.lastHash
		const nodeMergee = this.nodeHashMap.get(newHash)
		const moveMergee = this.hashMap.get(newHash)
		if (nodeMergee) {
			parent.moveConnections(nodeMergee, node)
			this.current = nodeMergee
		} else if (moveMergee) {
			const {
				node: midNode,
				seq1,
				seq2,
			} = moveMergee.n.insertNodeOnSeq(moveMergee.m, moveMergee.o)
			this.nodeHashMap.set(midNode.hash, midNode)
			this.hashMap.delete(midNode.hash)
			parent.moveConnections(midNode, node)
			this.current = midNode

			for (const hash of seq2.hashes) {
				const ent = this.hashMap.get(hash)
				if (!ent) continue
				ent.n = midNode
				ent.m = seq2
				ent.o -= seq1.tickLen
			}
		} else {
			this.nodeHashMap.set(node.hash, node)
			if (node.level.gameState === GameState.WON) {
				node.winDistance = 0
				node.rootDistance += node.getWinSubtickOffset()
				node.cascadeWinDist()
			}
		}
	}
	undo(into?: GraphMoveSequence) {
		if (!(this.current instanceof Node)) {
			this.current.o = this.current.m.userMoves
				.slice(0, this.current.o)
				.lastIndexOf(true)
		} else {
			if (!into && this.current.inNodes.length === 1) {
				into = this.current.inNodes[0].outConns.get(this.current)![0]
			}
			if (!into) throw new Error(`into is required for multi-input nodes!`)
			const srcNode =
				this.current.inNodes.length === 1
					? this.current.inNodes[0]
					: this.current.inNodes
							.map(val => Array.from(val.outConns.entries()))
							.flat(1)
							.find(([, conns]) => conns.includes(into!))![0]
			this.current = {
				n: srcNode,
				m: into,
				o: into.userMoves.lastIndexOf(true),
			}
		}
		if (this.current.o === 0) {
			this.current = this.current.n
		}
		this.goTo(this.current)
	}
	redo(into?: GraphMoveSequence) {
		let lastO: number
		if (!(this.current instanceof Node)) {
			lastO = this.current.o
			this.current.o = this.current.m.userMoves.indexOf(
				true,
				this.current.o + 1
			)
		} else {
			lastO = 0
			if (!into && this.current.outNodes.length === 1) {
				into = Array.from(this.current.outConns.values())[0][0]
			}
			if (!into) throw new Error(`into is required for multi-out nodes!`)
			this.current = {
				n: this.current,
				m: into,
				o: into.userMoves.indexOf(true, 1),
			}
			if (this.current.o !== -1) {
				this.level = cloneLevel(this.level)
			}
		}
		if (this.current.o === -1) {
			this.current = this.current.n.findConnectedNode(this.current.m)!
			this.level = this.current.level
		} else {
			this.current.m.applyToLevel(this.level, [lastO, this.current.o])
		}
	}
	goTo(pos: MovePtr | Node): void {
		this.current = pos
		if (pos instanceof Node) {
			this.level = pos.level
			return
		}
		const closestSnapshot: Snapshot = pos.m.snapshots.find(
			snap => snap.tick < pos.o
		) ?? { level: pos.n.level, tick: 0 }
		this.level = cloneLevel(closestSnapshot.level)
		pos.m.applyToLevel(this.level, [closestSnapshot.tick, pos.o])
	}
	resetLevel() {
		this.goTo(this.rootNode)
	}
	buildReferences() {
		this.nodeHashMap.clear()
		this.hashMap.clear()
		this.rootNode.inNodes = []
		const nodesToVisit: Node[] = [this.rootNode]
		const visitedNodes = new WeakSet<Node>()
		while (nodesToVisit.length > 0) {
			const node = nodesToVisit.shift()!
			visitedNodes.add(node)
			this.nodeHashMap.set(node.hash, node)
			for (const [tNode, conns] of node.outConns.entries()) {
				if (!visitedNodes.has(tNode)) {
					nodesToVisit.push(tNode)
					tNode.inNodes = []
				}
				for (const conn of conns) {
					tNode.inNodes.push(node)
					let moveOffset = conn.userMoves.indexOf(true, 1)
					while (moveOffset !== -1) {
						this.hashMap.set(conn.hashes[moveOffset], {
							n: node,
							m: conn,
							o: moveOffset,
						})
						moveOffset = conn.userMoves.indexOf(true, moveOffset + 1)
					}
				}
			}
		}
	}
	findBackfeedConns(): ConnPtr[] {
		const nodesToVisit: [Node, Node[]][] = [[this.rootNode, []]]
		const visited: WeakSet<Node> = new WeakSet()
		visited.add(this.rootNode)
		const backConns: ConnPtr[] = []
		while (nodesToVisit.length > 0) {
			const [node, parents] = nodesToVisit.shift()!
			for (const [tNode, conns] of node.outConns.entries()) {
				if (parents.includes(tNode)) {
					for (const conn of conns) {
						backConns.push({ n: node, m: conn })
					}
				} else {
					if (!visited.has(tNode)) {
						nodesToVisit.push([tNode, parents.concat(node)])
						visited.add(tNode)
					}
				}
			}
		}
		return backConns
	}
}
