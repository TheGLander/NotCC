import { CrossLevelDataInterface, KeyInputs, encodeSolutionStep } from "./level"
import { GameState } from "./level"
import { LevelState } from "./level"
import { crossLevelData } from "./level"
import {
	IAttemptInfo,
	ILevelStateInfo,
	IScriptState,
	google,
} from "./parsers/nccs.pb"

// The two interfaces are structually equivalent, so just output both!
export function msToProtoTime(
	ms: number
): google.protobuf.ITimestamp | google.protobuf.IDuration {
	const seconds = Math.floor(ms / 1000)
	const micros = ms - seconds * 1000
	return {
		seconds,
		nanos: micros * 1000,
	}
}

export function makeLevelStateInfo(
	blobMod: number,
	scriptState?: IScriptState,
	globalState: CrossLevelDataInterface = crossLevelData
): ILevelStateInfo {
	return {
		randomForceFloorDirection: globalState.RFFDirection + 1,
		cc2Data: { blobModifier: blobMod, scriptState },
	}
}

export class AttemptTracker {
	currentAttempt: IAttemptInfo
	attemptStartTime: number = performance.now()
	currentStep = -1

	attemptSteps: Uint8Array = new Uint8Array(100)
	constructor(blobMod: number, scriptState?: IScriptState) {
		this.currentAttempt = {
			attemptStart: msToProtoTime(Date.now()),
			solution: { levelState: makeLevelStateInfo(blobMod, scriptState) },
		}
	}
	reallocateStepArray(): void {
		if (!this.attemptSteps)
			throw new Error(
				"Can't reallocate the step array due to no current attempt.."
			)

		const newArr = new Uint8Array(this.attemptSteps.length * 1.5)
		newArr.set(this.attemptSteps)
		this.attemptSteps = newArr
	}
	recordAttemptStep(keyInput: KeyInputs): void {
		if (!this.attemptSteps)
			throw new Error("Can't record steps without the steps array set.")
		const input = encodeSolutionStep(keyInput)
		if (this.currentStep === -1) {
			this.attemptSteps[0] = input
			this.attemptSteps[1] = 1
			this.currentStep += 1
		} else {
			let stepPos = this.currentStep * 2
			const lastStep = this.attemptSteps[stepPos]
			if (this.attemptSteps[stepPos + 1] >= 0xfc || input !== lastStep) {
				this.currentStep += 1
				stepPos += 2
				if (stepPos >= this.attemptSteps.length) {
					this.reallocateStepArray()
				}
				this.attemptSteps[stepPos] = input
			}

			this.attemptSteps[stepPos + 1] += 1
		}
	}
	endAttempt(level: LevelState): IAttemptInfo {
		if (
			!this.currentAttempt ||
			!this.currentAttempt.solution ||
			this.attemptStartTime === undefined
		)
			throw new Error("The attempt must start before it can end.")
		this.currentAttempt.attemptLength = msToProtoTime(
			performance.now() - this.attemptStartTime
		)
		if (level.gameState !== GameState.WON) {
			// If we didn't win, scrap the solution info
			delete this.currentAttempt.solution
		}
		if (level.gameState === GameState.PLAYING) {
			// Noop when the attempt is ended prematurely
		} else if (level.gameState === GameState.TIMEOUT) {
			this.currentAttempt.failReason = "time"
		} else if (level.gameState === GameState.DEATH) {
			this.currentAttempt.failReason = level.selectedPlayable?.deathReason
		} else {
			this.currentAttempt.solution!.outcome = {
				bonusScore: level.bonusPoints,
				timeLeft: msToProtoTime(level.timeLeft * (1000 / 60)),
				absoluteTime: msToProtoTime(
					(level.timeLeft * 3 + level.subtick) * (1000 / 60)
				),
			}
		}
		this.currentAttempt.solution!.steps = [
			this.attemptSteps.slice(this.currentStep * 2),
		]

		return this.currentAttempt
	}
}
