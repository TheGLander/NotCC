import {
	GameState,
	KeyInputs,
	Level,
	charToKeyInput,
	HashSettings,
	RouteFileInputProvider,
	splitRouteCharString,
	keyInputToChar,
} from "@notcc/logic"
import { MoveSequence, Snapshot } from "./linear"
import { PriorityQueue } from "@/helpers"

export interface SerializedConnection {
	moves: string
	target: number
}

export interface SerializedNode {
	connections: Record<number, SerializedConnection>
}

export interface SerializedConstrutionPath {
	from: number
	conn: number
}

export interface SerializedGraph {
	rootNode: number
	hashSettings: HashSettings
	construction: SerializedConstrutionPath[]
	nodes: Record<number, SerializedNode>
}

/**
 * Traces a path, using Dijkstra's algorithm, between `pointB` and the latest possible item in `pointsA`.
 */
function dijkstraTrace(
	pointsA: Node[],
	pointB: Node,
	startingFromA: boolean
): { pointA: Node; path: ConnPtr[] } | null {
	const dists = new Map<Node, [ConnPtr | null, number]>([[pointB, [null, 0]]])
	const toVisit = new PriorityQueue<[Node, number]>()
	toVisit.push([pointB, 0], 0)
	let bestANode: [idx: number, dist: number] | undefined
	while (true) {
		const visiting = toVisit.pop()
		if (!visiting) break
		const [node, baseDist] = visiting
		const aIdx = pointsA.indexOf(node)
		if (aIdx !== -1) {
			// We've reached an A point. If it's a node that's either later in the arr or
			// closer than the current node (former is more important), that's the new
			// best node
			if (
				!bestANode ||
				aIdx > bestANode[0] ||
				(aIdx === bestANode[0] && baseDist < bestANode[1])
			) {
				bestANode = [aIdx, baseDist]
			}
			// Don't go further here, any path through this node would reach an A point
			// twice, which is clearly silly
			continue
		}
		for (const conn of node[
			!startingFromA ? "findShortestChildConns" : "findShortestParentConns"
		]()) {
			const dist = baseDist + conn.m.tickLen
			const target = dists.get(conn.n)
			if (!target) {
				toVisit.push([conn.n, dist], -dist)
				dists.set(conn.n, [{ n: node, m: conn.m }, dist])
			} else if (dist < target[1]) {
				toVisit.adjust(v => v[0] === conn.n, -dist)
				dists.set(conn.n, [{ n: node, m: conn.m }, dist])
			}
		}
	}
	if (!bestANode) return null
	const path: ConnPtr[] = []
	let node: Node = pointsA[bestANode[0]]
	// If `startingFromA`, we're constructing a path from `bestANode` to `pointB`
	// `dists`' `ConnPtr`s store connection from the node closer to point B to the
	// indexed node. When the dest is B, we need the connections to go from the keyed
	// node to the node closer to B, so we construct new `ConnPtr`s where the `n`
	// is the keyed node in that case. For when dest is A, going from the closer
	// node is the desired behaviour, so we can reuse the existing `ConnPtrs then`
	while (node) {
		const [nextConn] = dists.get(node)!
		if (!nextConn) break
		path.push(!startingFromA ? nextConn : { n: node, m: nextConn.m })
		node = nextConn.n
	}
	if (!startingFromA) {
		// Oh yeah, since we always start from A when constructing the node, the whole
		// construction has to be reversed to accomodate the fact that we, indeed,
		// start from B in this case
		path.reverse()
	}
	return { pointA: pointsA[bestANode[0]], path }
}

