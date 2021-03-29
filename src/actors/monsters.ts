import { Actor } from "../actor"
import { Layers } from "../tile"
import { Direction, relativeToAbsolute } from "../helpers"
export class Centipede extends Actor {
	decideMovement(): Direction[] {
		const dir = relativeToAbsolute(this.direction)
		return [dir.RIGHT, dir.FORWARD, dir.LEFT, dir.BACKWARD]
	}
	get layer(): Layers {
		return Layers.MOVABLE
	}
	get moveSpeed(): number {
		return 4
	}
}
