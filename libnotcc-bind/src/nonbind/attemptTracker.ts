import { KeyInputs } from "./inputs.js"
import { GameState, Level } from "../level.js"
import { protobuf } from "./nccs.js"
import { Direction } from "../actor.js"

// The two interfaces are structually equivalent, so just output both!
export function msToProtoTime(
	ms: number
): protobuf.google.protobuf.ITimestamp | protobuf.google.protobuf.IDuration {
	const seconds = Math.floor(ms / 1000)
	const micros = ms - seconds * 1000
	return {
		seconds,
		nanos: micros * 1000,
	}
}

export function protoTimeToMs(
	protoTime:
		| protobuf.google.protobuf.ITimestamp
		| protobuf.google.protobuf.IDuration
): number {
	return (protoTime.seconds ?? 0) * 1000 + (protoTime.nanos ?? 0) / 1000
}

export class StepRecorder {
	currentStep = -1

	attemptSteps: Uint8Array = new Uint8Array(100)
	constructor() {}
	reallocateStepArray(): void {
		let newLength = this.attemptSteps.length * 1.5
		// Makes sure we always have space to save the last time amount
		if (newLength % 2 === 1) newLength += 1
		const newArr = new Uint8Array(newLength)
		newArr.set(this.attemptSteps)
		this.attemptSteps = newArr
	}
	recordAttemptStep(input: KeyInputs): void {
		if (this.currentStep === -1) {
			this.attemptSteps[0] = input
			this.attemptSteps[1] = 1
			this.currentStep += 1
			return
		}
		let stepPos = this.currentStep * 2
		const lastStep = this.attemptSteps[stepPos]
		if (this.attemptSteps[stepPos + 1] >= 0xfa || input !== lastStep) {
			this.currentStep += 1
			stepPos += 2
			if (stepPos >= this.attemptSteps.length) {
				this.reallocateStepArray()
			}
			this.attemptSteps[stepPos] = input
		}

		this.attemptSteps[stepPos + 1] += 1
	}
	finalizeSteps() {
		return this.attemptSteps.slice(0, this.currentStep * 2 + 1)
	}
}

export class AttemptTracker {
	currentAttempt: protobuf.IAttemptInfo
	attemptStartTime: number = Date.now()
	stepRecorders: StepRecorder[]
	constructor(
		playerN: number,
		blobMod: number,
		randomForceFloorDirection: Direction,
		scriptState?: protobuf.IScriptState
	) {
		this.stepRecorders = []
		for (let idx = 0; idx < playerN; idx += 1) {
			this.stepRecorders.push(new StepRecorder())
		}
		this.currentAttempt = {
			attemptStart: msToProtoTime(Date.now()),
			solution: {
				levelState: {
					randomForceFloorDirection:
						randomForceFloorDirection as 0 as protobuf.ProtoDirection,
					cc2Data: { blobModifier: blobMod, scriptState },
				},
			},
		}
	}
	recordAttemptStep(level: Level) {
		const seats = level.playerSeats
		for (let idx = 0; idx < seats.length; idx += 1) {
			this.stepRecorders[idx].recordAttemptStep(seats[idx].inputs)
		}
	}
	endAttempt(level: Level): protobuf.IAttemptInfo {
		if (
			!this.currentAttempt ||
			!this.currentAttempt.solution ||
			this.attemptStartTime === undefined
		)
			throw new Error("The attempt must start before it can end.")
		this.currentAttempt.attemptLength = msToProtoTime(
			Date.now() - this.attemptStartTime
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
			// FIXME: Add `Level.death_reason`
			// this.currentAttempt.failReason = level.selectedPlayable?.deathReason
		} else {
			this.currentAttempt.solution!.outcome = {
				bonusScore: level.bonusPoints,
				timeLeft: msToProtoTime(level.timeLeft * (1000 / 60)),
				absoluteTime: msToProtoTime(level.msecsPassed()),
			}
			this.currentAttempt.solution!.steps = this.stepRecorders.map(rec =>
				rec.finalizeSteps()
			)
			this.currentAttempt.solution!.usedGlitches = Array.from(
				level.glitches,
				glitch => glitch.toGlitchInfo()
			)
		}

		return this.currentAttempt
	}
}
