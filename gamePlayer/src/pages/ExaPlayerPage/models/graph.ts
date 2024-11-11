import {
	GameState,
	KeyInputs,
	Level,
	PlayerSeat,
	charToKeyInput,
	HashSettings,
} from "@notcc/logic"
import { MoveSeqenceInterval, MoveSequence, Snapshot } from "./linear"
import { PriorityQueue } from "@/helpers"

// Welp. ExaCC graph mode. This is gonna be confusing.
// In this mode, all routes stem from the root node, with nodes being specific level states, and edges (referred here as connections) being sequences of moves connecting them.
// The model tries to minimize the number of nodes for readability and performance reasons, so not all level states are automatically made into nodes. More details in the actual model class

// Same as `MoveSequence`, but additionally tracks hashes for each player move
export class GraphMoveSequence extends MoveSequence {
	hashes: (number | null)[] = []
	snapshotOffset = 1
	constructor(public hashSettings: HashSettings) {
		super()
	}
	add(input: KeyInputs, level: Level, seat: PlayerSeat): number {
		const lastTickLen = this.tickLen
		const moveLength = super.add(input, level, seat)
		const nullsN = this.tickLen - lastTickLen - 1
		for (let i = 0; i < nullsN; i += 1) {
			this.hashes.push(null)
		}
		this.hashes.push(level.hash(this.hashSettings))
		return moveLength
	}
	get lastHash() {
		return this.hashes[this.tickLen - 1]!
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

// The Node class represents a single level state achievable from the root node by following a sequence of moves. It tracks its inputs, outputs, and distance to the closest win and root nodes
export class Node {
	level: Level
	// Ehh who cares about multiseat
	get playerSeat() {
		return this.level.playerSeats[0]
	}
	hash: number
	// XXX: Do we need to have this on every node?
	hashSettings: HashSettings
	// Distance to closest win node. Tracked by using incremental Dijkstra's
	winDistance?: number
	// XXX: Replace with `ConnPtr`?
	winTargetNode?: Node
	winTargetSeq?: GraphMoveSequence
	// Same as above, but for the closest root node
	rootDistance: number = 0
	rootTargetNode?: Node
	rootTargetSeq?: GraphMoveSequence
	constructor(node: Node)
	constructor(level: Level, hashSettings: HashSettings)
	constructor(level: Level | Node, hashSettings?: HashSettings) {
		if (level instanceof Node) {
			this.hash = level.hash
			this.level = level.level
			this.hashSettings = level.hashSettings
		} else {
			this.hashSettings = hashSettings!
			this.hash = level.hash(hashSettings!)
			this.level = level
		}
	}
	// If there are multiple moveSeqs from a single node to this one, that node appears here multiple times
	inNodes: Node[] = []
	// A node may be connected to another node with multiple move sequences at once, the shortes moveSeq is typically considered when checkign win/root dists and the like.
	outConns: Map<Node, GraphMoveSequence[]> = new Map()
	// Like with `inNodes`, if there are multiple sequences connecting two nodes, the connected child node appears multiple times here
	get outNodes(): Node[] {
		const nodes: Node[] = []
		for (const [node, seqs] of Array.from(this.outConns.entries())) {
			for (const _ of seqs) {
				nodes.push(node)
			}
		}
		return nodes
	}
	// A node is "loose" if it only has one parent and no children, meaning it was made by adding a new input onto a node.
	// This is important when adding new inputs onto this note, since then we can just append the new input onto the
	// sequence connecting this node and its parent, instead of making a new child node from this node and then dissolving this node.
	get loose(): boolean {
		return (
			this.inNodes.length === 1 &&
			this.outConns.size === 0 &&
			this.level.gameState !== GameState.WON
		)
	}
	// A node is dissolvable if it only has one in and one out node, in which case this node is redundant and should probably
	// be "dissolved" into the two sequences its in between, making one larger sequence instead with connects this node's parent directly to its grandchild
	get dissolvable(): boolean {
		return this.inNodes.length === 1 && this.outNodes.length === 1
	}

	// Uugh. Most of graph mode assumes we're always aligned to x:1 subticks on nodes and snapshots, but it's possible to win on any subtick,
	// so if we win on a non-:1 subtick, we must apply this offset to all distances from/to this node.
	getWinSubtickOffset() {
		if (this.level.gameState !== GameState.WON) return 0
		return this.level.currentSubtick - 1
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
		return (
			Array.from(this.inNodes)
				// Remove multiple copies of the parent node, which will happen if we have multiple connections
				.filter((node, i, arr) => arr.indexOf(node) === i)
				.map<ConnPtr>(node => {
					const connArr = node.outConns.get(this)!
					const shortestSeq = connArr.reduce(
						(acc, val) => (val.tickLen < acc.tickLen ? val : acc),
						connArr[0]
					)
					return { n: node, m: shortestSeq }
				})
		)
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
		const toCascade = new PriorityQueue<Node>()
		toCascade.push(this, -this.winDistance)
		while (toCascade.size > 0) {
			const node = toCascade.pop()!
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
				toCascade.push(conn.n, -newDist)
			}
		}
	}
	cascadeRootDist() {
		const toCascade = new PriorityQueue<Node>()
		toCascade.push(this, -this.rootDistance)
		while (toCascade.size > 0) {
			const node = toCascade.pop()!
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
				toCascade.push(conn.n, -newDist)
			}
		}
	}

