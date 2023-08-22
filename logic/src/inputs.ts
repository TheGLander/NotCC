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

function makeSimpleInputs(comp: Uint8Array): Uint8Array {
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
		return level.currentTick >= this.inputs.length
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
