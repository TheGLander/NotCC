import { Actor } from "../actor"
import { Layer } from "../tile"
import { actorDB } from "../const"
import { Playable } from "./playables"
import { Water, Dirt, Ice } from "./terrain"
import { Direction } from "../helpers"

export class DirtBlock extends Actor {
	id = "dirtBlock"
	transmogrifierTarget = "iceBlock"
	tags = ["block", "cc1block", "movable"]
	ignoreTags = ["fire"]
	getLayer(): Layer {
		return Layer.MOVABLE
	}
	blocks(): boolean {
		return true
	}
	bumpedActor(other: Actor): void {
		if (
			other instanceof Playable &&
			!this.getCompleteTags("tags")
				.concat(other.getCompleteTags("tags"))
				.includes("ignore-default-monster-kill")
		)
			other.destroy(this)
	}
	newTileCompletelyJoined(): void {
		const water = this.tile[Layer.STATIONARY].find(val => val instanceof Water)
		if (water) {
			water.destroy(this, null)
			new Dirt(this.level, this.tile.position)
		}
	}
}

actorDB["dirtBlock"] = DirtBlock

export class IceBlock extends Actor {
	id = "iceBlock"
	transmogrifierTarget = "dirtBlock"
	pushTags = ["cc2block"]
	tags = ["block", "cc2block", "movable", "can-stand-on-items"]
	getLayer(): Layer {
		return Layer.MOVABLE
	}
	blocks(): boolean {
		return true
	}
	bumpedActor(other: Actor): void {
		if (other instanceof Playable) other.destroy(this)
	}
	newTileCompletelyJoined(): void {
		const water = this.tile[Layer.STATIONARY].find(val =>
			val.tags.includes("water")
		)
		if (water) {
			water.destroy(this, null)
			new Ice(this.level, this.tile.position)
		}
		for (const actor of this.tile[Layer.STATIONARY]) this.melt(actor)
	}
	bumped = this.melt
	melt(other: Actor): void {
		if (other.getCompleteTags("tags").includes("melting")) {
			this.destroy(this, null)
			if (other.layer === Layer.STATIONARY) other.destroy(this, null)
			if (this.tile[Layer.STATIONARY].length === 0)
				new Water(this.level, this.tile.position)
		}
	}
}

actorDB["iceBlock"] = IceBlock

export class DirectionalBlock extends Actor {
	id = "directionalBlock"
	getLayer(): Layer {
		return Layer.MOVABLE
	}
	legalDirections = Array.from(this.customData).map(val => "urdl".indexOf(val))
	blocks(): boolean {
		return true
	}
	pushTags = ["block"]
	tags = ["block", "cc2block", "movable", "can-stand-on-items"]
	bumpedActor(other: Actor): void {
		if (other instanceof Playable) other.destroy(this)
	}
	newTileCompletelyJoined(): void {
		const water = this.tile[Layer.STATIONARY].find(val =>
			val.tags.includes("water")
		)
		if (water) water.destroy(this, null)
	}
	canBePushed(_other: Actor, direction: Direction): boolean {
		return this.legalDirections.includes(direction)
	}
}

actorDB["directionalBlock"] = DirectionalBlock