function constrTracePathThrough(
	constr: ConnPtr[] | Node,
	source: Node | ConnPtr
): ConnPtr[] {
	let constrNodes: Node[]
	if (constr instanceof Array) {
		constrNodes = constr.map(v => v.n)
		if (constr.length !== 0) constrNodes.push(constrLastNode(constr))
	} else {
		constrNodes = [constr]
		constr = []
	}
	let newConstr = [] as ConnPtr[]
	// 1. Find a connection from the latest possible construction node to the source (or source's start in case of a `ConnPtr`)
	const toSourceConstr = dijkstraTrace(
		constrNodes,
		source instanceof Node ? source : source.n,
		true
	)
	if (toSourceConstr === null) {
		// FIXME: Implement multiroot, that's the only case when tracing to can fail
		// when the root is involved
		throw new Error("Multiroot unsupported!")
	} else {
		// Connect from root to the beginning of the to-source constr
		const constrConnIdx = constrNodes.indexOf(toSourceConstr.pointA)
		newConstr.push(...constr.slice(0, constrConnIdx))
		// Connect from the beginning of to-source constr to the source ('s start)
		newConstr.push(...toSourceConstr.path)
		// Remove all connections from consideration that have already appeared in the construction
		// The `+ 1` excludes the connection immediately after the source's parent node, because if it were to appear in `fromSourceConstr`, we'd be going through source's parent twice, which is not allowed
		constr = constr.slice(constrConnIdx + 1)
		constrNodes = constrNodes.slice(constrConnIdx + 1)
	}
	// 2. If `source` is a connection, we're want the trace to include both the source and destination, so add the connection destination in the construction
	if (!(source instanceof Node)) {
		newConstr.push(source)
	}

	// 3. Find a connection from the source ('s end) to the earliest node
	constrNodes.reverse()
	const fromSourceConstr = dijkstraTrace(
		constrNodes,
		source instanceof Node ? source : source.n.findConnectedNode(source.m)!,
		false
	)
	// If `fromSourceConstr` is empty, `source` ('end ) is the end
	if (fromSourceConstr) {
		// Connect from the source ('s end) to the from-source node on the constr
		newConstr.push(...fromSourceConstr.path)
		// Connect from from-source node to the end of the construction
		// We reversed the `constrNodes` array, so to find the equivalent index in
		// `constr`, we need to flip the index dir
		const constrConnIdx =
			constrNodes.length - 1 - constrNodes.indexOf(fromSourceConstr.pointA)
		newConstr.push(...constr.slice(constrConnIdx))
	}
	return newConstr
}

function constrLastNode(constr: ConnPtr[]): Node {
	const last = constr[constr.length - 1]
	if (!last)
		throw new Error("Construction must have some elements to find the last one")
	return last.n.findConnectedNode(last.m)!
}

// Continue the construction from the last node to the closest winning node if
// we can, arbitary nodes otherwise
function constrAutoComplete(constrArg: ConnPtr[] | Node): ConnPtr[] {
	let lastNode: Node
	let constr: ConnPtr[]
	if (constrArg instanceof Node) {
		lastNode = constrArg
		constr = []
	} else {
		lastNode = constrLastNode(constrArg)
		constr = constrArg.concat()
	}
	// Pick the closest winning node if we can
	if (lastNode.winTarget) {
		while (lastNode.winTarget) {
			constr.push(lastNode.winTarget)
		}
	} else {
		// Pick arbitrary nodes as deep as we can go
		while (lastNode.outConns.size > 0) {
			const conns = Array.from(lastNode.outConnsAsPtr()).filter(
				v =>
					// Make sure we don't have circular references
					!constr.some(conn => conn.n === v.n) && v.n !== lastNode
			)
			if (conns.length === 0) break
			const conn = conns[0]
			constr.push({ n: lastNode, m: conn.m })
			lastNode = conn.n
		}
	}
	return constr
}

