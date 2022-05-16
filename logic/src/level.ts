import { Actor } from "./actor"
import { Field, Direction } from "./helpers"
import { Playable } from "./actors/playables"
import Tile from "./tile"
import { Layer } from "./tile"
import {
	LevelData,
	CameraType,
	SolutionData,
	SolutionStep,
	SolutionDataWithSteps,
} from "./encoder"
import { actorDB } from "./const"
import { hasSteps } from "./encoder"
import { iterableIndexOf } from "./iterableHelpers"
import { buildCircuits, CircuitCity, isWired, Wirable, wireTick } from "./wires"

export enum GameState {
	PLAYING,
	LOST,
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
				// TODO Have some custom modals, alerts are disgusting
				alert(
					"!!WARNING!!\nNormally, the game would crash at this point, so this is really undefined behavior."
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
			//actor.tile.addActors(actor)
		}
	},
]
export const onLevelDecisionTick: ((level: LevelState) => void)[] = []
export const onLevelAfterTick: ((level: LevelState) => void)[] = [
	level => {
		if (level.playablesToSwap && level.selectedPlayable) {
			level.selectedPlayable =
				level.playables[
					(level.playables.indexOf(level.selectedPlayable) + 1) %
						level.playables.length
				]
			level.playablesToSwap = false
			level.releasedKeys.drop = level.releasedKeys.rotateInv = false
		}
	},
]

export const releasableKeys = ["drop", "rotateInv", "switchPlayable"] as const
type ReleasableKeys = typeof releasableKeys[number]

export function decodeSolutionStep(step: SolutionStep): KeyInputs {
	return {
		up: (step[0] & 0x1) > 0,
		right: (step[0] & 0x2) > 0,
		down: (step[0] & 0x4) > 0,
		left: (step[0] & 0x8) > 0,
		drop: (step[0] & 0x10) > 0,
		rotateInv: (step[0] & 0x20) > 0,
		switchPlayable: (step[0] & 0x40) > 0,
	}
}

