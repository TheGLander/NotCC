import { Direction } from "../actor.js"
import { Level, Replay } from "../level.js"
import { C2GLevelModifiers, getC2GGameModifiers } from "./c2g.js"
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

export interface LevelModifiers extends C2GLevelModifiers {
	randomForceFloorDirection?: Direction
	blobMod?: number
}

export abstract class InputProvider {
	abstract getInput(curSubtick: number, seatIdx: number): KeyInputs
	abstract levelModifiers(): LevelModifiers
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
	levelModifiers(): LevelModifiers {
		const levelState = this.solution.levelState
		if (!levelState) return {}

		const levelInit: LevelModifiers = levelState.cc2Data?.scriptState
			? getC2GGameModifiers(levelState.cc2Data.scriptState)
			: {}

		if (typeof levelState.randomForceFloorDirection === "number") {
			levelInit.randomForceFloorDirection =
				levelState.randomForceFloorDirection as unknown as Direction
		}
		const blobMod = levelState.cc2Data?.blobModifier
		if (typeof blobMod === "number") {
			levelInit.blobMod = blobMod
		}
		return levelInit
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

export type RouteDirection = "UP" | "RIGHT" | "DOWN" | "LEFT"

export interface Route {
	Moves: string
	Rule: string
	Encode?: "UTF-8"
	"Initial Slide"?: RouteDirection
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
					"0": "UP",
					"1": "RIGHT",
					"2": "DOWN",
					"3": "LEFT",
				} as const
				if (!(initSlide in dirMap))
					throw new Error("Invalid RFF direction numeric value")
				route["Initial Slide"] = dirMap[initSlide]
			} else if (typeof initSlide === "string") {
				if (!(initSlide in Direction))
					throw new Error("Invalid RFF direction name")
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
	levelModifiers(): LevelModifiers {
		const levelMods: LevelModifiers = {}
		if (!this.route) return levelMods

		if (this.route["Initial Slide"] !== undefined) {
			levelMods.randomForceFloorDirection =
				Direction[this.route["Initial Slide"]]
		}
		if (this.route.Blobmod !== undefined) {
			levelMods.blobMod = this.route.Blobmod
		}
		return levelMods
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
	levelModifiers(): LevelModifiers {
		return {
			randomForceFloorDirection: this.replay
				.randomForceFloorDirection as Direction,
			blobMod: this.replay.rngBlob,
		}
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
	outOfInput(curSubtick: number): boolean {
		return curSubtick > this.getLength() + this.bonusTicks
	}
}

export function applyLevelModifiers(level: Level, modifiers: LevelModifiers) {
	if (modifiers.randomForceFloorDirection !== undefined) {
		level.randomForceFloorDirection = modifiers.randomForceFloorDirection
	}
	if (modifiers.blobMod !== undefined) {
		level.rngBlob = modifiers.blobMod
	}
	if (modifiers.timeLeft !== undefined) {
		level.timeLeft = modifiers.timeLeft * 60
	}
	let playerIdx = 0
	// Have to go in reading order
	for (let y = 0; y < level.height; y += 1) {
		for (let x = 0; x < level.width; x += 1) {
			const actor = level.getCell(x, y).actor
			if (
				!actor ||
				!(actor.type.name === "chip" || actor.type.name === "melinda")
			)
				continue
			// Yes, we start the actual player indexing at `1`, `0` means we don't use `enter` at all
			playerIdx += 1
			if (modifiers.inventoryTools) {
				actor.inventory.setItems(modifiers.inventoryTools)
			}
			if (modifiers.inventoryKeys) {
				actor.inventory.keysRed = modifiers.inventoryKeys.red
				actor.inventory.keysGreen = modifiers.inventoryKeys.green
				actor.inventory.keysBlue = modifiers.inventoryKeys.blue
				actor.inventory.keysYellow = modifiers.inventoryKeys.yellow
			}
			if (modifiers.playableEnterN && modifiers.playableEnterN !== playerIdx) {
				level.erase(actor)
			}
		}
	}
}
