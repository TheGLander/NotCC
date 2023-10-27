import { Direction } from "./helpers.js"
import { LevelState } from "./level.js"
import { ISolutionInfo } from "./parsers/nccs.pb.js"

export interface KeyInputs {
	up: boolean
	down: boolean
	left: boolean
	right: boolean
	drop: boolean
	rotateInv: boolean
	switchPlayable: boolean
}

export type InputType = keyof KeyInputs

export const secondaryActions: InputType[] = [
	"drop",
	"rotateInv",
	"switchPlayable",
]

export function decodeSolutionStep(step: number): KeyInputs {
	return {
		up: (step & 0x1) > 0,
		right: (step & 0x2) > 0,
		down: (step & 0x4) > 0,
		left: (step & 0x8) > 0,
		drop: (step & 0x10) > 0,
		rotateInv: (step & 0x20) > 0,
		switchPlayable: (step & 0x40) > 0,
	}
}

export function encodeSolutionStep(input: KeyInputs): number {
	return (
		(input.up ? 0x01 : 0) +
		(input.right ? 0x02 : 0) +
		(input.down ? 0x04 : 0) +
		(input.left ? 0x08 : 0) +
		(input.drop ? 0x10 : 0) +
		(input.rotateInv ? 0x20 : 0) +
		(input.switchPlayable ? 0x40 : 0)
	)
}

export interface InputProvider {
	getInput(level: LevelState): KeyInputs
	outOfInput(level: LevelState): boolean
	setupLevel(level: LevelState): void
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

export class SolutionInfoInputProvider implements InputProvider {
	inputs: Uint8Array
	bonusTicks = 3600
	constructor(public solution: ISolutionInfo) {
		this.inputs = makeSimpleInputs(solution.steps![0])
	}
	getInput(level: LevelState): KeyInputs {
		let inputN =
			level.currentTick >= this.inputs.length
				? this.inputs.length - 1
				: level.currentTick
		return decodeSolutionStep(this.inputs[inputN])
	}
	outOfInput(level: LevelState): boolean {
		return level.currentTick >= this.inputs.length + this.bonusTicks
	}
	setupLevel(level: LevelState): void {
		const levelState = this.solution.levelState
		if (!levelState) return
		if (typeof levelState.randomForceFloorDirection === "number") {
			level.randomForceFloorDirection = levelState.randomForceFloorDirection - 1
		}
		const blobMod = levelState.cc2Data?.blobModifier
		if (typeof blobMod === "number") {
			level.blobPrngValue = blobMod
		}
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

const keyInputToCharMap: Record<InputType, string> = {
	up: "u",
	right: "r",
	down: "d",
	left: "l",
	switchPlayable: "s",
	rotateInv: "c",
	drop: "p",
}

const charToKeyInputMap: Record<string, InputType | InputType[]> = {
	u: "up",
	r: "right",
	d: "down",
	l: "left",
	p: "drop",
	c: "rotateInv",
	s: "switchPlayable",
	"↗": ["up", "right"],
	"↘": ["right", "down"],
	"↙": ["down", "left"],
	"↖": ["left", "up"],
}

export function areKeyInputsMoving(input: KeyInputs): boolean {
	return input.up || input.right || input.down || input.left
}

export function keyInputToChar(
	input: KeyInputs,
	uppercase: boolean,
	secondaryOnly = false
): string {
	let char = ""
	for (const keyInput of secondaryActions) {
		if (input[keyInput]) {
			char += keyInputToCharMap[keyInput]
		}
	}
	if (secondaryOnly) return char
	if (input.up && input.right) char += uppercase ? "⇗" : "↗"
	else if (input.right && input.down) char += uppercase ? "⇘" : "↘"
	else if (input.down && input.left) char += uppercase ? "⇙" : "↙"
	else if (input.left && input.up) char += uppercase ? "⇖" : "↖"
	else if (input.up) char += uppercase ? "U" : "u"
	else if (input.right) char += uppercase ? "R" : "r"
	else if (input.down) char += uppercase ? "D" : "d"
	else if (input.left) char += uppercase ? "L" : "l"
	else char += "-"
	return char
}

export function makeEmptyInputs(): KeyInputs {
	return {
		up: false,
		right: false,
		down: false,
		left: false,
		drop: false,
		rotateInv: false,
		switchPlayable: false,
	}
}

export function charToKeyInput(char: string): KeyInputs {
	const input = makeEmptyInputs()
	for (const modChar of char) {
		let keyInputs = charToKeyInputMap[modChar]
		if (!Array.isArray(keyInputs)) keyInputs = [keyInputs]
		for (const keyInput of keyInputs) {
			input[keyInput] = true
		}
	}
	return input
}

export function splitRouteCharString(charString: string): string[] {
	return charString.split(/(?<![pcs])/)
}

export class RouteFileInputProvider implements InputProvider {
	route?: Route
	moves: string[]
	constructor(route: Route | string[]) {
		if ("Moves" in route) {
			this.moves = splitRouteCharString(route.Moves)
			// Convert SuCC-style direction string enum value to the native integers we have in NotCC
			if (typeof route["Initial Slide"] === "string") {
				route["Initial Slide"] =
					Direction[route["Initial Slide"] as unknown as "UP"]
			}
		} else {
			this.moves = route
		}
	}
	getInput(level: LevelState): KeyInputs {
		if (level.currentTick >= this.moves.length) return makeEmptyInputs()
		return charToKeyInput(this.moves[level.currentTick])
	}
	outOfInput(level: LevelState): boolean {
		return level.currentTick >= this.moves.length
	}
	setupLevel(level: LevelState): void {
		if (!this.route) return
		if (this.route["Initial Slide"] !== undefined) {
			level.randomForceFloorDirection = this.route["Initial Slide"]
		}
		if (this.route.Blobmod !== undefined) {
			level.blobPrngValue = this.route.Blobmod
		}
	}
}
