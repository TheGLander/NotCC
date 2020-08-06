import Actor from "../actor"
import { Direction } from "../helpers"
class Wall extends Actor {
	constructor(name: string, extName?: string) {
		super(name, "terrain", extName)
	}
	art: (this: this) => string = function () {
		return this.name
	}
}
export const wall = new Wall("wall")
wall.solidChecks.push(() => true)
