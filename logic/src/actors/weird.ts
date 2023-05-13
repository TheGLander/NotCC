import { Actor } from "../actor.js"
import { Layer } from "../tile.js"
import { actorDB } from "../const.js"

// Weird "good job CC2" tiles

export class VoodooTile extends Actor {
	id = "voodooTile"
	tileOffset: number | null =
		this.customData === "" ? null : parseInt(this.customData, 10)
	getLayer(): Layer {
		return Layer.STATIONARY
	}
}

actorDB["voodooTile"] = VoodooTile
