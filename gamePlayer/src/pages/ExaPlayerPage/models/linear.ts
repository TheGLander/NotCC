import {
	GameState,
	KeyInputs,
	LevelState,
	charToKeyInput,
	keyInputToChar,
	makeEmptyInputs,
} from "@notcc/logic"
import clone from "clone"

export function tickLevel(level: LevelState) {
	level.tick()
	if (level.gameState === GameState.WON) return
	level.tick()
	// @ts-ignore Typescript bug: level.tick actually mutates level.gameState lol
	if (level.gameState === GameState.WON) return
	level.tick()
}

export const SNAPSHOT_PERIOD = 50
export interface Snapshot {
	level: LevelState
	tick: number
}

export type MoveSeqenceInterval = [startIn: number, endEx: number]

// TODO move this to @notcc/logic maybe?
export function cloneLevel(level: LevelState): LevelState {
	// Don't clone the static level data
	// TODO Maybe don't always have a copy of the whole level map in the level state?
	// What's it doing there, anyways?
	const levelData = level.levelData
	delete level.levelData
	const inputProvider = level.inputProvider
	delete level.inputProvider
	const newLevel = clone(level, true)
	newLevel.levelData = levelData
	newLevel.inputProvider = inputProvider
	level.levelData = levelData
	level.inputProvider = inputProvider
	return newLevel
}

export class MoveSequence {
	moves: string[] = []
	displayMoves: string[] = []
	userMoves: boolean[] = []
	snapshots: Snapshot[] = []
	snapshotOffset: number = 0

	get tickLen(): number {
		return this.moves.length
	}
	applyToLevel(
		level: LevelState,
		interval: MoveSeqenceInterval = [0, this.moves.length]
	) {
		for (const move of this.moves.slice(interval[0], interval[1])) {
			level.gameInput = charToKeyInput(move)
			tickLevel(level)
			if (level.gameState !== GameState.PLAYING) return
		}
	}
	_add_tickLevel(input: KeyInputs, level: LevelState) {
		if ((this.tickLen + this.snapshotOffset) % SNAPSHOT_PERIOD === 0) {
			this.snapshots.push({ tick: this.tickLen, level: cloneLevel(level) })
		}
		level.gameInput = input
		tickLevel(level)
	}
	add(input: KeyInputs, level: LevelState) {
		const ogInput = input
		const inputsToPush: string[] = []
		let char = keyInputToChar(input, false)
		let firstTick = true
		do {
			this._add_tickLevel(input, level)
			inputsToPush.push(char)
			this.moves.push(char)
			this.userMoves.push(firstTick)
			input = makeEmptyInputs()
			char = "-"
			firstTick = false
		} while (
			level.selectedPlayable!.cooldown > 0 &&
			level.gameState === GameState.PLAYING
		)
		if (inputsToPush.length === 4 && !inputsToPush[0].endsWith("-")) {
			this.displayMoves.push(keyInputToChar(ogInput, true), "", "", "")
		} else {
			this.displayMoves.push(...inputsToPush)
		}
	}
	trim(interval: MoveSeqenceInterval) {
		this.moves.splice(...interval)
		this.displayMoves.splice(...interval)
		this.userMoves.splice(...interval)
		this.snapshots = this.snapshots.filter(
			snap => !(snap.tick >= interval[0] && snap.tick < interval[1])
		)
	}
	clone(): this {
		const thisSnapshots = this.snapshots
		//@ts-ignore We'll reattach it shortly
		delete this.snapshots
		const cloned = clone(this)
		this.snapshots = thisSnapshots
		cloned.snapshots = thisSnapshots.map(snap => ({
			...snap,
			level: cloneLevel(snap.level),
		}))
		return cloned
	}
	merge(other: this) {
		const otherOffset = this.tickLen
		this.moves.push(...other.moves)
		this.displayMoves.push(...other.displayMoves)
		this.userMoves.push(...other.userMoves)
		for (const oSnapshot of other.snapshots) {
			this.snapshots.push({ ...oSnapshot, tick: oSnapshot.tick + otherOffset })
		}
	}
}

export class LinearModel {
	moveSeq = new MoveSequence()
	offset = 0
	constructor(public level: LevelState) {}
	addInput(inputs: KeyInputs, level: LevelState): void {
		if (this.offset !== this.moveSeq.tickLen) {
			const newSeq = new MoveSequence()
			newSeq.snapshotOffset = this.offset
			newSeq.add(inputs, level)
			if (
				newSeq.moves.every(
					(m, idx) => m === this.moveSeq.moves[idx + this.offset]
				)
			) {
				this.offset += newSeq.tickLen
			} else {
				this.moveSeq.trim([this.offset, Infinity])
				this.moveSeq.merge(newSeq)
				this.offset = this.moveSeq.tickLen
			}
		} else {
			this.moveSeq.add(inputs, level)
			this.offset = this.moveSeq.tickLen
		}
	}
	undo() {
		if (this.offset === 0) return
		this.offset = this.moveSeq.userMoves.slice(0, this.offset).lastIndexOf(true)
		this.goTo(this.offset)
	}
	redo() {
		const lastOffset = this.offset
		const newOffset = this.moveSeq.userMoves
			.slice(this.offset + 1)
			.indexOf(true)
		if (newOffset === -1) {
			this.offset = this.moveSeq.tickLen
		} else {
			this.offset += newOffset + 1
		}
		this.moveSeq.applyToLevel(this.level, [lastOffset, this.offset])
	}
	goTo(pos: number): void {
		this.offset = pos
		const closestSnapshot: Snapshot = this.moveSeq.snapshots.find(
			snap => snap.tick <= pos
		)!
		this.level = cloneLevel(closestSnapshot.level)
		this.moveSeq.applyToLevel(this.level, [closestSnapshot.tick, pos])
	}
	resetLevel() {
		this.goTo(0)
	}
	isAlignedToMove(pos: number): boolean {
		return this.moveSeq.userMoves[pos] || this.offset === this.moveSeq.tickLen
	}
	isCurrentlyAlignedToMove(): boolean {
		return this.isAlignedToMove(this.offset)
	}
	isAtEnd() {
		return this.offset === this.moveSeq.tickLen
	}
	step() {
		if (this.level.subtick !== 1) {
			this.level.tick()
			return
		}
		if (this.offset === this.moveSeq.tickLen) return
		this.level.gameInput = charToKeyInput(this.moveSeq.moves[this.offset])
		this.offset += 1
		this.level.tick()
	}
}
