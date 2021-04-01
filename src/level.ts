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
		// Do stuff on the leaving tile
		let blocker: Actor | undefined
		// TODO Stuff which blocks existing (traps and such)
		if (blocker) {
			if (pushBlocks) actor.onBlocked?.(blocker)
			return false
		}

		const newTile = actor.tile.getNeighbor(direction)

		if (!newTile) return false

		const toPush: Actor[] = []

		// Do stuff on the entering tile
		for (const layer of [
			Layers.STATIONARY,
			Layers.MOVABLE,
			Layers.ITEM,
			Layers.ITEM_SUFFIX,
		]) {
			for (const blockActor of newTile[layer]) {
				if (!blockActor._internalBlocks(actor)) continue
				// TODO Refactor this into a method
				if (blockActor.pushable && actor instanceof Playable)
					toPush.push(blockActor)
				else return false
			}
		}
		if (!pushBlocks && toPush.length) return false
		for (const pushable of toPush) {
			if (pushable.slidingState) {
				pushable.moveDecision = direction + 1
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
	for (let x = 0; x < level.width; x++)
		for (let y = 0; y < level.height; y++)
			for (const actor of data.field[x][y]) {
				// We have no floor actor
				if (actor[0] === "floor") continue
				if (!actorDB[actor[0]])
					throw new Error(`Cannot find actor with id "${actor[0]}"!`)
				// @ts-expect-error Obviously, things in the DB thing are not unextended Actor classes
				new actorDB[actor[0]](level, actor[1], [x, y])
				// TODO 4th argument of actor classes: custom data
			}
	return level
}
