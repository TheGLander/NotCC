import { Actor, genericDirectionableArt } from "../actor"
import { Layers } from "../tile"

export class DirtBlock extends Actor {
	art = { art: "dirtBlock" }
	pushable = true
	get layer(): Layers {
		return Layers.MOVABLE
	}
	blocks() {
		return true
	}
	moveSpeed = 4
}
