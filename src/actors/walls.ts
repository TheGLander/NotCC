import Actor from "../actor"
class Wall extends Actor {
	constructor(name: string, extName?: string) {
		super(name, "static", extName)
	}
	art: (this: this) => { art: string } = function () {
		return { art: this.name }
	}
}
export const wall = new Wall("wall")
wall.solidChecks.push(() => true)
