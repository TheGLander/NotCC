import Actor from "../actor"

class Static extends Actor {
	constructor(name: string, extName?: string) {
		super(name, "static", extName)
	}
	art: (this: this) => { art: string; rotation: number } = function () {
		return { art: this.name, rotation: 180 }
	}
}
export const forceFloor = new Static("forceFloor")
forceFloor.onCollision.push(function (other: Actor) {
	other.direction = this.direction
	other.move(this.direction)
})
