import Actor from "../actor"
import { Direction } from "../helpers"
class Monster extends Actor {
	constructor(name: string, extName?: string) {
		super(name, "monster", extName)
		this.solidChecks.push(second => second.actorType !== "playable")
	}
}
export const centipede = new Monster("centipede")
centipede.onTick.push(function (this: Actor) {
	if (this.moving) return
	//Try to move right
	if (this.canMoveTo(Direction.RIGHT)) this.rotate(Direction.RIGHT)
	//I can't move to either up or right, move left
	else if (!this.canMoveTo(Direction.UP)) this.rotate(Direction.LEFT)
	this.move(Direction.UP)
})

export const spider = new Monster("spider")
spider.onTick.push(function (this: Actor) {
	if (this.moving) return
	//Try to move left
	if (this.canMoveTo(Direction.LEFT)) this.rotate(Direction.LEFT)
	//I can't move to either up or left, move right
	else if (!this.canMoveTo(Direction.UP)) this.rotate(Direction.RIGHT)
	this.move(Direction.UP)
})
