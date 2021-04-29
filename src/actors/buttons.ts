import { Actor } from "../actor"
import { Layers } from "../tile"
import { actorDB } from "../const"

function globalButtonFactory(color: string) {
	return class extends Actor {
		art = { actorName: "button", animation: color }
		id = `button${color[0].toUpperCase()}${color.substr(1).toLowerCase()}`
		get layer(): Layers {
			return Layers.STATIONARY
		}
		actorCompletelyJoined(): void {
			for (const actor of this.level.actors) actor.buttonPressed?.(color)
		}
	}
}

actorDB["buttonGreen"] = globalButtonFactory("green")

actorDB["buttonBlue"] = globalButtonFactory("blue")
