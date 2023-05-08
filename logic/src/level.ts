import { Actor } from "./actor.js"
import { Field, Direction } from "./helpers.js"
import { Playable } from "./actors/playables.js"
import { Tile } from "./tile.js"
import { Layer } from "./tile.js"
import type { LevelData, CameraType } from "./parsers/c2m.js"
import { actorDB, Decision } from "./const.js"
import { iterableIndexOf, iterableSome } from "./iterableHelpers.js"
import {
	buildCircuits,
	CircuitCity,
	isWired,
	Wirable,
	wirePretick,
	wireTick,
} from "./wires.js"
import { ISolutionInfo } from "./parsers/nccs.pb.js"

export enum GameState {
	PLAYING,
	DEATH,
	TIMEOUT,
	WON,
}

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

// TODO Blue teleport gate madness
export interface CrossLevelDataInterface {
	despawnedActors: Actor[]
}

export const crossLevelData: CrossLevelDataInterface = {
	despawnedActors: [],
	RFFDirection: 0,
	greenButtonPressed: false,
	blueButtonPressed: false,
	currentYellowButtonPress: 0,
	logicGateTeleportPurgatory: [],
}

export const onLevelStart: ((level: LevelState) => void)[] = [
	level => {
		let undefinedBehaviorWarningGiven = false
		for (const actor of crossLevelData.despawnedActors) {
			if (
				(actor.tile.position[0] >= level.width ||
					actor.tile.position[1] >= level.height) &&
				!undefinedBehaviorWarningGiven
			) {
				console.warn(
					"Actors respawning outside of the map is undefined behaviour."
				)
				undefinedBehaviorWarningGiven = true
			}
			actor.level = level
			level.actors.push(actor)
			if (actor.isDeciding) level.decidingActors.push(actor)
			actor.tile.removeActors(actor)
			actor.oldTile = null
			actor.tile = level.field[actor.tile.position[0]][actor.tile.position[1]]
			if (actor instanceof Playable) level.playables.push(actor)
			// Note that we don't add the actor to the tile: That's the whole point of despawning
			// actor.tile.addActors(actor)
		}
	},
]
export const onLevelDecisionTick: ((level: LevelState) => void)[] = []
export const onLevelWireTick: ((level: LevelState) => void)[] = []
export const onLevelAfterTick: ((level: LevelState) => void)[] = []

onLevelDecisionTick.push(level => {
	if (!level.selectedPlayable) return
	if (level.subtick !== 2) return
	if (
		level.selectedPlayable.cooldown > 0 ||
		level.selectedPlayable.playerBonked ||
		level.selectedPlayable.isPushing
	) {
		level.selectedPlayable.lastDecision = level.selectedPlayable.direction + 1
	} else {
		level.selectedPlayable.lastDecision = Decision.NONE
	}
})

export const releasableKeys = ["drop", "rotateInv", "switchPlayable"] as const
type ReleasableKeys = (typeof releasableKeys)[number]

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

/**
 * The state of a level, used as a hub of realtime level properties, the most important one being `field`
 */