	// Moves all connections from this node to `oldNode` to `newNode`. Generally only used  when
	//  `oldNode` and `newNode` represent the same state, and `oldNode` is a loose node and should be the one to go
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
	// For a `seq` that's on this node, split it into two sequences `seq1` and `seq2` at the tick offset `offset`, with a new node `node` in the middle. This operation is the opposite of dissolving a node
	insertNodeOnSeq(
		seq: GraphMoveSequence,
		offset: number
	): { node: Node; seq1: GraphMoveSequence; seq2: GraphMoveSequence } {
		const [endNode] = Array.from(this.outConns.entries()).find(([, seqs]) =>
			seqs.includes(seq)
		)!
		this.removeConnection(seq)
		const seq2 = seq.clone()
		// `trim` removes the moves in the interval, so `seq` will become the sequence between `this` and `midNode`
		seq.trim([offset, seq.tickLen])
		seq2.trim([0, offset])
		let midNode: Node
		// XXX: Is this edge case useful?
		if (seq.lastHash === endNode.hash) {
			midNode = endNode
			const conns = this.outConns.get(endNode) ?? []
			conns.push(seq)
			this.outConns.set(endNode, conns)
			midNode.inNodes.push(this)
		} else {
			midNode = this.newChild(seq)
			midNode.level = this.level.clone()
			seq.applyToLevel(midNode.level, midNode.playerSeat)
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

// A small thing describing a specific move sequence
export interface ConnPtr {
	// the parent `n`ode
	n: Node
	// the `m`ove sequence
	m: GraphMoveSequence
}

// A small thing describing a specific move index on a move sequence on a node
export interface MovePtr extends ConnPtr {
	// `o`ffset
	o: number
}

export class GraphModel {
	initialTimeLeft: number
	rootNode: Node
	current: MovePtr | Node
	constructedRoute: ConnPtr[] = []
	nodeHashMap: Map<number, Node> = new Map()
	hashMap: Map<number, MovePtr> = new Map()
	get playerSeat() {
		return this.level.playerSeats[0]
	}
	constructor(
		public level: Level,
		public hashSettings: HashSettings
	) {
		this.initialTimeLeft = level.timeLeft
		level.timeLeft = 0
		this.rootNode = this.current = new Node(level, hashSettings)
		this.nodeHashMap.set(this.rootNode.hash, this.rootNode)
	}
	addInput(input: KeyInputs): number {
		let node: Node, moveSeq: GraphMoveSequence, parent: Node, moveLength: number
		if (!(this.current instanceof Node)) {
			moveSeq = new GraphMoveSequence(this.hashSettings)
			moveLength = moveSeq.add(input, this.level, this.playerSeat)
			const curMoveSeq = this.current.m.moves.slice(this.current.o)
			if (moveSeq.moves.every((move, i) => curMoveSeq[i] === move)) {
				if (this.current.o + moveSeq.tickLen === this.current.m.tickLen) {
					this.current = this.nodeHashMap.get(moveSeq.lastHash)!
					this.level = this.current.level
				} else {
					this.current.o += moveSeq.tickLen
				}
				this.cleanConstruction()
				return moveLength
			}
			const constrIdx = this.constructedRoute.findIndex(
				conn => conn.n === (this.current as MovePtr).n
			)
			const {
				node: parent2,
				seq1,
				seq2,
			} = this.current.n.insertNodeOnSeq(this.current.m, this.current.o)
			this.constructedRoute.splice(constrIdx)
			this.constructedRoute.push({ n: this.current.n, m: seq1 })
			this.constructedRoute.push({ n: parent2, m: moveSeq })
			parent = parent2
			// Promote implied, mid-seq node to explicit
			this.hashMap.delete(parent.hash)
			this.nodeHashMap.set(parent.hash, parent)
			for (const hash of seq2.hashes) {
				if (hash === null) continue
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
			this.level = this.level.clone()
			moveLength = moveSeq.add(input, this.level, this.playerSeat)
			const constrIdx = this.getConstructionIdx()
			for (const [node, conns] of this.current.outConns) {
				for (const conn of conns) {
					if (moveSeq.moves.every((move, i) => move === conn.moves[i])) {
						if (this.constructedRoute[constrIdx]?.m !== conn) {
							this.constructedRoute.splice(constrIdx)
							this.constructedRoute.push({ n: this.current, m: conn })
						}
						if (conn.tickLen === moveSeq.tickLen) {
							this.current = node
							this.level = node.level
							this.cleanConstruction()
						} else {
							this.current = { n: this.current, m: conn, o: moveSeq.tickLen }
							this.constructionAutoComplete(node)
						}
						return moveLength
					}
				}
			}
			this.constructedRoute.splice(constrIdx)
			parent = this.current
			node = parent.newChild(moveSeq)
			node.level = this.level
			this.current = node
			this.constructedRoute.push({ n: parent, m: moveSeq })
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
			moveLength = moveSeq.add(input, this.level, this.playerSeat)
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
				if (hash === null) continue
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
		this.cleanConstruction()
		return moveLength
	}
	cleanConstruction() {
		const lastNode = this.constructionLastNode()
		const redundantNodeIdx = this.constructedRoute.findIndex(
			ptr => ptr.n === lastNode
		)
		if (redundantNodeIdx !== -1) {
			this.constructedRoute.splice(redundantNodeIdx)
		}
		if (this.current === lastNode) {
			this.constructionAutoComplete(lastNode)
		}
	}
	constructionLastNode() {
		if (this.constructedRoute.length === 0) {
			return this.current as Node
		} else {
			const lastPtr = this.constructedRoute[this.constructedRoute.length - 1]
			return lastPtr.n.findConnectedNode(lastPtr.m)!
		}
	}
	getConstructionIdx() {
		const node = this.current instanceof Node ? this.current : this.current.n
		let constrIdx = this.constructedRoute.findIndex(conn => conn.n === node)
		if (constrIdx === -1) {
			constrIdx = this.constructedRoute.length
		}
		return constrIdx
	}
	constructionAutoComplete(node: Node): void {
		if (node.winDistance !== undefined) {
			while (node.winTargetSeq) {
				this.constructedRoute.push({ n: node, m: node.winTargetSeq! })
				if (!node.winTargetNode) break
				node = node.winTargetNode
			}
		} else {
			// I dunno, pick a random one?
			while (node.outConns.size > 0) {
				const conns = Array.from(node.outConns.entries())
					.flatMap(v => v[1].map<[Node, GraphMoveSequence]>(seq => [v[0], seq]))
					.filter(v => !this.constructedRoute.some(conn => conn.n === v[0]))
				if (conns.length === 0) break
				const conn = conns[0]
				this.constructedRoute.push({ n: node, m: conn[1] })
				node = conn[0]
			}
		}
	}
	undo(into?: GraphMoveSequence) {
		let toGoTo: Node | MovePtr
		if (!(this.current instanceof Node)) {
			toGoTo = { ...this.current }
			toGoTo.o = this.current.m.userMoves
				.slice(0, this.current.o)
				.lastIndexOf(true)
		} else {
			let srcNode: Node
			if (!into) {
				const constrIdx = this.getConstructionIdx()
				if (this.constructedRoute.length === 0 || constrIdx === 0) return
				const lastConn = this.constructedRoute[constrIdx - 1]
				srcNode = lastConn.n
				into = lastConn.m
			} else {
				srcNode =
					this.current.inNodes.length === 1
						? this.current.inNodes[0]
						: this.current.inNodes
								.map(val => Array.from(val.outConns.entries()))
								.flat(1)
								.find(([, conns]) => conns.includes(into!))![0]
			}
			toGoTo = {
				n: srcNode,
				m: into,
				o: into.userMoves.lastIndexOf(true),
			}
		}
		if (toGoTo.o === 0) {
			toGoTo = toGoTo.n
		}
		this.goTo(toGoTo)
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
			const constrIdx = this.getConstructionIdx()
			if (!into) {
				if (this.constructedRoute.length === 0) return
				if (constrIdx === this.constructedRoute.length) return
				into = this.constructedRoute[constrIdx].m
			}
			if (!into) throw new Error(`into is required for multi-out nodes!`)
			if (constrIdx === this.constructedRoute.length) {
				this.constructedRoute.push({ n: this.current, m: into })
			}
			this.current = {
				n: this.current,
				m: into,
				o: into.userMoves.indexOf(true, 1),
			}
			if (this.current.o !== -1) {
				this.level = this.level.clone()
			}
		}
		if (this.current.o === -1) {
			this.current = this.current.n.findConnectedNode(this.current.m)!
			this.level = this.current.level
		} else {
			this.current.m.applyToLevel(this.level, this.playerSeat, [
				lastO,
				this.current.o,
			])
		}
		this.cleanConstruction()
	}

	goTo(pos: MovePtr | Node): void {
		let node = pos instanceof Node ? pos : pos.n
		const lastNode = this.constructionLastNode()
		const toAppend: ConnPtr[] = []
		let pathFound = false
		while (true) {
			if (node === lastNode) {
				pathFound = true
				break
			}
			for (let idx = this.constructedRoute.length - 1; idx >= 0; idx -= 1) {
				const ptr = this.constructedRoute[idx]
				if (ptr.n === node) {
					if (toAppend.length !== 0) {
						this.constructedRoute.splice(idx)
					}
					pathFound = true
					break
				}
			}
			if (pathFound) {
				break
			}
			if (node.rootTargetNode === undefined) break
			toAppend.push({ n: node.rootTargetNode!, m: node.rootTargetSeq! })
			node = node.rootTargetNode!
		}
		toAppend.reverse()
		if (!pathFound) {
			this.constructedRoute = toAppend
		} else {
			this.constructedRoute.push(...toAppend)
		}

		this.current = pos
		this.cleanConstruction()
		if (pos instanceof Node) {
			this.level = pos.level
			return
		}
		const closestSnapshot: Snapshot = pos.m.findSnapshot(pos.o) ?? {
			level: pos.n.level,
			tick: 0,
		}
		this.level = closestSnapshot.level.clone()
		pos.m.applyToLevel(this.level, this.playerSeat, [
			closestSnapshot.tick,
			pos.o,
		])
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
						this.hashMap.set(conn.hashes[moveOffset - 1]!, {
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
	isAlignedToMove(pos: MovePtr | Node): boolean {
		if (pos instanceof Node) return true
		return pos.m.userMoves[pos.o]
	}
	isCurrentlyAlignedToMove(): boolean {
		return this.isAlignedToMove(this.current)
	}
	isAtEnd() {
		return this.constructionLastNode() === this.current
	}
	step() {
		if (this.level.currentSubtick !== 1) {
			this.level.tick()
			return
		}
		if (this.current instanceof Node) {
			const ptr = this.constructedRoute.find(v => v.n === this.current)
			if (!ptr) {
				// We're at construction's end
				if (this.current !== this.constructionLastNode())
					throw new Error("Expected to be at construction's end")
				return
			}
			this.current = { n: ptr.n, m: ptr.m, o: 0 }
			this.level = this.level.clone()
		}
		this.playerSeat.inputs = charToKeyInput(
			this.current.m.moves[this.current.o]
		)
		this.level.tick()
		this.current.o += 1
		if (this.current.o === this.current.m.tickLen) {
			const constrIdx = this.getConstructionIdx()
			this.current =
				this.constructedRoute[constrIdx + 1]?.n ?? this.constructionLastNode()
		}
	}
}
