import { Actor } from "../actor"
import { Layers } from "../tile"
import { actorDB } from "../const"

export class DirtBlock extends Actor {
	art = { art: "dirtBlock" }
	pushable = true
	get layer(): Layers {
		return Layers.MOVABLE
	}
	blocks(): boolean {
		return true
	}
	moveSpeed = 4
}

actorDB["dirtBlock"] = DirtBlock
