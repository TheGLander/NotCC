import Actor from "../actor"
class Wall extends Actor {
	constructor(name: string, extName?: string) {
		super(name, "static", extName)
	}
	art: (this: this) => string = function () {
		return this.name
	}
}
export const wall = new Wall("wall")
wall.solidChecks.push(() => true)
