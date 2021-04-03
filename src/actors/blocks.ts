import { Actor } from "../actor"
import { Layers } from "../tile"
import { actorDB } from "../const"
import { Playable } from "./playables"
import { Water } from "./terrain"
import { Direction } from "../helpers"

export class DirtBlock extends Actor {
	art = { art: "dirtBlock" }
	pushable = true
	tags = ["block", "cc1block"]
	get layer(): Layers {
		return Layers.MOVABLE
	}
	blocks(): boolean {
		return true
	}
	moveSpeed = 4
	newTileJoined(): void {
		const playable = this.tile[Layers.MOVABLE].find(
			val => val instanceof Playable
		) as Playable | undefined
		playable?.destroy(this)
	}
	newTileCompletelyJoined(): void {
		const water = this.tile[Layers.STATIONARY].find(val => val instanceof Water)
		if (water) {
			water.destroy(this, null)

			// @ts-expect-error This is not an abstract class
			new actorDB["dirt"](this.level, Direction.UP, this.tile.position)
		}
	}
}

actorDB["dirtBlock"] = DirtBlock

export class IceBlock extends Actor {
	art = { art: "iceBlock" }
	pushable = true
	pushTags = ["!cc1block"]
	tags = ["block"]
	get layer(): Layers {
		return Layers.MOVABLE
	}
	blocks(): boolean {
		return true
	}
	moveSpeed = 4
	newTileJoined(): void {
		const playable = this.tile[Layers.MOVABLE].find(
			val => val instanceof Playable
		) as Playable | undefined
		playable?.destroy(this)
	}
	newTileCompletelyJoined(): void {
		const water = this.tile[Layers.STATIONARY].find(val => val instanceof Water)
		if (water) {
			water.destroy(this, null)

			// @ts-expect-error This is not an abstract class
			new actorDB["ice"](this.level, Direction.UP, this.tile.position)
		}
	}
	bumped = this.melt
	melt(other: Actor): void {
		if (other.tags.includes("melting")) {
			this.destroy(this, null)
			// @ts-expect-error This is not an abstract class
			new actorDB["water"](this.level, Direction.UP, this.tile.position)
		}
	}
}

actorDB["iceBlock"] = IceBlock
