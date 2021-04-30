import { Actor } from "../actor"
import { Layers } from "../tile"
import { actorDB } from "../const"
import { LevelState } from "../level"

export function globalButtonFactory(color: string) {
	return class extends Actor {
		art = { actorName: "button", animation: color }
		id = `button${color[0].toUpperCase()}${color.substr(1).toLowerCase()}`
		get layer(): Layers {
			return Layers.STATIONARY
		}
		actorCompletelyJoined(): void {
			for (const actor of this.level.actors) actor.buttonPressed?.(color)
		}
		actorLeft(): void {
			for (const actor of this.level.actors) actor.buttonUnpressed?.(color)
		}
	}
}

actorDB["buttonGreen"] = globalButtonFactory("green")

actorDB["buttonBlue"] = globalButtonFactory("blue")

// TODO Explicit button connections (MSCC style) & how do these work when the connected thing is blown up?

export function ROConnectedButtonFactory(color: string) {
	return class extends Actor {
		art = { actorName: "button", animation: color }
		id = `button${color[0].toUpperCase()}${color.substr(1).toLowerCase()}`
		connectedActor: Actor | null = null
		get layer(): Layers {
			return Layers.STATIONARY
		}
		constructor(level: LevelState, position: [number, number]) {
			super(level, position)
		}
		actorCompletelyJoined(): void {
			if (!this.connectedActor) {
				const thisIndex = this.level.actors.indexOf(this)
				const foundActor = [
					// This relies that actor order is in RRO, maybe this should do it more like teleports?
					...this.level.actors.slice(thisIndex),
					...this.level.actors.slice(0, thisIndex),
				]
					.reverse()
					.find(actor => actor.buttonPressed?.(color))
				if (foundActor) this.connectedActor = foundActor
			} else this.connectedActor.buttonPressed?.(color)
		}
		actorLeft(): void {
			if (!this.connectedActor) {
				const thisIndex = this.level.actors.indexOf(this)
				const foundActor = [
					// This relies that actor order is in RRO, maybe this should do it more like teleports?
					...this.level.actors.slice(thisIndex),
					...this.level.actors.slice(0, thisIndex),
				]
					.reverse()
					.find(actor => actor.buttonUnpressed?.(color))
				if (foundActor) this.connectedActor = foundActor
			} else this.connectedActor.buttonUnpressed?.(color)
		}
	}
}

actorDB["buttonRed"] = ROConnectedButtonFactory("red")

actorDB["buttonBrown"] = ROConnectedButtonFactory("brown")