export class LevelState {
	playables: Playable[] = []
	selectedPlayable?: Playable
	gameState = GameState.PLAYING
	field: Field<Tile> = []
	actors: Actor[] = []
	decidingActors: Actor[] = []
	subtick: 0 | 1 | 2 = 0
	currentTick = 0
	tickStage: "decision" | "move" | "wire" | "start" = "start"
	cameraType: CameraType = { width: 10, height: 10, screens: 1 }
	levelData?: LevelData
	chipsLeft = 0
	chipsTotal = 0
	chipsRequired = 0
	timeLeft = 0
	bonusPoints = 0
	hintsLeft: string[] = []
	defaultHint?: string
	hintsLeftInLevel = 0
	playablesLeft = 0
	playablesToSwap = false
	levelStarted = false
	createdN = 0
	/**
	 * If a level is considered to be in extended mode, despawns don't happen and multiple actors of the same layer can be on the same tile, yay!
	 */
	extendedMode = false
	gameInput: KeyInputs = {
		up: false,
		down: false,
		left: false,
		right: false,
		drop: false,
		rotateInv: false,
		switchPlayable: false,
	}
	releasedKeys: Record<ReleasableKeys, boolean> = {
		drop: false,
		rotateInv: false,
		switchPlayable: false,
	}
	/**
	 * Connections of 2 tiles, used for CC1-style clone machine and trap connections
	 */
	connections: [[number, number], [number, number]][] = []
	timeFrozen = false
	protected decisionTick(forcedOnly = false): void {
		onLevelDecisionTick.forEach(val => val(this))
		for (let actor of Array.from(this.decidingActors)) {
			while (actor.newActor) actor = actor.newActor
			if (!actor.exists) continue
			actor._internalDecide(forcedOnly)
		}
	}
	protected moveTick(): void {
		for (let actor of Array.from(this.decidingActors)) {
			while (actor.newActor) actor = actor.newActor
			if (!actor.exists) continue
			actor._internalMove()
			actor._internalDoCooldown()
		}
	}
	getTime(): string {
		return `${this.currentTick}:${this.subtick} (${this.tickStage})`
	}
	/**
	 * Ticks the whole level by one subtick
	 * (Since there are 3 subticks in a tick, and 20 ticks in a second, this should be run 60 times a second)
	 */
	tick(): void {
		if (!this.levelStarted) {
			this.initializeLevel()
		} else {
			if (this.subtick === 2) {
				this.currentTick++
				this.subtick = 0
			} else this.subtick++
		}
		if (this.timeLeft !== 0 && !this.timeFrozen) {
			this.timeLeft--
			if (this.timeLeft <= 0) this.gameState = GameState.TIMEOUT
		}
		if (this.solutionSteps) {
			this.gameInput = this.getSolutionMove() ?? decodeSolutionStep(0)
		}
		wirePretick.apply(this)
		this.tickStage = "decision"
		this.decisionTick(this.subtick !== 2)
		this.tickStage = "move"
		this.moveTick()
		this.tickStage = "wire"
		onLevelWireTick.forEach(val => val(this))
		wireTick.apply(this)
		//	if (this.playables.length === 0) this.lost = true
		/*for (const debouncedKey of debouncedInputs)
			if (!this.gameInput[debouncedKey]) this.debouncedInputs[debouncedKey] = 0
			else if (this.debouncedInputs[debouncedKey] > 0) {
				if (this.debouncedInputs[debouncedKey] === 1)
					this.debouncedInputs[debouncedKey]--
				this.debouncedInputs[debouncedKey]--
			} */

		if (this.playablesLeft <= 0) this.gameState = GameState.WON
		for (const releasable of releasableKeys) {
			if (!this.gameInput[releasable]) this.releasedKeys[releasable] = false
		}
		onLevelAfterTick.forEach(val => val(this))
	}
	/*
	debounceInput(inputType: typeof debouncedInputs[number]): void {
		if (this.debouncedInputs[inputType] !== -1)
			this.debouncedInputs[inputType] = debouncePeriod
	} */

	initializeLevel(): void {
		this.levelStarted = true
		buildCircuits.apply(this)
		for (const actor of Array.from(this.actors)) {
			actor.levelStarted?.()
			actor.onCreation?.()
			actor.noSlidingBonk = iterableSome(
				actor.tile.allActors,
				val => !!val.slidingPlayableShouldntBonk
			)
			if (actor.noSlidingBonk && actor instanceof Playable)
				actor.hasOverride = true
		}
		onLevelStart.forEach(val => val(this))
	}
	getSolutionMove(): KeyInputs | null {
		if (this.solutionSubticksLeft < 0 || !this.solutionSteps) return null

		this.solutionSubticksLeft -= 1
		if (this.solutionSubticksLeft <= 0) {
			this.solutionStep += 1
			// If there's no time specified, keep holding it
			const isInfinite = this.solutionStep * 2 + 1 >= this.solutionSteps.length
			this.solutionSubticksLeft = isInfinite
				? Infinity
				: this.solutionSteps[this.solutionStep * 2 + 1]
		}
		const step = this.solutionSteps[this.solutionStep * 2]
		return decodeSolutionStep(step)
	}

	constructor(public width: number, public height: number) {
		//Init field
		this.field = []
		for (let x = 0; x < width; x++) {
			this.field.push([])
			for (let y = 0; y < height; y++)
				this.field[x].push(new Tile(this, [x, y], []))
		}
	}

