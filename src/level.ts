import { Actor } from "./actor"
import { Field, Direction } from "./helpers"
import { KeyInputs } from "./pulse"
import { Playable } from "./actors/playables"
import Tile from "./tile"
import { Layers } from "./tile"
import { LevelData, CameraType } from "./encoder"
import { actorDB } from "./const"

export enum GameState {
	PLAYING,
	LOST,
	WON,
}

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

/**
 * The state of a level, used as a hub of realtime level properties, the most important one being `field`
 */

export class LevelState {
	playables: Playable[] = []
	selectedPlayable?: Playable
	gameState = GameState.PLAYING
	field: Field<Tile> = []
	actors: Actor[] = []
	subtick: 0 | 1 | 2 = 0
	currentTick = 0
	cameraType: CameraType = { width: 10, height: 10, screens: 1 }
	levelData?: LevelData
	chipsLeft = 0
	chipsTotal = 0
	chipsRequired = 0
	timeLeft = 0
	hintsLeft: string[] = []
	/**
	 * Connections of 2 tiles, used for CC1-style clone machine and trap connections
	 */
	connections: [[number, number], [number, number]][] = []
	protected decisionTick(forcedOnly = false): void {
		onLevelDecisionTick.forEach(val => val(this))
		for (const actor of this.actors) actor._internalDecide(forcedOnly)
	}
	protected moveTick(): void {
		for (const actor of this.actors) {
			actor._internalMove()
			actor._internalDoCooldown()
		}
	}
	/**
	 * Ticks the whole level by one subtick
	 * (Since there are 3 subticks in a tick, and 20 ticks in a second, this should be run 60 times a second)
	 */
	tick(): void {
		this.decisionTick(this.subtick !== 2)
		this.moveTick()
		//	if (this.playables.length === 0) this.lost = true
		if (this.subtick === 2) {
			this.currentTick++
			this.subtick = 0
			if (this.timeLeft !== 0) {
				this.timeLeft--
				if (this.timeLeft <= 0) this.gameState = GameState.LOST
			}
		} else this.subtick++
	}
	giveInput(input: KeyInputs): void {
		for (const i in this.playables) this.playables[i].lastInputs = input
	}
	constructor(public width: number, public height: number) {
		//Init field
		this.field = []
		for (let x = 0; x < width; x++) {
			this.field.push([])
			for (let y = 0; y < height; y++)
				this.field[x].push(new Tile(this, [x, y], []))
		}
		onLevelStart.forEach(val => val(this))
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
		const newTile = actor.tile.getNeighbor(direction)
		return newTile
			? this.checkCollisionToTile(actor, newTile, direction, pushBlocks)
			: false
	}
	/**
	 * Checks if a specific actor can move in a certain direction to a certain tile
	 * @param actor The actor to check for
	 * @param direction The direction the actor wants to enter the tile
	 * @param newTile The tile the actor wants to enter
	 * @param pushBlocks If true, it will push blocks
	 * @returns If the actor *can* move in that direction
	 */
	checkCollisionToTile(
		actor: Actor,
		newTile: Tile,
		direction: Direction,
		pushBlocks = false
	): boolean {
		// Do stuff on the leaving tile

		for (const exitActor of actor.tile.allActors)
			if (exitActor._internalExitBlocks(actor, direction)) {
				actor.onBlocked?.(exitActor)
				return false
			}

		const toPush: Actor[] = []

		// Do stuff on the entering tile
		for (const layer of [
			Layers.SPECIAL,
			Layers.STATIONARY,
			Layers.MOVABLE,
			Layers.ITEM,
			Layers.ITEM_SUFFIX,
		]) {
			for (const blockActor of newTile[layer]) {
				blockActor.bumped?.(actor, direction)
				actor.bumpedActor?.(blockActor, direction)
				if (!blockActor._internalBlocks(actor, direction)) continue
				if (pushBlocks && actor._internalCanPush(blockActor))
					toPush.push(blockActor)
				else return false
			}
		}
		for (const pushable of toPush) {
			if (pushable.slidingState) {
				pushable.pendingDecision = direction + 1
				// We did not move, shame, but we did queue this block push
				return false
			}
			if (!this.checkCollision(pushable, direction, true)) return false
			pushable.pendingDecision = direction + 1
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
}

export function createLevelFromData(data: LevelData): LevelState {
	const level = new LevelState(data.width, data.height)
	level.levelData = data
	if (data.hints) level.hintsLeft = [...data.hints]
	// TODO Misc data setting, like CC1 boots and stuff
	if (data.blobMode) {
		if (data.blobMode > 1)
			level.blobPrngValue = Math.floor(Math.random() * 0x100)
		level.blob4PatternsMode = data.blobMode === 4
	}
	level.cameraType = data.camera
	level.timeLeft = data.timeLimit * 20
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
	for (const actor of level.actors) actor.levelStarted?.()
	return level
}
