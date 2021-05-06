import { Actor } from "../actor"
import { Layer } from "../tile"
import { actorDB } from "../const"
import { LevelState } from "../level"
import Tile from "../tile"

export function globalButtonFactory(color: string) {
	return class extends Actor {
		art = { actorName: "button", animation: color }
		id = `button${color[0].toUpperCase()}${color.substr(1).toLowerCase()}`
		get layer(): Layer {
			return Layer.STATIONARY
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

// TODO How do these work when the connected thing is blown up?

export function ROConnectedButtonFactory(
	color: string,
	shouldActivateOnLevelStart?: boolean
) {
	return class extends Actor {
		art = { actorName: "button", animation: color }
		id = `button${color[0].toUpperCase()}${color.substr(1).toLowerCase()}`
		connectedActor: Actor | null = null
		explicitlyConnectedTile: Tile | null = null
		get layer(): Layer {
			return Layer.STATIONARY
		}
		constructor(level: LevelState, position: [number, number]) {
			super(level, position)
			// Search for an explicit connection
			for (const connection of this.level.connections)
				if (
					connection[0][0] === this.tile.x &&
					connection[0][1] === this.tile.y
				)
					this.explicitlyConnectedTile = this.level.field[connection[1][0]]?.[
						connection[1][1]
					]
		}
		levelStarted(): void {
			if (shouldActivateOnLevelStart)
				if (this.tile.allActors.length > 1) this.actorCompletelyJoined()
		}
		actorCompletelyJoined(): void {
			if (!this.connectedActor) {
				const thisIndex = this.level.actors.indexOf(this)
				const foundActor = [
					// This relies that actor order is in RRO, maybe this should do it more like teleports?
					...this.level.actors.slice(thisIndex),
					...this.level.actors.slice(0, thisIndex),
					...(this.explicitlyConnectedTile?.allActors ?? []), // Try the explicitly connected one first
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

actorDB["buttonBrown"] = ROConnectedButtonFactory("brown", true)
