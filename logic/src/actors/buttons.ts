import { Actor } from "../actor"
import { Layer } from "../tile"
import { actorDB } from "../const"
import { LevelState } from "../level"
import Tile from "../tile"

export function globalButtonFactory(color: string) {
	return class extends Actor {
		id = `button${color[0].toUpperCase()}${color.substr(1).toLowerCase()}`
		getLayer(): Layer {
			return Layer.STATIONARY
		}
		actorCompletelyJoined(): void {
			for (const actor of this.level.actors)
				if (actor.caresButtonColors.includes(color))
					actor.buttonPressed?.(color)
		}
		actorLeft(): void {
			for (const actor of this.level.actors)
				if (actor.caresButtonColors.includes(color))
					actor.buttonUnpressed?.(color)
		}
	}
}

export function globalComplexButtonFactory(color: string) {
	return class extends Actor {
		id = `complexButton${color[0].toUpperCase()}${color
			.substr(1)
			.toLowerCase()}`
		getLayer(): Layer {
			return Layer.STATIONARY
		}
		actorCompletelyJoined(other: Actor): void {
			for (const actor of this.level.actors)
				if (actor.caresButtonColors.includes(color))
					actor.buttonPressed?.(color, other.direction.toString())
		}
		actorLeft(other: Actor): void {
			for (const actor of this.level.actors)
				if (actor.caresButtonColors.includes(color))
					actor.buttonUnpressed?.(color, other.direction.toString())
		}
	}
}

actorDB["buttonGreen"] = globalButtonFactory("green")

actorDB["buttonBlue"] = globalButtonFactory("blue")

actorDB["complexButtonYellow"] = globalComplexButtonFactory("yellow")

export function ROConnectedButtonFactory(
	color: string,
	shouldActivateOnLevelStart?: boolean
) {
	return class extends Actor {
		id = `button${color[0].toUpperCase()}${color.substr(1).toLowerCase()}`
		connectedActor: Actor | null = null
		explicitlyConnectedTile: Tile | null = null
		getLayer(): Layer {
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
					this.explicitlyConnectedTile =
						this.level.field[connection[1][0]]?.[connection[1][1]]
		}
		levelStarted(): void {
			const thisIndex = this.level.actors.indexOf(this)
			const foundActor = [
				// TODO This relies that actor order is in RRO, maybe this should do it more like teleports?
				...this.level.actors.slice(thisIndex),
				...this.level.actors.slice(0, thisIndex),
				...(this.explicitlyConnectedTile?.allActors ?? []), // Try the explicitly connected one first
			]
				.reverse()
				.find(actor => actor.caresButtonColors.includes(color))
			if (foundActor) this.connectedActor = foundActor

			if (shouldActivateOnLevelStart)
				if (this.tile.hasLayer(Layer.MOVABLE)) this.actorCompletelyJoined()
		}
		actorCompletelyJoined(): void {
			this.connectedActor?.buttonPressed?.(color)
		}
		actorLeft(): void {
			this.connectedActor?.buttonUnpressed?.(color)
		}
	}
}

actorDB["buttonRed"] = ROConnectedButtonFactory("red")

actorDB["buttonBrown"] = ROConnectedButtonFactory("brown", true)

export function diamondConnectedButtonFactory(color: string) {
	return class extends Actor {
		id = `button${color[0].toUpperCase()}${color.substr(1).toLowerCase()}`
		connectedActor: Actor | null = null
		explicitlyConnectedTile: Tile | null = null
		getLayer(): Layer {
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
					this.explicitlyConnectedTile =
						this.level.field[connection[1][0]]?.[connection[1][1]]
		}
		levelStarted(): void {
			if (this.explicitlyConnectedTile) {
				for (const actor of this.explicitlyConnectedTile.allActors)
					if (actor.caresButtonColors.includes(color))
						this.connectedActor = actor
			} else
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
							if (actor.caresButtonColors.includes(color)) {
								this.connectedActor = actor
								break mainLoop
							}
					}
				}
		}
		actorCompletelyJoined(): void {
			this.connectedActor?.buttonPressed?.(color)
		}
		actorLeft(): void {
			this.connectedActor?.buttonUnpressed?.(color)
		}
	}
}

actorDB["buttonOrange"] = diamondConnectedButtonFactory("orange")
