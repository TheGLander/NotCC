import { Actor } from "../actor"
import { Layers } from "../tile"
import { Direction } from "../helpers"
import { Key } from "./items"
import { actorDB } from "../const"

export class NoSign extends Actor {
	id = "noSign"
	art = { actorName: "noSign" }
	get layer(): Layers {
		return Layers.ITEM_SUFFIX
	}
	blocks(other: Actor, moveDirection: Direction): boolean {
		for (const item of this.tile[Layers.ITEM]) {
			if (item instanceof Key) {
				if (other.inventory.keys[item.id]?.amount > 0) return true
			} else if (
				other.inventory.items.some(otherItem => otherItem.id === item.id)
			)
				return true
		}
		return [
			...this.tile[Layers.SPECIAL],
			...this.tile[Layers.STATIONARY],
		].some(val => val._internalBlocks(this, moveDirection))
	}
}

actorDB["noSign"] = NoSign
