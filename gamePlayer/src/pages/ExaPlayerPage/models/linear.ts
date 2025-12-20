import {
	GameState,
	KeyInputs,
	Level,
	PlayerSeat,
	charToKeyInput,
	keyInputToChar,
} from "@notcc/logic"

export function tickLevel(level: Level) {
	level.tick()
	if (level.gameState === GameState.WON) return
	level.tick()
	// @ts-ignore Typescript bug: level.tick actually mutates level.gameState lol
	if (level.gameState === GameState.WON) return
	level.tick()
}

export const SNAPSHOT_PERIOD = 50
export interface Snapshot {
	level: Level
	tick: number
}

export type MoveSeqenceInterval = [startIn: number, endEx: number]

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
		level: Level,
		seat: PlayerSeat,
		interval: MoveSeqenceInterval = [0, this.moves.length]
	) {
		for (const move of this.moves.slice(interval[0], interval[1])) {
			seat.inputs = charToKeyInput(move)
			tickLevel(level)
			if (level.gameState !== GameState.PLAYING) return
		}
	}
	_add_tickLevel(input: KeyInputs, level: Level, seat: PlayerSeat) {
		if ((this.tickLen + this.snapshotOffset) % SNAPSHOT_PERIOD === 0) {
			this.snapshots.push({ tick: this.tickLen, level: level.clone() })
		}
		seat.inputs = input
		tickLevel(level)
	}
	/**
	 * @returns The amount of subticks passed between this input and the next time the player has agency
	 * */
	add(input: KeyInputs, level: Level, seat: PlayerSeat): number {
		const ogInput = input
		const inputsToPush: string[] = []
		let char = keyInputToChar(input, false)
		let firstTick = true
		do {
			this._add_tickLevel(input, level, seat)
			inputsToPush.push(char)
			this.moves.push(char)
			this.userMoves.push(firstTick)
			input = 0
			char = "-"
			firstTick = false
		} while (
			level.gameState === GameState.PLAYING &&
			seat.actor &&
			seat.actor.moveProgress != 0
		)
		if (inputsToPush.length === 4 && !inputsToPush[0].endsWith("-")) {
			this.displayMoves.push(keyInputToChar(ogInput, true), "", "", "")
		} else {
			this.displayMoves.push(...inputsToPush)
		}
		return inputsToPush.length * 3
	}
	trim(interval: MoveSeqenceInterval) {
		this.moves.splice(...interval)
		this.displayMoves.splice(...interval)
		this.userMoves.splice(...interval)
		this.snapshots = this.snapshots
			.filter(snap => !(snap.tick >= interval[0] && snap.tick < interval[1]))
			.map(snap => ({
				...snap,
				tick:
					snap.tick >= interval[1]
						? snap.tick - (interval[1] - interval[0])
						: snap.tick,
			}))
	}
	clone(): this {
		const thisSnapshots = this.snapshots
		//@ts-ignore We'll reattach it shortly
		delete this.snapshots
		const cloned = structuredClone(this)
		// Reattach prototype
		Object.setPrototypeOf(cloned, Object.getPrototypeOf(this))
		this.snapshots = thisSnapshots
		cloned.snapshots = thisSnapshots.map(snap => ({
			...snap,
			level: snap.level.clone(),
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
	findSnapshot(tickFromStartOfSeq: number): Snapshot | undefined {
		return this.snapshots.findLast(
			snapshot => snapshot.tick <= tickFromStartOfSeq
		)
	}
}

export class LinearModel {
	moveSeq = new MoveSequence()
	offset = 0
	get playerSeat() {
		return this.level.playerSeats[0]
	}
	constructor(public level: Level) {}
	addInput(inputs: KeyInputs): number {
		if (this.level.gameState !== GameState.PLAYING) return 0
		let moveLength: number
		if (this.offset !== this.moveSeq.tickLen) {
			const newSeq = new MoveSequence()
			newSeq.snapshotOffset = this.offset
			moveLength = newSeq.add(inputs, this.level, this.playerSeat)
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
			moveLength = this.moveSeq.add(inputs, this.level, this.playerSeat)
			this.offset = this.moveSeq.tickLen
		}
		return moveLength
	}
	loadMoves(moves: string[], reportProgress?: (progress: number) => void) {
		this.resetLevel()
		let lastReport = 0
		while (
			this.offset < moves.length &&
			this.level.gameState === GameState.PLAYING
		) {
			this.addInput(charToKeyInput(moves[this.offset]))
			if (this.offset - lastReport > 100) {
				reportProgress?.(this.offset / moves.length)
				lastReport = this.offset
			}
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
		this.moveSeq.applyToLevel(this.level, this.playerSeat, [
			lastOffset,
			this.offset,
		])
	}
	goTo(pos: number): void {
		if (this.moveSeq.tickLen === 0) return
		this.offset = pos
		// since `snapshotOffset` here will be 0, there'll always be a matching snapshot for any requested tick
		const snapshot = this.moveSeq.findSnapshot(pos)!

		this.level = snapshot.level.clone()
		this.moveSeq.applyToLevel(this.level, this.playerSeat, [snapshot.tick, pos])
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
		if (this.level.currentSubtick !== 1) {
			this.level.tick()
			return
		}
		if (this.offset === this.moveSeq.tickLen) return
		this.playerSeat.inputs = charToKeyInput(this.moveSeq.moves[this.offset])
		this.offset += 1
		this.level.tick()
	}
	getSelectedMoveSequence(): string[] {
		return this.moveSeq.moves
	}
	timeLeft() {
		return this.level.timeLeft
	}
	transcribeFromOther(old: this, reportProgress?: (progress: number) => void) {
		this.loadMoves(old.moveSeq.moves, reportProgress)
	}
	isBlank() {
		return this.moveSeq.tickLen === 0
	}
}