// Welp. ExaCC graph mode. This is gonna be confusing.
// In this mode, all routes stem from the root node, with nodes being specific level states, and edges (referred here as connections) being sequences of moves connecting them.
// The model tries to minimize the number of nodes for readability and performance reasons, so not all level states are automatically made into nodes. More details in the actual model class

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
	winTarget?: ConnPtr
	// Same as above, but for the closest root node
	rootDistance: number = 0
	rootTarget?: ConnPtr
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
	outConns: Map<Node, MoveSequence[]> = new Map()
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
	newChild(inputs: MoveSequence, level: Level, hash: number): Node {
		const child = new Node(this)
		child.level = level
		child.inNodes.push(this)
		this.outConns.set(child, [inputs])
		child.hash = hash
		child.rootDistance = this.rootDistance + inputs.tickLen * 3
		child.rootTarget = { n: this, m: inputs }
		return child
	}
	*findShortestParentConns(): IterableIterator<ConnPtr> {
		const seenNodes = new WeakSet<Node>()
		for (const node of this.inNodes) {
			// Remove multiple copies of the parent node, which will happen if we have multiple connections
			if (seenNodes.has(node)) continue
			seenNodes.add(node)

			const connArr = node.outConns.get(this)!
			const shortestSeq = connArr.reduce(
				(acc, val) => (val.tickLen < acc.tickLen ? val : acc),
				connArr[0]
			)
			yield { n: node, m: shortestSeq }
		}
	}
	*findShortestChildConns(): IterableIterator<ConnPtr> {
		for (const [node, seqs] of this.outConns) {
			const shortestSeq = seqs.reduce(
				(acc, val) => (val.tickLen < acc.tickLen ? val : acc),
				seqs[0]
			)
			yield { n: node, m: shortestSeq }
		}
	}
	cascadeWinDist() {
		if (this.winDistance === undefined) return
		const toCascade = new PriorityQueue<Node>()
		toCascade.push(this, -this.winDistance)
		while (toCascade.size > 0) {
			const node = toCascade.pop()!
			for (const conn of node.findShortestParentConns()) {
				const newDist =
					node.winDistance! + node.getWinSubtickOffset() + conn.m.tickLen * 3
				if (conn.n.winDistance !== undefined && newDist > conn.n.winDistance) {
					continue
				}
				conn.n.winDistance = newDist
				conn.n.winTarget = { n: node, m: conn.m }
				toCascade.push(conn.n, -newDist)
			}
		}
	}
	cascadeRootDist() {
		const toCascade = new PriorityQueue<Node>()
		toCascade.push(this, -this.rootDistance)
		while (toCascade.size > 0) {
			const node = toCascade.pop()!
			for (const conn of node.findShortestChildConns()) {
				const newDist =
					node.rootDistance + conn.m.tickLen * 3 + conn.n.getWinSubtickOffset()
				if (newDist > conn.n.rootDistance) {
					continue
				}
				conn.n.rootDistance = newDist
				conn.n.rootTarget = { n: node, m: conn.m }
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
	findConnectedNode(seq: MoveSequence): Node | undefined {
		return Array.from(this.outConns.entries()).find(([, seqs]) =>
			seqs.includes(seq)
		)?.[0]
	}
	removeConnection(seq: MoveSequence): void {
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
		seq: MoveSequence,
		offset: number,
		hash: number
	): { node: Node; seq1: MoveSequence; seq2: MoveSequence } {
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
		if (hash === endNode.hash) {
			midNode = endNode
			const conns = this.outConns.get(endNode) ?? []
			conns.push(seq)
			this.outConns.set(endNode, conns)
			midNode.inNodes.push(this)
		} else {
			midNode = this.newChild(seq, this.level.clone(), hash)
			seq.applyToLevel(midNode.level, midNode.playerSeat)
		}
		midNode.outConns.set(endNode, [seq2])
		endNode.inNodes.push(midNode)
		endNode.cascadeWinDist()
		this.cascadeRootDist()
		return { node: midNode, seq1: seq, seq2 }
	}
	getLooseMoveSeq(): MoveSequence {
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
	*outConnsAsPtr(): IterableIterator<ConnPtr> {
		for (const [node, conns] of this.outConns) {
			for (const conn of conns) {
				yield { n: node, m: conn }
			}
		}
	}
}

// A small thing describing a specific move sequence
export interface ConnPtr {
	// the parent `n`ode
	n: Node
	// the `m`ove sequence
	m: MoveSequence
}

// A small thing describing a specific move index on a move sequence on a node
export interface MovePtr extends ConnPtr {
	// `o`ffset
	o: number
}

function uniqueNumberMapper<T>() {
	const map = new Map<T, number>()
	return (val: T) => {
		let num = map.get(val)
		if (num === undefined) {
			num = map.size
			map.set(val, num)
		}
		return num
	}
}

export class GraphModel {
	initialTimeLeft: number
	rootNode: Node
	current: MovePtr | Node
	constructedRoute: ConnPtr[] = []
	nodeHashMap: Map<number, Node> = new Map()
	hashMap: Map<number, MovePtr> = new Map()
	// True if the current `level` is used in a node or move sequence. We need to track this separately
	// instead of just always copying when jumping to nodes to make redoing completely copy-free
	levelReferenced = true
	makeLevelUnreferenced() {
		if (this.levelReferenced) {
			this.level = this.level.clone()
			this.levelReferenced = false
		}
	}
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
	addInput(input: KeyInputs, forceNewNode?: boolean): number {
		if (this.level.gameState !== GameState.PLAYING) return 0
		let node: Node, moveSeq: MoveSequence, parent: Node, moveLength: number

		// If we're on a loose (and non-root) node, we always just extend the connection between the current node and the parent
		// There's no auto-completion to do here
		if (
			!forceNewNode &&
			this.current instanceof Node &&
			this.current.loose &&
			this.current !== this.rootNode
		) {
			node = this.current
			parent = node.inNodes[0]
			moveSeq = node.getLooseMoveSeq()
			// Change the hash of the last move to point to the move on the connection rather than the node (we'll be changing the node's hash)
			this.nodeHashMap.delete(node.hash)
			this.hashMap.set(node.hash, {
				n: parent,
				m: moveSeq,
				o: moveSeq.tickLen,
			})
			// The loose node's `level` needs to be synced to the latest changes, so if we
			// somehow don't have it referenced already to the model's level, alias them
			if (!this.levelReferenced) {
				node.level = this.level
				this.levelReferenced = true
			}
			moveLength = moveSeq.add(input, this.level, this.playerSeat)
			node.hash = this.level.hash(this.hashSettings)
			// XXX: Equivalent to `+= moveLength`?
			node.rootDistance = parent.rootDistance + moveSeq.tickLen * 3
		} else {
			// First to to see if the input matches an existing connection, in which case just seek to there
			let existingConn: MovePtr | undefined
			const charInput = keyInputToChar(input, false)
			if (this.current instanceof Node) {
				// Different connections from the same node are guaranteed to start with different moves,
				// so just checking the first move is enough to identify identical paths
				const conn = [...this.current.outConnsAsPtr()].find(
					conn => conn.m.moves[0] === charInput
				)
				if (conn) {
					existingConn = { n: this.current, m: conn.m, o: 0 }
					// We only need to change construction if we're going to a connection that isn't in the construction
					// Note that this is the only place we need to handle construction for existing conns, since otherwise
					// we'll be on the current construction node anyways
					const constrIdx = this.getConstructionIdx()
					const constrItem = this.constructedRoute[constrIdx]
					if (constrItem && constrItem.m !== conn.m) {
						this.constructedRoute.splice(constrIdx)
					}
					this.constructedRoute = constrTracePathThrough(
						this.constructedRoute.length === 0
							? this.current
							: this.constructedRoute,
						{ n: this.current, m: conn.m }
					)
				}
			} else if (this.current.m.moves[this.current.o] === charInput) {
				existingConn = this.current
			}
			// If there is, just seek to the move aftet the current one
			if (existingConn) {
				const newMoveOffset = existingConn.m.userMoves.indexOf(
					true,
					existingConn.o + 1
				)
				if (newMoveOffset === -1) {
					this.current = existingConn.n.findConnectedNode(existingConn.m)!
					this.level = this.current.level
					this.levelReferenced = true
					return existingConn.m.tickLen - existingConn.o
				} else {
					this.makeLevelUnreferenced()
					existingConn.m.applyToLevel(this.level, this.playerSeat, [
						existingConn.o,
						newMoveOffset,
					])
					const offsetOffset = newMoveOffset - existingConn.o
					existingConn.o = newMoveOffset
					this.current = existingConn
					return offsetOffset
				}
			}
			// Looks like this has to be a brand new move sequence

			if (this.current instanceof Node) {
				parent = this.current
				// Replace all consturction after the current point with the new connection
				this.constructedRoute.splice(this.getConstructionIdx())
			} else {
				// Insert a node if we are currently in the middle of a sequence
				const { node: midNode } = this.insertNodeOnSeq(
					this.current,
					this.level.hash(this.hashSettings)
				)
				parent = midNode
				// As above, remove construction that comes after the current move
				// Though since `getConstructionIdx` returns the earlier node when on a move sequence and we don't need to remove the sequence we're currently on from the construction, we have to add 1 to the index

				this.constructedRoute.splice(this.getConstructionIdx() + 1)
			}
			moveSeq = new MoveSequence()
			// Need to make sure we don't mutate a level copy used elsewhere
			this.makeLevelUnreferenced()
			moveLength = moveSeq.add(input, this.level, this.playerSeat)
			node = parent.newChild(
				moveSeq,
				this.level,
				this.level.hash(this.hashSettings)
			)
			this.constructedRoute.push({ n: parent, m: moveSeq })
		}

		const newHash = this.level.hash(this.hashSettings)
		const nodeMergee = this.nodeHashMap.get(newHash)
		const moveMergee = this.hashMap.get(newHash)
		if (nodeMergee) {
			// Found a node to merge into, `node` is unnecessary
			parent.moveConnections(nodeMergee, node)
			this.current = nodeMergee
			// `node` is dead, so it's no longer referencing `level`
			this.levelReferenced = false
		} else if (moveMergee) {
			// Found a non-node point on a move sequence, create a new `midNode`
			const { node: midNode } = this.insertNodeOnSeq(moveMergee, newHash)
			parent.moveConnections(midNode, node)
			this.current = midNode
			// Same as above, `level` is no longer referenced
			this.levelReferenced = false
		} else {
			// No mergee, this is a new, loose node
			this.nodeHashMap.set(node.hash, node)
			if (node.level.gameState === GameState.WON) {
				node.winDistance = 0
				node.rootDistance += node.getWinSubtickOffset()
				node.cascadeWinDist()
			}
			this.current = node
		}
		this.cleanConstruction()
		return moveLength
	}
	// Like the `Node` method, but corrects `nodeHashMap`/`hashMap`/sequence state
	insertNodeOnSeq(pos: MovePtr, hash: number) {
		// TODO: Explain
		const res = pos.n.insertNodeOnSeq(pos.m, pos.o, hash)
		const { node: midNode, seq1, seq2 } = res
		this.nodeHashMap.set(midNode.hash, midNode)
		this.hashMap.delete(midNode.hash)
		const level = midNode.level.clone()
		const levelHashes = seq2.userHashes(
			level,
			level.playerSeats[0],
			this.hashSettings
		)
		for (const hash of levelHashes) {
			const ent = this.hashMap.get(hash)!
			ent.n = midNode
			ent.m = seq2
			ent.o -= seq1.tickLen
		}

		return res
	}
	cleanConstruction() {
		if (this.constructedRoute.length === 0) return
		const lastNode = constrLastNode(this.constructedRoute)
		const redundantNodeIdx = this.constructedRoute.findIndex(
			ptr => ptr.n === lastNode
		)
		if (redundantNodeIdx !== -1) {
			this.constructedRoute.splice(redundantNodeIdx)
		}
		if (this.current === lastNode) {
			this.constructedRoute = constrAutoComplete(
				this.constructedRoute.length === 0
					? this.current
					: this.constructedRoute
			)
		}
	}
	constructionLastNode(): Node {
		return this.constructedRoute.length === 0
			? (this.current as Node)
			: constrLastNode(this.constructedRoute)
	}
	getConstructionIdx() {
		const node = this.current instanceof Node ? this.current : this.current.n
		let constrIdx = this.constructedRoute.findIndex(conn => conn.n === node)
		if (constrIdx === -1) {
			constrIdx = this.constructedRoute.length
		}
		return constrIdx
	}
	undo(into?: MoveSequence) {
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
		this.jumpTo(toGoTo)
	}
	redo(into?: MoveSequence) {
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
		}
		if (this.current.o === -1) {
			// We try to avoid level cloning as much as possible, so we try to use an
			// existing non-referenced level as much as possible instead of discarding it
			// since we'd then need to clone the level again if we redo again onto a
			// non-cached level position
			if (this.levelReferenced) {
				this.current = this.current.n.findConnectedNode(this.current.m)!
				this.level = this.current.level
			} else {
				this.current.m.applyToLevel(this.level, this.playerSeat, [
					lastO,
					Infinity,
				])
				this.current = this.current.n.findConnectedNode(this.current.m)!
			}
		} else {
			this.makeLevelUnreferenced()
			this.current.m.applyToLevel(this.level, this.playerSeat, [
				lastO,
				this.current.o,
			])
		}
	}
	/**
	 * Updates the model to be on `pos`.
	 */
	goTo(pos: MovePtr | Node): void {
		this.constructedRoute = constrTracePathThrough(
			this.constructedRoute.length === 0
				? (this.current as Node)
				: this.constructedRoute,
			pos instanceof Node ? pos : { n: pos.n, m: pos.m }
		)
		this.jumpTo(pos)
	}

	/**
	 * Changes `this.level` to refer to the specified position. `pos` must be on
	 * the current construction to maintain soundness
	 */
	jumpTo(pos: MovePtr | Node) {
		this.current = pos

		if (pos instanceof Node) {
			this.level = pos.level
			this.levelReferenced = true
			return
		}
		const closestSnapshot: Snapshot = pos.m.findSnapshot(pos.o) ?? {
			level: pos.n.level,
			tick: 0,
		}
		this.level = closestSnapshot.level
		this.levelReferenced = true

		if (closestSnapshot.tick !== pos.o) {
			this.level = this.level.clone()
			this.levelReferenced = false
			pos.m.applyToLevel(this.level, this.playerSeat, [
				closestSnapshot.tick,
				pos.o,
			])
		}
	}
	resetLevel() {
		this.jumpTo(this.rootNode)
	}
	*findBackfeedConns(): IterableIterator<ConnPtr> {
		const nodesToVisit: [Node, Node[]][] = [[this.rootNode, []]]
		const visited: WeakSet<Node> = new WeakSet()
		visited.add(this.rootNode)
		while (nodesToVisit.length > 0) {
			const [node, parents] = nodesToVisit.shift()!
			for (const [tNode, conns] of node.outConns.entries()) {
				if (parents.includes(tNode) || node === tNode) {
					for (const conn of conns) {
						yield { n: node, m: conn }
					}
				} else {
					if (!visited.has(tNode)) {
						nodesToVisit.push([tNode, parents.concat(node)])
						visited.add(tNode)
					}
				}
			}
		}
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
		this.makeLevelUnreferenced()
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
	serialize(): SerializedGraph {
		const nodeNum = uniqueNumberMapper<Node>()
		const connNum = uniqueNumberMapper<MoveSequence>()
		return {
			rootNode: nodeNum(this.rootNode),
			hashSettings: this.hashSettings,
			nodes: Object.fromEntries(
				[...this.nodeHashMap.entries()].map<[number, SerializedNode]>(
					([, node]) => [
						nodeNum(node),
						{
							connections: Object.fromEntries(
								[...node.outConnsAsPtr()].map<[number, SerializedConnection]>(
									val => [
										connNum(val.m),
										{ moves: val.m.moves.join(""), target: nodeNum(val.n) },
									]
								)
							),
						},
					]
				)
			),
			construction: this.constructedRoute.map(val => ({
				from: nodeNum(val.n),
				conn: connNum(val.m),
			})),
		}
	}
	loadSerialized(
		graph: SerializedGraph,
		reportProgress?: (progress: number) => void
	) {
		const totalTicks = Object.values(graph.nodes).reduce(
			(acc, node) =>
				acc +
				Object.values(node.connections).reduce(
					// Technically inaccurate because of p/c/s, but good enough
					(acc, conn) => acc + conn.moves.length,
					0
				),
			0
		)
		let processedTicks = 0

		const nodesToLoad = [graph.rootNode]
		const nodeNumMap: Record<number, Node> = {
			[graph.rootNode]: this.rootNode,
		}
		const loadedNodes = new Set<number>()
		// Try to map each serialized connection into a moveseq (for construction),
		// but we can null it out if we fail
		let connNumMap: Record<number, ConnPtr> | null = {}
		function findConnectingSequence(
			srcPos: Node | MovePtr,
			destPos: Node | MovePtr,
			ip: RouteFileInputProvider
		): ConnPtr | null {
			// Quite conservative here, technically we could map *any* state of `destPos`
			// (even when it results in partial or multiple seqs, or a loop) but who cares,
			// most loads will be from a blank graph where it'll always perfectly match
			if (!(destPos instanceof Node)) return null
			if (!(srcPos instanceof Node)) return null
			if (!destPos.inNodes.includes(srcPos)) return null
			const seq = srcPos.outConns
				.get(destPos)!
				.find(seq => seq.moves[0] === ip.moves[0])!
			return { n: srcPos, m: seq }
		}

		while (nodesToLoad.length > 0) {
			const nodeNum = nodesToLoad.pop()!
			loadedNodes.add(nodeNum)

			const serializedNode = graph.nodes[nodeNum]
			const pos = nodeNumMap[nodeNum]
			for (const [connNum, conn] of Object.entries(
				serializedNode.connections
			)) {
				this.jumpTo(pos)
				const ip = new RouteFileInputProvider(splitRouteCharString(conn.moves))
				let tick = 0
				while (!ip.outOfInput(tick * 3)) {
					const ticksAfterThisInput =
						this.addInput(ip.getInput(tick * 3, 0), tick === 0) / 3
					// This can only happen then node is prematurely won or lost, either way, no reason to add
					// more inputs
					if (ticksAfterThisInput === 0) break
					tick += ticksAfterThisInput
					processedTicks += ticksAfterThisInput
					if (processedTicks % 100 === 0) {
						reportProgress?.(processedTicks / totalTicks)
					}
				}
				// Adjust to account for p/c/s being counted as separate ticks in `totalTicks`
				processedTicks += conn.moves.length - tick

				if (connNumMap !== null) {
					const conn = findConnectingSequence(pos, this.current, ip)
					if (!conn) {
						connNumMap = null
					} else {
						connNumMap[connNum as any as number] = conn
					}
				}

				if (!(this.current instanceof Node)) {
					this.current = this.insertNodeOnSeq(
						this.current,
						this.level.hash(this.hashSettings)
					).node
				}
				nodeNumMap[conn.target] = this.current
				if (!loadedNodes.has(conn.target)) {
					nodesToLoad.push(conn.target)
				}
			}
		}
		if (connNumMap) {
			this.constructedRoute = graph.construction.map(
				conn => connNumMap![conn.conn]
			)
			this.cleanConstruction()
		}
	}
	getSelectedMoveSequence(): string[] {
		return this.constructedRoute.reduce<string[]>(
			(acc, val) => acc.concat(val.m.moves),
			[]
		)
	}
	timeLeft(): number {
		let distFromRoot: number
		if (this.current instanceof Node) {
			distFromRoot = this.current.rootDistance
			if (this.current.level.gameState === GameState.WON) {
				// This doesn't correctly emulate cases where a playable dies on a winning node,
				// since in those cases you actually *don't* lose a subtick, but it doesn't matter too much
				distFromRoot += 1
			}
		} else {
			distFromRoot = this.current.n.rootDistance + this.current.o * 3
		}
		return Math.max(0, this.initialTimeLeft - distFromRoot)
	}
	transcribeFromOther(old: this, reportProgress?: (progress: number) => void) {
		this.loadSerialized(old.serialize(), reportProgress)
	}
	isBlank(): boolean {
		return this.nodeHashMap.size === 1
	}
	removeConnection(conn: ConnPtr): void {
		conn.n.removeConnection(conn.m)
		const level = conn.n.level.clone()
		const levelHashes = conn.m.userHashes(
			level,
			level.playerSeats[0],
			this.hashSettings
		)
		for (const hash of levelHashes) {
			this.hashMap.delete(hash)
		}
	}
}
