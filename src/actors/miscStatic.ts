import Actor from "../actor"
import { Direction } from "../helpers"

class Static extends Actor {
	constructor(name: string, extName?: string) {
		super(name, "static", extName)
	}
	art: (this: this) => { art: string; rotation: number } = function () {
		return { art: this.name, rotation: this.direction * 90 }
	}
}
export const forceFloor = new Static("forceFloor")
forceFloor.onCollision.push(function (other: Actor) {
	other.direction = this.direction
	if (this.relativeMovement) other.move(Direction.UP)
	else other.move(this.direction)
})