	resolvedCollisionCheckDirection: Direction = Direction.UP
	prngValue1 = 0
	prngValue2 = 0
	random(): number {
		let n = (this.prngValue1 >> 2) - this.prngValue1
		if (!(this.prngValue1 & 0x02)) n--
		this.prngValue1 = ((this.prngValue1 >> 1) | (this.prngValue2 & 0x80)) & 0xff
		this.prngValue2 = ((this.prngValue2 << 1) | (n & 0x01)) & 0xff
		return this.prngValue1 ^ this.prngValue2
	}
	blobPrngValue = 0x55
	blob4PatternsMode = false
	blobMod(): number {
		let mod = this.blobPrngValue
		if (this.blob4PatternsMode) {
			mod++
			mod %= 4
		} else {
			mod *= 2
			if (mod < 255) mod ^= 0x1d
			mod &= 0xff
		}
		this.blobPrngValue = mod
		return mod
	}
	solutionSteps?: Uint8Array
	solutionStep = 0
	solutionSubticksLeft = 0
	playbackSolution(solution: ISolutionInfo): void {
		if (!solution.steps)
			throw new Error("A solution must have sets to play it back.")

		this.solutionSteps = solution.steps[0]
		// TODO Multiplayer
		this.solutionStep = 0
		this.solutionSubticksLeft = this.solutionSteps[1] + 1
		const levelState = solution.levelState
		if (!levelState) return
		if (typeof levelState.randomForceFloorDirection === "number") {
			crossLevelData.RFFDirection = levelState.randomForceFloorDirection - 1
		}
		const blobMod = levelState.cc2Data?.blobModifier
		if (typeof blobMod === "number") {
			this.blobPrngValue = blobMod
		}
	}
	getHint(): string | null {
		if (!this.selectedPlayable) return null
		const hintedActor = this.selectedPlayable.tile.findActor(
			actor => "hint" in actor && !!actor.hint
		)
		if (!hintedActor) return null
		return (hintedActor as any).hint
	}
	*tiles(
		rro = true,
		relativeTo: [number, number] = [0, 0]
	): Generator<Tile, void> {
		const stopAt = relativeTo[0] + relativeTo[1] * this.width
		for (
			let pos =
				(stopAt + (rro ? this.width * this.height - 1 : +1)) %
				(this.width * this.height);
			pos !== stopAt;
			rro
				? (pos =
						(pos + this.width * this.height - 1) % (this.width * this.height))
				: (pos = (pos + 1) % (this.width * this.height))
		)
			yield this.field[pos % this.width][Math.floor(pos / this.width)]
		yield this.field[relativeTo[0]][relativeTo[1]]
	}
	circuits: CircuitCity[] = []
	circuitInputs: Actor[] = []
	circuitOutputs: Wirable[] = []
	circuitOutputStates: Map<Wirable, boolean> = new Map()
}

export function createLevelFromData(data: LevelData): LevelState {
	const level = new LevelState(data.width, data.height)
	level.levelData = data
	if (data.hints) level.hintsLeft = [...data.hints]
	if (data.defaultHint) level.defaultHint = data.defaultHint
	// TODO Misc data setting, like CC1 boots and stuff
	if (data.blobMode) {
		if (data.blobMode > 1)
			level.blobPrngValue = Math.floor(Math.random() * 0x100)
		level.blob4PatternsMode = data.blobMode === 4
	}
	level.cameraType = data.camera
	level.timeLeft = Math.max(0, data.timeLimit * 60 - 1)
	if (data.playablesRequiredToExit !== "all")
		level.playablesLeft = data.playablesRequiredToExit
	if (data.extraChipsRequired) level.chipsRequired = data.extraChipsRequired
	if (data.connections) level.connections = data.connections
	for (let y = 0; y < level.height; y++)
		for (let x = 0; x < level.width; x++)
			for (const actor of data.field[x][y]) {
				if (!actor[0]) {
					if (actor[3]) {
						const tile = level.field[x][y]
						tile.wires = actor[3] & 0x0f
						tile.wireTunnels = (actor[3] & 0xf0) >> 4
					}
					continue
				}
				if (!actorDB[actor[0]])
					throw new Error(`Cannot find actor with id "${actor[0]}"!`)
				const actorInstance: Actor = new actorDB[actor[0]](
					level,
					[x, y],
					actor[2],
					actor[1]
				)

				if (actor[3]) {
					actorInstance.wires = actor[3] & 0x0f
					actorInstance.wireTunnels = actor[3] & 0xf0
				}
			}

	return level
}
