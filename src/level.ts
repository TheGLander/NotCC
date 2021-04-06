import { Actor } from "./actor"
import { Field, Direction } from "./helpers"
import { KeyInputs } from "./pulse"
import { Playable } from "./actors/playables"
import Tile from "./tile"
import { Layers } from "./tile"
import { LevelData, CameraType } from "./encoder"
import { actorDB } from "./const"
/**
 * The state of a level, used as a hub of realtime level properties, the most important one being `field`
 */

export class LevelState {
	playables: Playable[] = []
	selectedPlayable?: Playable
	lost = false
	field: Field<Tile> = []
	activeActors: Actor[] = []
	subtick: 0 | 1 | 2 = 0
	currentTick = 0
	cameraType: CameraType = { width: 10, height: 10, screens: 1 }
	destroyedThisTick: Actor[] = []
	protected decisionTick(forcedOnly = false): void {
		for (const actor of this.activeActors) actor._internalDecide(forcedOnly)
	}
	protected moveTick(): void {
		for (const actor of this.activeActors) {
			actor._internalMove()
			actor._internalDoCooldown()
		}
	}
	/**
	 * Ticks the whole level by one subtick
	 * (Since there are 3 subticks in a tick, and 20 ticks in a second, this should be run 60 times a second)
	 */
	tick(): void {
		this.destroyedThisTick = []
		this.decisionTick(this.subtick !== 2)
		this.moveTick()
		//	if (this.playables.length === 0) this.lost = true
		if (this.subtick === 2) {
			this.currentTick++
			this.subtick = 0
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
		let blocker: Actor | undefined
		// TODO Stuff which blocks existing (traps and such)
		if (blocker) {
			if (pushBlocks) actor.onBlocked?.(blocker)
			return false
		}

		const toPush: Actor[] = []

		// Do stuff on the entering tile
		for (const layer of [
			Layers.STATIONARY,
			Layers.MOVABLE,
			Layers.ITEM,
			Layers.ITEM_SUFFIX,
			Layers.ANIMATION,
		]) {
			for (const blockActor of newTile[layer]) {
				blockActor.bumped?.(actor)
				if (!blockActor._internalBlocks(actor)) continue
				if (pushBlocks && actor._internalCanPush(blockActor))
					toPush.push(blockActor)
				else return false
			}
		}
		for (const pushable of toPush) {
			if (pushable.slidingState) {
				pushable.pendingDecision = pushable.moveDecision = direction + 1
				// We did not move, shame, but we did queue this block push
				return false
			}
			if (!pushable._internalStep(direction)) return false
		}
		// TODO Decision time hooking
		return true
	}
}

export function createLevelFromData(data: LevelData): LevelState {
	const level = new LevelState(data.width, data.height)
	// TODO Misc data setting, like blob patterns and stuff
	level.cameraType = data.camera
	for (let y = level.height - 1; y >= 0; y--)
		for (let x = level.width - 1; x >= 0; x--)
			for (const actor of data.field[x][y]) {
				if (!actorDB[actor[0]])
					throw new Error(`Cannot find actor with id "${actor[0]}"!`)
				// @ts-expect-error Obviously, things in the DB thing are not unextended Actor classes
				const actorInstance: Actor = new actorDB[actor[0]](level, [x, y])
				actorInstance.direction = actor[1]
				// TODO 3th argument of actor classes: custom data
			}
	return level
}
