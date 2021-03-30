import { Actor, genericDirectionableArt } from "../actor"
import { Layers } from "../tile"
import { Direction, relativeToAbsolute } from "../helpers"
export class Centipede extends Actor {
	art = genericDirectionableArt("centipede")
	decideMovement(): Direction[] {
		const dir = relativeToAbsolute(this.direction)
		return [dir.RIGHT, dir.FORWARD, dir.LEFT, dir.BACKWARD]
	}
	get layer(): Layers {
		return Layers.MOVABLE
	}
	moveSpeed = 4
}
