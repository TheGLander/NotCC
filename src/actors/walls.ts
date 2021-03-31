import { Actor } from "../actor"
import { Layers } from "../tile"
import { actorDB } from "../const"
export class Wall extends Actor {
	art = { art: "wall" }
	get layer(): Layers {
		return Layers.STATIONARY
	}
	blocks(): boolean {
		return true
	}
}

actorDB["wall"] = Wall
