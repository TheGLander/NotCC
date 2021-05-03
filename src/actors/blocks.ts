import { Actor, ActorArt } from "../actor"
import { Layers } from "../tile"
import { actorDB } from "../const"
import { Playable } from "./playables"
import { Water, Dirt, Ice } from "./terrain"

// TODO Secret eye interaction thing

export class DirtBlock extends Actor {
	id = "dirtBlock"
	art: ActorArt = {
		actorName: "dirtBlock",
	}
	tags = ["block", "cc1block", "movable"]
	ignoreTags = ["fire"]
	get layer(): Layers {
		return Layers.MOVABLE
	}
	blocks(): boolean {
		return true
	}
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
			new Dirt(this.level, this.tile.position)
		}
	}
}

actorDB["dirtBlock"] = DirtBlock

export class IceBlock extends Actor {
	id = "iceBlock"
	art: ActorArt = {
		actorName: "iceBlock",
	}
	pushTags = ["cc2block"]
	tags = ["block", "cc2block", "movable"]
	get layer(): Layers {
		return Layers.MOVABLE
	}
	blocks(): boolean {
		return true
	}

	newTileJoined(): void {
		const playable = this.tile[Layers.MOVABLE].find(
			val => val instanceof Playable
		) as Playable | undefined
		playable?.destroy(this)
	}
	newTileCompletelyJoined(): void {
		const water = this.tile[Layers.STATIONARY].find(val =>
			val.tags.includes("water")
		)
		if (water) {
			water.destroy(this, null)
			new Ice(this.level, this.tile.position)
		}
		for (const actor of this.tile[Layers.STATIONARY]) this.melt(actor)
	}
	bumped = this.melt
	melt(other: Actor): void {
		if (other.tags.includes("melting")) {
			this.destroy(this, null)
			if (other.layer === Layers.STATIONARY) other.destroy(this, null)
			if (this.tile[Layers.STATIONARY].length === 0)
				new Water(this.level, this.tile.position)
		}
	}
}

actorDB["iceBlock"] = IceBlock