export function encodeSolutionStep(input: KeyInputs): SolutionStep {
	return [
		(input.up ? 0x01 : 0) +
			(input.right ? 0x02 : 0) +
			(input.down ? 0x04 : 0) +
			(input.left ? 0x08 : 0) +
			(input.drop ? 0x10 : 0) +
			(input.rotateInv ? 0x20 : 0) +
			(input.switchPlayable ? 0x40 : 0),
		0,
	]
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
	 * Inputs which should not be counted
	 */
	/*debouncedInputs: Record<typeof debouncedInputs[number], number> = {
		drop: 0,
		rotateInv: 0,
		switchPlayable: 0,
	} */
	/**
	 * Connections of 2 tiles, used for CC1-style clone machine and trap connections
	 */
	connections: [[number, number], [number, number]][] = []
	timeFrozen = false
	protected decisionTick(forcedOnly = false): void {
		onLevelDecisionTick.forEach(val => val(this))
		for (const actor of Array.from(this.decidingActors)) {
			if (!actor.exists) continue
			actor._internalDecide(forcedOnly)
		}
	}
	protected moveTick(): void {
		for (const actor of Array.from(this.decidingActors)) {
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
			this.levelStarted = true
			buildCircuits.apply(this)
			for (const actor of Array.from(this.actors)) {
				actor.levelStarted?.()
				actor.onCreation?.()
			}
			onLevelStart.forEach(val => val(this))
		} else {
			if (this.subtick === 2) {
				this.currentTick++
				this.subtick = 0
			} else this.subtick++
		}
		if (this.solutionSubticksLeft >= 0 && this.currentSolution) {
			let step = this.currentSolution.steps[0][this.solutionStep]
			this.solutionSubticksLeft--
			if (this.solutionSubticksLeft <= 0) {
				this.solutionStep++
				step = this.currentSolution.steps[0][this.solutionStep]
				this.solutionSubticksLeft = step?.[1] ?? Infinity
			}
			if (step) this.gameInput = decodeSolutionStep(step)
		}
		this.tickStage = "decision"
		this.decisionTick(this.subtick !== 2)
		this.tickStage = "move"
		this.moveTick()
		this.tickStage = "wire"
		wireTick.apply(this)
		//	if (this.playables.length === 0) this.lost = true

		if (this.timeLeft !== 0 && !this.timeFrozen) {
			this.timeLeft--
			if (this.timeLeft <= 0) this.gameState = GameState.LOST
		}
		/*for (const debouncedKey of debouncedInputs)
			if (!this.gameInput[debouncedKey]) this.debouncedInputs[debouncedKey] = 0
			else if (this.debouncedInputs[debouncedKey] > 0) {
				if (this.debouncedInputs[debouncedKey] === 1)
					this.debouncedInputs[debouncedKey]--
				this.debouncedInputs[debouncedKey]--
			} */
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
	constructor(public width: number, public height: number) {
		//Init field
		this.field = []
		for (let x = 0; x < width; x++) {
			this.field.push([])
			for (let y = 0; y < height; y++)
				this.field[x].push(new Tile(this, [x, y], []))
		}
	}
	/**
	 * Checks if a specific actor can move in a certain direction
	 * @param actor The actor to check for
	 * @param direction The direction the actor wants to move in
	 * @param pushBlocks If true, it will push blocks
	 * @returns If the actor *can* move in that direction
	 */
	checkCollision(
		actor: Actor,
		direction: Direction,
		pushBlocks = true,
		exitOnly = false
	): boolean {
		return this.checkCollisionFromTile(
			actor,
			actor.tile,
			direction,
			pushBlocks,
			exitOnly
		)
	}
	resolvedCollisionCheckDirection: Direction = Direction.UP
	/**
	 * Checks if a specific actor can move in a certain direction to a certain tile
	 * @param actor The actor to check for
	 * @param direction The direction the actor wants to enter the tile
	 * @param fromTile The tile the actor is coming from
	 * @param pushBlocks If true, it will push blocks
	 * @returns If the actor *can* move in that direction
	 */
	checkCollisionFromTile(
		actor: Actor,
		fromTile: Tile,
		direction: Direction,
		pushBlocks = true,
		exitOnly = false
	): boolean {
		// This is a pass by reference-esque thing, please don't die of cring
		this.resolvedCollisionCheckDirection = direction

		// Do stuff on the leaving tile

		for (const exitActor of fromTile.allActorsReverse)
			if (exitActor._internalExitBlocks(actor, direction)) {
				if (exitOnly && !exitActor.persistOnExitOnlyCollision) continue
				exitActor.bumped?.(actor, direction)
				actor.bumpedActor?.(exitActor, direction, true)
				return false
			} else {
				if (
					!exitActor.redirectTileMemberDirection ||
					actor._internalIgnores(exitActor)
				)
					continue
				const redirection = exitActor.redirectTileMemberDirection(
					actor,
					direction
				)
				if (redirection === null) return false
				actor.onRedirect?.((redirection - direction + 4) % 4)
				this.resolvedCollisionCheckDirection = direction = redirection
			}
		if (exitOnly) return true
		const newTile = fromTile.getNeighbor(direction, false)
		if (newTile === null) {
			actor.bumpedEdge?.(fromTile, direction)
			return false
		}

		const toPush: Actor[] = []

		// Do stuff on the entering tile
		loop: for (const layer of [
			Layer.ITEM_SUFFIX,
			Layer.SPECIAL,
			Layer.STATIONARY,
			Layer.MOVABLE,
			Layer.ITEM,
		])
			for (const blockActor of newTile[layer]) {
				blockActor.bumped?.(actor, direction)
				actor.bumpedActor?.(blockActor, direction, false)
				if (blockActor._internalBlocks(actor, direction))
					if (actor._internalCanPush(blockActor, direction))
						toPush.push(blockActor)
					else {
						this.resolvedCollisionCheckDirection = direction
						return false
					}
				if (
					layer === Layer.MOVABLE &&
					iterableIndexOf(newTile[layer], blockActor) ===
						newTile.layerLength(layer) - 1
				)
					// This is dumb
					break loop
			}

		for (const pushable of toPush) {
			if (pushable.slidingState) {
				pushable.pendingDecision = direction + 1
				// We did not move, shame, but we did queue this block push
				this.resolvedCollisionCheckDirection = direction
				return false
			}

			if (
				pushable.cooldown ||
				!this.checkCollision(pushable, direction, pushBlocks)
			) {
				this.resolvedCollisionCheckDirection = direction
				return false
			}
			if (pushBlocks) {
				if (pushable._internalStep(direction)) pushable.cooldown--
			}
		}
		this.resolvedCollisionCheckDirection = direction
		// TODO Decision time hooking
		return true
	}
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
	currentSolution?: SolutionDataWithSteps
	solutionStep = 0
	solutionSubticksLeft = 0
	playbackSolution(solution: SolutionData): void {
		if (!hasSteps(solution)) throw new Error("The solution must have steps!")
		this.currentSolution = solution
		// TODO Multiplayer
		this.solutionStep = 0
		this.solutionSubticksLeft = solution.steps[0][0][1] + 1
		if (solution.blobModSeed !== undefined)
			this.blobPrngValue = solution.blobModSeed
		if (solution.rffDirection !== undefined)
			crossLevelData.RFFDirection = solution.rffDirection
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
	level.timeLeft = data.timeLimit * 60
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
