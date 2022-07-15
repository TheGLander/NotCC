import { Actor } from "../actor"
import { Layer } from "../tile"
import { Direction } from "../helpers"
import { Key } from "./items"
import { actorDB } from "../const"

export class NoSign extends Actor {
	id = "noSign"
	tags = ["ignoreItem", "no-sign"]
	getLayer(): Layer {
		return Layer.ITEM_SUFFIX
	}
	blocks(other: Actor): boolean {
		for (const item of this.tile[Layer.ITEM]) {
			if (item instanceof Key) {
				if (other.inventory.keys[item.id]?.amount > 0) return true
			} else if (
				other.inventory.items.some(otherItem => otherItem.id === item.id)
			)
				return true
		}
		return false
	}
}

actorDB["noSign"] = NoSign
