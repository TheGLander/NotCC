import { Actor } from "./actor"
import { Field, Direction } from "./helpers"
import { KeyInputs } from "./pulse"
//import { Playable } from "./actors/playables"
import Tile from "./tile"
import { Layers } from "./tile"
/**
 * The state of a level, used as a hub of realtime level properties, the most important one being `field`
 */

export class LevelState {
	//playables: Playable[] = []
	//selectedPlayable: Playable
	lost = false
	field: Field<Tile> = []
	activeActors: Actor[] = []
	subtick: 0 | 1 | 2 = 0
	currentTick = 0
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
		//	for (const i in this.playables) this.playables[i].lastInputs = input
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

		// Do stuff on the entering tile
		for (const layer of [
			Layers.STATIONARY,
			Layers.MOVABLE,
			Layers.ITEM,
			Layers.ITEM_SUFFIX,
		]) {
			for (const blockActor of newTile[layer])
				if (blockActor._internalBlocks(actor)) return false
			// TODO Pushing
		}
		// TODO Decision time hooking
		return true
	}
}
