import { Actor, genericDirectionableArt } from "../actor"
import { Layers } from "../tile"
import { Direction, relativeToAbsolute } from "../helpers"
import { Playable } from "./playables"
import { actorDB } from "../const"

export class Centipede extends Actor {
	art = genericDirectionableArt("centipede")
	decideMovement(): Direction[] {
		const dir = relativeToAbsolute(this.direction)
		return [dir.RIGHT, dir.FORWARD, dir.LEFT, dir.BACKWARD]
	}
	get layer(): Layers {
		return Layers.MOVABLE
	}
	blocks(other: Actor): boolean {
		return !(other instanceof Playable)
	}
	moveSpeed = 4
}

actorDB["centipede"] = Centipede
