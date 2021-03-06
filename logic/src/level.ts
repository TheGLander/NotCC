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
	despawnedActors?: Actor[]
}

export const crossLevelData: CrossLevelDataInterface = { despawnedActors: [] }

export const onLevelStart: ((level: LevelState) => void)[] = [
	level => {
		if (!crossLevelData.despawnedActors) return
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
		}
	},
]

export const debouncedInputs = ["drop", "rotateInv", "switchPlayable"] as const
export const debouncePeriod = 50 // Debounce period in subticks

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
	gameInput: KeyInputs = {
		up: false,
		down: false,
		left: false,
		right: false,
		drop: false,
		rotateInv: false,
		switchPlayable: false,
	}
	/**
	 * Inputs which should not be counted
	 */
	debouncedInputs: Record<typeof debouncedInputs[number], number> = {
		drop: 0,
		rotateInv: 0,
		switchPlayable: 0,
	}
	/**
	 * Connections of 2 tiles, used for CC1-style clone machine and trap connections
	 */
	connections: [[number, number], [number, number]][] = []
	protected decisionTick(forcedOnly = false): void {
		onLevelDecisionTick.forEach(val => val(this))
		for (const actor of this.decidingActors) actor._internalDecide(forcedOnly)
	}
	protected moveTick(): void {
		for (const actor of this.decidingActors) {
			actor._internalMove()
			actor._internalDoCooldown()
		}
	}
	/**
	 * Ticks the whole level by one subtick
	 * (Since there are 3 subticks in a tick, and 20 ticks in a second, this should be run 60 times a second)
	 */
	tick(): void {
		if (!this.levelStarted) {
			this.levelStarted = true
			for (const actor of this.actors) actor.levelStarted?.()
			onLevelStart.forEach(val => val(this))
			for (const actor of this.actors)
				if (actor.newActorOnTile)
					for (const actorNeigh of actor.tile.allActors)
						if (actorNeigh !== actor && !actor._internalIgnores(actorNeigh))
							actor.newActorOnTile(actorNeigh)
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
		this.decisionTick(this.subtick !== 2)
		this.moveTick()
		//	if (this.playables.length === 0) this.lost = true
		if (this.subtick === 2) {
			this.currentTick++
			this.subtick = 0
		} else this.subtick++
		if (this.timeLeft !== 0) {
			this.timeLeft--
			if (this.timeLeft <= 0) this.gameState = GameState.LOST
		}
		for (const debouncedKey of debouncedInputs)
			if (!this.gameInput[debouncedKey]) this.debouncedInputs[debouncedKey] = 0
			else if (this.debouncedInputs[debouncedKey] === 0)
				this.debouncedInputs[debouncedKey] = debouncePeriod
			else if (this.debouncedInputs[debouncedKey] !== -1) {
				if (this.debouncedInputs[debouncedKey] === 1)
					this.debouncedInputs[debouncedKey]--
				this.debouncedInputs[debouncedKey]--
			}
		onLevelAfterTick.forEach(val => val(this))
	}
	debounceInput(inputType: typeof debouncedInputs[number]): void {
		if (this.debouncedInputs[inputType] !== -1)
			this.debouncedInputs[inputType] = debouncePeriod
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
		pushBlocks = false
	): boolean {
		return this.checkCollisionFromTile(actor, actor.tile, direction, pushBlocks)
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
		pushBlocks = false
	): boolean {
		// This is a pass by reference-esque thing, please don't die of cring
		this.resolvedCollisionCheckDirection = direction

		// Do stuff on the leaving tile

		for (const exitActor of Array.from(fromTile.allActors).reverse())
			if (exitActor._internalExitBlocks(actor, direction)) {
				actor.onBlocked?.(exitActor)
				return false
			} else {
				const redirection = exitActor.redirectTileMemberDirection?.(
					actor,
					direction
				)
				if (redirection === undefined) continue
				if (redirection === null) return false
				this.resolvedCollisionCheckDirection = direction = redirection
			}
		const newTile = fromTile.getNeighbor(direction)
		if (newTile === null) return false

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
				actor.bumpedActor?.(blockActor, direction)
				if (blockActor._internalBlocks(actor, direction))
					if (actor._internalCanPush(blockActor, direction))
						toPush.push(blockActor)
					else return false
				if (
					(layer === Layer.ITEM_SUFFIX || layer === Layer.MOVABLE) &&
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
				return false
			}
			if (!this.checkCollision(pushable, direction, pushBlocks)) return false
			if (pushBlocks) {
				pushable._internalStep(direction)
				pushable.cooldown--
			}
		}
		// TODO Decision time hooking
		return true
	}
	prngValue1 = 0
	prngValue2 = 0
	random(): number {
		let n = (this.prngValue1 >> 2) - this.prngValue1
		if (!(this.prngValue1 & 0x02)) n--
		this.prngValue1 = (this.prngValue1 >> 1) | (this.prngValue2 & 0x80)
		this.prngValue2 = (this.prngValue2 << 1) | (n & 0x01)
		return (this.prngValue1 ^ this.prngValue2) & 0xff
	}
	blobPrngValue = 0x55
	blob4PatternsMode = false
	blobMod(): number {
		if (this.blob4PatternsMode) {
			this.blobPrngValue++
			this.blobPrngValue %= 4
		} else {
			this.blobPrngValue *= 2
			if (this.blobPrngValue < 255) this.blobPrngValue ^= 0x1d
			this.blobPrngValue &= 255
		}
		return this.blobPrngValue
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
		if (solution.blobModSeed) this.blobPrngValue = solution.blobModSeed
		if (solution.rffDirection)
			crossLevelData.RFFDirection = solution.rffDirection
	}
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
	for (let y = level.height - 1; y >= 0; y--)
		for (let x = level.width - 1; x >= 0; x--)
			for (const actor of data.field[x][y]) {
				if (!actorDB[actor[0]])
					throw new Error(`Cannot find actor with id "${actor[0]}"!`)
				const actorInstance: Actor = new actorDB[actor[0]](
					level,
					[x, y],
					actor[2]
				)
				if (actor[1]) actorInstance.direction = actor[1]
			}
	return level
}
