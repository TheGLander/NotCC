import { Direction } from "../actor.js"
import { Level, Replay } from "../level.js"
import { ISolutionInfo } from "./nccs.pb.js"

export type KeyInputs = number
export const KEY_INPUTS = {
	up: 1 << 0,
	right: 1 << 1,
	down: 1 << 2,
	left: 1 << 3,
	dropItem: 1 << 4,
	cycleItems: 1 << 5,
	switchPlayer: 1 << 6,
}

export abstract class InputProvider {
	abstract getInput(curSubtick: number, seatIdx: number): KeyInputs
	abstract setupLevel(level: Level): void
	abstract getLength(): number
	outOfInput(curSubtick: number): boolean {
		return curSubtick >= this.getLength()
	}
	inputProgress(curSubtick: number): number {
		return Math.min(1, curSubtick / this.getLength())
	}
}

export function makeSimpleInputs(comp: Uint8Array): Uint8Array {
	const uncomp: number[] = []
	for (let compIndex = 0; compIndex <= comp.length; compIndex += 2) {
		const input = comp[compIndex]
		const length = comp[compIndex + 1]
		for (let i = 0; i < length; i += 1) {
			uncomp.push(input)
		}
	}
	if (comp.length % 2 !== 0) {
		uncomp.push(comp[comp.length - 1])
		uncomp.push(comp[comp.length - 1])
		uncomp.push(comp[comp.length - 1])
	}

	return new Uint8Array(uncomp.filter((_, i) => i % 3 === 2))
}

function subtickToTick(subtick: number) {
	return (subtick / 3) | 0
}

export class SolutionInfoInputProvider extends InputProvider {
	inputs: Uint8Array[]
	constructor(public solution: ISolutionInfo) {
		super()
		this.inputs = solution.steps!.map(buf => makeSimpleInputs(buf))
	}
	getInput(curSubtick: number, seatIdx: number): KeyInputs {
		return this.inputs[seatIdx][subtickToTick(curSubtick)]
	}
	setupLevel(level: Level): void {
		const levelState = this.solution.levelState
		if (!levelState) return
		if (typeof levelState.randomForceFloorDirection === "number") {
			level.randomForceFloorDirection =
				levelState.randomForceFloorDirection as unknown as Direction
		}
		const blobMod = levelState.cc2Data?.blobModifier
		if (typeof blobMod === "number") {
			level.rngBlob = blobMod
		}
	}
	getLength(): number {
		return this.inputs[0].length
	}
}

export interface RouteFor {
	Set?: string
	LevelName?: string
	LevelNumber?: number
}

export interface Route {
	Moves: string
	Rule: string
	Encode?: "UTF-8"
	"Initial Slide"?: Direction
	/**
	 * Not the same as "Seed", as Blobmod only affects blobs and nothing else, unlilke the seed in TW, which affects all randomness
	 */
	Blobmod?: number
	// Unused in CC2
	Step?: never
	Seed?: never
	// NotCC-invented metadata
	For?: RouteFor
	ExportApp?: string
}

const charToKeyInputMap: Record<string, KeyInputs> = {
	u: KEY_INPUTS.up,
	r: KEY_INPUTS.right,
	d: KEY_INPUTS.down,
	l: KEY_INPUTS.left,
	p: KEY_INPUTS.dropItem,
	c: KEY_INPUTS.cycleItems,
	s: KEY_INPUTS.switchPlayer,
	"↗": KEY_INPUTS.up | KEY_INPUTS.right,
	"↘": KEY_INPUTS.right | KEY_INPUTS.down,
	"↙": KEY_INPUTS.down | KEY_INPUTS.left,
	"↖": KEY_INPUTS.left | KEY_INPUTS.up,
}

export function areKeyInputsMoving(input: KeyInputs): boolean {
	return (
		(input &
			(KEY_INPUTS.up |
				KEY_INPUTS.right |
				KEY_INPUTS.down |
				KEY_INPUTS.left)) !==
		0
	)
}

