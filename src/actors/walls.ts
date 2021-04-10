import { Actor, ActorArt } from "../actor"
import { Layers } from "../tile"
import { actorDB } from "../const"
export class Wall extends Actor {
	id = "wall"
	tags = ["wall"]
	art: ActorArt = { actorName: "wall" }
	get layer(): Layers {
		return Layers.STATIONARY
	}
	blocks(): boolean {
		return true
	}
}

actorDB["wall"] = Wall
