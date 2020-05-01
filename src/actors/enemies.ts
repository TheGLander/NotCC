import Actor from "../actor"
import { Direction } from "../helpers"
class Monster extends Actor {
	constructor(name: string, extName?: string) {
		super(name, "monster", extName)
	}
}
export const centipede = new Monster("centipede")
centipede.onTick.push(function (this: Actor) {
	if (this.moving) return
	//Try to move right
	if (this.canMoveTo(Direction.RIGHT)) this.rotate(Direction.RIGHT)
	//I can't move to either up or right, move left as a last resort
	else if (!this.canMoveTo(Direction.UP)) this.rotate(Direction.LEFT)
	this.move(Direction.UP)
})
