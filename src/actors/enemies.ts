import Actor from "../actor"
import { Direction } from "../helpers"

export const centipede = new Actor("centipede")
centipede.onTick.push(function (this: Actor) {
	if (this.moving) return
	//Try to move right
	if (this.canMoveTo(Direction.RIGHT)) this.rotate(Direction.RIGHT)
	//I can't move to either up or right, move left as a last resort
	else if (!this.canMoveTo(Direction.UP)) this.rotate(Direction.LEFT)
	this.move(Direction.UP)
})
