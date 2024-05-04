import { Actor } from "../actor.js"
import { Layer } from "../tile.js"
import { actorDB } from "../const.js"
import { Water, Dirt, Ice } from "./terrain.js"
import { Direction } from "../helpers.js"

export class DirtBlock extends Actor {
	id = "dirtBlock"
	transmogrifierTarget = "iceBlock"
	static tags = ["block", "cc1block", "movable", "reverse-on-railroad"]
	static ignoreTags = ["fire"]
	static immuneTags = ["water"]
	getLayer(): Layer {
		return Layer.MOVABLE
	}
	blocks(): boolean {
		return true
	}
	bumpedActor(other: Actor): void {
		if (
			other.hasTag("real-playable") &&
			!this.hasTag("ignore-default-monster-kill") &&
			!other.hasTag("ignore-default-monster-kill")
		)
			other.destroy(this)
	}
	newTileCompletelyJoined(): void {
		const water = this.tile[Layer.STATIONARY]
		if (!water?.hasTag("water")) return

		if (!water._internalIgnores(this)) {
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
	static pushTags = ["cc2block"]
	static tags = [
		"block",
		"cc2block",
		"movable",
		"can-stand-on-items",
		"meltable-block",
		"reverse-on-railroad",
	]
	static immuneTags = ["water"]
	getLayer(): Layer {
		return Layer.MOVABLE
	}
	blocks(): boolean {
		return true
	}
	bumpedActor(other: Actor): void {
		if (
			other.hasTag("real-playable") &&
			!this.hasTag("ignore-default-monster-kill") &&
			!other.hasTag("ignore-default-monster-kill")
		)
			other.destroy(this)
	}
	newTileCompletelyJoined(): void {
		const terrain = this.tile[Layer.STATIONARY]
		if (terrain?.hasTag("water") && !terrain._internalIgnores(this)) {
			this.destroy(this, "splash")
			terrain.destroy(null, null)
			new Ice(this.level, this.tile.position)
		}
		if (terrain?.hasTag("melting") && !terrain._internalIgnores(this)) {
			this.destroy(this, "splash")
			terrain.destroy(null, null)
			new Water(this.level, this.tile.position)
		}
	}
	bumped(other: Actor): void {
		if (
			other.hasTag("melting") &&
			(!this.tile.hasLayer(Layer.STATIONARY) ||
				this.tile[Layer.STATIONARY]!.id === "water")
		) {
			this.destroy(this, "splash")
			if (!this.tile.hasLayer(Layer.STATIONARY))
				new Water(this.level, this.tile.position)
		}
	}
	canBePushed(other: Actor): boolean {
		// Fun fact: Ice blocks & dir blocks just can't be pushed when they are sliding and a block is pushing them
		return !(this.slidingState && other.hasTag("block"))
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
	static pushTags = ["block"]
	static tags = [
		"block",
		"cc2block",
		"movable",
		"can-stand-on-items",
		"reverse-on-railroad",
		"dies-in-slime",
	]
	static immuneTags = ["water"]
	bumpedActor(other: Actor): void {
		if (
			other.hasTag("real-playable") &&
			!this.hasTag("ignore-default-monster-kill") &&
			!other.hasTag("ignore-default-monster-kill")
		)
			other.destroy(this)
	}
	newTileCompletelyJoined(): void {
		const water = this.tile[Layer.STATIONARY]
		if (water?.hasTag("water") && !water._internalIgnores(this)) {
			water.destroy(null, null)
			this.destroy(this, "splash")
		}
	}
	canBePushed(other: Actor, direction: Direction): boolean {
		if (!this.legalDirections.includes(direction)) return false
		// Fun fact: Ice blocks & dir blocks just can't be pushed when they are sliding and a block is pushing them
		return !(this.slidingState && other.hasTag("block"))
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