export function generateSecondaryChars(input: KeyInputs) {
	let char = ""
	if (input & KEY_INPUTS.dropItem) char += "p"
	if (input & KEY_INPUTS.cycleItems) char += "c"
	if (input & KEY_INPUTS.switchPlayer) char += "s"
	return char
}

function binTest(val: number, mask: number): boolean {
	return (val & mask) == mask
}

export function keyInputToChar(input: KeyInputs, uppercase: boolean): string {
	let char = generateSecondaryChars(input)
	if (binTest(input, KEY_INPUTS.up | KEY_INPUTS.right))
		char += uppercase ? "⇗" : "↗"
	else if (binTest(input, KEY_INPUTS.right | KEY_INPUTS.down))
		char += uppercase ? "⇘" : "↘"
	else if (binTest(input, KEY_INPUTS.down | KEY_INPUTS.left))
		char += uppercase ? "⇙" : "↙"
	else if (binTest(input, KEY_INPUTS.left | KEY_INPUTS.up))
		char += uppercase ? "⇖" : "↖"
	else if (input & KEY_INPUTS.up) char += uppercase ? "U" : "u"
	else if (input & KEY_INPUTS.right) char += uppercase ? "R" : "r"
	else if (input & KEY_INPUTS.down) char += uppercase ? "D" : "d"
	else if (input & KEY_INPUTS.left) char += uppercase ? "L" : "l"
	else char += "-"
	return char
}

export function charToKeyInput(char: string): KeyInputs {
	let input = 0
	for (const modChar of char) {
		let keyInputs = charToKeyInputMap[modChar]
		input |= keyInputs
	}
	return input
}

export function splitRouteCharString(charString: string): string[] {
	return charString.split(/(?<![pcs])/)
}

export class RouteFileInputProvider extends InputProvider {
	route?: Route
	moves: string[]
	constructor(route: Route | string[]) {
		super()
		if ("Moves" in route) {
			this.moves = splitRouteCharString(route.Moves)
			const initSlide = route["Initial Slide"]
			// Some old versions of ExaCC wrote "Initial Slide" as a number enum value, which is now incorrect due to libnotcc changing how directions work
			if (typeof initSlide === "number") {
				const dirMap = {
					"0": Direction.UP,
					"1": Direction.RIGHT,
					"2": Direction.DOWN,
					"3": Direction.LEFT,
				}
				if (!(initSlide in dirMap))
					throw new Error("Invalid RFF direction numeric value")
				route["Initial Slide"] = dirMap[initSlide as unknown as "0"]
			} else if (typeof initSlide === "string") {
				if (!(initSlide in Direction))
					throw new Error("Invalid RFF direction name")
				route["Initial Slide"] = Direction[initSlide as unknown as "UP"]
			}
			this.route = route
		} else {
			this.moves = route
		}
	}
	getInput(curSubtick: number, seatIdx: number): KeyInputs {
		if (seatIdx !== 0)
			throw new Error("Routefiles don't support multiseat levels")
		if (subtickToTick(curSubtick) >= this.moves.length) return 0
		return charToKeyInput(this.moves[subtickToTick(curSubtick)])
	}
	setupLevel(level: Level): void {
		if (!this.route) return
		if (this.route["Initial Slide"] !== undefined) {
			level.randomForceFloorDirection = this.route["Initial Slide"]
		}
		if (this.route.Blobmod !== undefined) {
			level.rngBlob = this.route.Blobmod
		}
	}
	getLength(): number {
		return this.moves.length * 3
	}
}

export class ReplayInputProvider extends InputProvider {
	bonusTicks = 3600
	constructor(public replay: Replay) {
		super()
		replay._assert_live()
	}
	setupLevel(level: Level): void {
		level.randomForceFloorDirection = this.replay.randomForceFloorDirection
		level.rngBlob = this.replay.rngBlob
	}
	getInput(curSubtick: number, seatIdx: number): number {
		if (seatIdx !== 0) throw new Error("C2M replays don't support multiseat")
		let currentTick = Math.min(
			subtickToTick(curSubtick),
			this.replay.inputs.length - 1
		)
		return this.replay.inputs[currentTick]
	}
	getLength(): number {
		return this.replay.inputs.length * 3
	}
}
