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
	ignoreTags = ["fire", "water"]
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
		const water = this.tile.findActor(Layer.STATIONARY, val =>
			val.getCompleteTags("tags").includes("water")
		)
		if (water) {
			this.destroy(this, "splash")
			water.destroy(null, null)
			new Dirt(this.level, this.tile.position)
		}
	}
}

actorDB["dirtBlock"] = DirtBlock

export class IceBlock extends Actor {
	id = "iceBlock"
	transmogrifierTarget = "dirtBlock"
	pushTags = ["cc2block"]
	tags = [
		"block",
		"cc2block",
		"movable",
		"can-stand-on-items",
		"meltable-block",
	]
	ignoreTags = ["water", "melting"]
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
		const water = this.tile.findActor(Layer.STATIONARY, val =>
			val.getCompleteTags("tags").includes("water")
		)
		const melting = this.tile.findActor(Layer.STATIONARY, val =>
			val.getCompleteTags("tags").includes("melting")
		)
		if (water) {
			this.destroy(this, "splash")
			water.destroy(null, null)
			new Ice(this.level, this.tile.position)
		}
		if (melting) {
			this.destroy(this, "splash")
			melting.destroy(null, null)
			new Water(this.level, this.tile.position)
		}
	}
	bumped(other: Actor): void {
		if (other.getCompleteTags("tags").includes("melting")) {
			this.destroy(this, "splash")
			if (!this.tile.hasLayer(Layer.STATIONARY))
				new Water(this.level, this.tile.position)
		}
	}
}

actorDB["iceBlock"] = IceBlock

export class DirectionalBlock extends Actor {
	id = "directionalBlock"
	ignoreTags = ["water"]
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
		if (
			other instanceof Playable &&
			!this.getCompleteTags("tags")
				.concat(other.getCompleteTags("tags"))
				.includes("ignore-default-monster-kill")
		)
			other.destroy(this)
	}
	newTileCompletelyJoined(): void {
		const water = this.tile.findActor(Layer.STATIONARY, val =>
			val.getCompleteTags("tags").includes("water")
		)
		if (water) {
			water.destroy(null, null)
			this.destroy(this, "splash")
		}
	}
	canBePushed(_other: Actor, direction: Direction): boolean {
		return this.legalDirections.includes(direction)
	}
}

actorDB["directionalBlock"] = DirectionalBlock
