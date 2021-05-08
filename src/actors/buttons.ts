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

// TODO Have the button be linked on level start

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
				if (this.tile[Layer.MOVABLE].length > 1) this.actorCompletelyJoined()
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

export function diamondConnectedButtonFactory(color: string) {
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
		actorCompletelyJoined(): void {
			if (!this.connectedActor) {
				if (this.explicitlyConnectedTile)
					for (const actor of this.explicitlyConnectedTile.allActors) {
						if (actor.buttonPressed?.(color)) {
							this.connectedActor = actor
							return
						}
					}
				mainLoop: for (
					let currentLevel = 1, tilesChecked = 0;
					// eslint-disable-next-line no-constant-condition
					true;
					currentLevel++
				) {
					for (const tile of this.tile.getDiamondSearch(currentLevel)) {
						tilesChecked++
						if (this.level.width * this.level.height - tilesChecked <= 2)
							break mainLoop
						for (const actor of tile.allActors)
							if (actor.buttonPressed?.(color)) {
								this.connectedActor = actor
								break mainLoop
							}
					}
				}
			} else this.connectedActor.buttonPressed?.(color)
		}
		actorLeft(): void {
			if (!this.connectedActor) {
				if (this.explicitlyConnectedTile)
					for (const actor of this.explicitlyConnectedTile.allActors) {
						if (actor.buttonPressed?.(color)) {
							this.connectedActor = actor
							return
						}
					}
				// eslint-disable-next-line no-constant-condition
				for (let currentLevel = 0, tilesChecked = 0; true; currentLevel++) {
					for (const tile of this.tile.getDiamondSearch(currentLevel)) {
						for (const actor of tile.allActors)
							if (actor.buttonPressed?.(color)) break
						tilesChecked++
						if (this.level.width * this.level.height - tilesChecked <= 1) break
					}
				}
			} else this.connectedActor.buttonPressed?.(color)
		}
	}
}

actorDB["buttonOrange"] = diamondConnectedButtonFactory("orange")
