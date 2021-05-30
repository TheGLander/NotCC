import { Actor } from "../actor"
import { Layer } from "../tile"
import { Direction } from "../helpers"
import { Key } from "./items"
import { actorDB } from "../const"

export class NoSign extends Actor {
	id = "noSign"
	getLayer(): Layer {
		return Layer.ITEM_SUFFIX
	}
	blocks(other: Actor, moveDirection: Direction): boolean {
		for (const item of this.tile[Layer.ITEM]) {
			if (item instanceof Key) {
				if (other.inventory.keys[item.id]?.amount > 0) return true
			} else if (
				other.inventory.items.some(otherItem => otherItem.id === item.id)
			)
				return true
		}
		return [...this.tile[Layer.SPECIAL], ...this.tile[Layer.STATIONARY]].some(
			val => val._internalBlocks(other, moveDirection)
		)
	}
}

actorDB["noSign"] = NoSign
