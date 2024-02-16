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
		level.gameInput = input
		tickLevel(level)
		if ((this.tickLen + this.snapshotOffset) % SNAPSHOT_PERIOD === 0) {
			this.snapshots.push({ tick: this.tickLen, level: cloneLevel(level) })
		}
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
			snap => snap.tick >= interval[0] && snap.tick < interval[1]
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
		this.moves.push(...other.moves)
		this.displayMoves.push(...other.displayMoves)
		this.userMoves.push(...other.userMoves)
	}
}

export class LinearModel {
	moveSeq = new MoveSequence()
	constructor(public level: LevelState) {}
	addInput(inputs: KeyInputs, level: LevelState): void {
		this.moveSeq.add(inputs, level)
	}
}
