import { Actor } from "../actor.js"
import { Layer } from "../tile.js"
import { actorDB } from "../const.js"
import { Water, Dirt, Ice } from "./terrain.js"
import { Direction } from "../helpers.js"

export class DirtBlock extends Actor {
	id = "dirtBlock"
	transmogrifierTarget = "iceBlock"
	tags = ["block", "cc1block", "movable", "reverse-on-railroad"]
	ignoreTags = ["fire"]
	immuneTags = ["water"]
	getLayer(): Layer {
		return Layer.MOVABLE
	}
	blocks(): boolean {
		return true
	}
	bumpedActor(other: Actor): void {
		if (
			other.getCompleteTags("tags").includes("real-playable") &&
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
		if (water && !water._internalIgnores(this)) {
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
		"reverse-on-railroad",
	]
	immuneTags = ["water"]
	getLayer(): Layer {
		return Layer.MOVABLE
	}
	blocks(): boolean {
		return true
	}
	bumpedActor(other: Actor): void {
		if (
			other.getCompleteTags("tags").includes("real-playable") &&
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
		if (water && !water._internalIgnores(this)) {
			this.destroy(this, "splash")
			water.destroy(null, null)
			new Ice(this.level, this.tile.position)
		}
		if (melting && !melting._internalIgnores(this)) {
			this.destroy(this, "splash")
			melting.destroy(null, null)
			new Water(this.level, this.tile.position)
		}
	}
	bumped(other: Actor): void {
		if (
			other.getCompleteTags("tags").includes("melting") &&
			(!this.tile.hasLayer(Layer.STATIONARY) ||
				this.tile[Layer.STATIONARY].next().value.id === "water")
		) {
			this.destroy(this, "splash")
			if (!this.tile.hasLayer(Layer.STATIONARY))
				new Water(this.level, this.tile.position)
		}
	}
	canBePushed(other: Actor): boolean {
		// Fun fact: Ice blocks & dir blocks just can't be pushed when they are sliding and a block is pushing them
		return !(
			this.slidingState && other.getCompleteTags("tags").includes("block")
		)
	}
}

actorDB["iceBlock"] = IceBlock

export class DirectionalBlock extends Actor {
	id = "directionalBlock"
	getLayer(): Layer {
		return Layer.MOVABLE
	}
	legalDirections = Array.from(this.customData).map(val => "URDL".indexOf(val))
	blocks(): boolean {
		return true
	}
	pushTags = ["block"]
	tags = [
		"block",
		"cc2block",
		"movable",
		"can-stand-on-items",
		"reverse-on-railroad",
		"dies-in-slime",
	]
	immuneTags = ["water"]
	bumpedActor(other: Actor): void {
		if (
			other.getCompleteTags("tags").includes("real-playable") &&
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
		if (water && !water._internalIgnores(this)) {
			water.destroy(null, null)
			this.destroy(this, "splash")
		}
	}
	canBePushed(other: Actor, direction: Direction): boolean {
		if (!this.legalDirections.includes(direction)) return false
		// Fun fact: Ice blocks & dir blocks just can't be pushed when they are sliding and a block is pushing them
		return !(
			this.slidingState && other.getCompleteTags("tags").includes("block")
		)
	}
	rebuildCustomData(): void {
		this.customData = ""
		for (const dir of this.legalDirections) {
			this.customData += "URDL"[dir]
		}
	}
	onRedirect(delta: number): void {
		for (let i = 0; i < this.legalDirections.length; i++) {
			this.legalDirections[i] = (this.legalDirections[i] - delta + 4) % 4
		}
		this.rebuildCustomData()
	}
}

actorDB["directionalBlock"] = DirectionalBlock
