import { Actor } from "../actor"
import { Layer } from "../tile"
import { actorDB } from "../const"

// Weird "good job CC2" tiles

export class CombinationTile extends Actor {
	id = "combinationTile"
	drawOnTop?: [number, number] =
		this.customData === ""
			? undefined
			: (this.customData
					.split(",")
					.slice(0, 1)
					.map(val => parseInt(val)) as [number, number])
	getLayer(): Layer {
		return Layer.STATIONARY
	}
}

actorDB["combinationTile"] = CombinationTile

export class VoodooTile extends Actor {
	id = "voodooTile"
	tileOffset: [number, number] = [
		(parseInt(this.customData) - 0x40 + 8) % 0x10,
		Math.floor((parseInt(this.customData) - 0x40 + 8) / 0x10),
	]
	getLayer(): Layer {
		return Layer.STATIONARY
	}
}

actorDB["voodooTile"] = VoodooTile
