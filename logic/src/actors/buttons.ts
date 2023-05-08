import { Actor } from "../actor.js"
import { Layer } from "../tile.js"
import { actorDB, Decision } from "../const.js"
import { Tile } from "../tile.js"
import { getTileWirable, WireOverlapMode } from "../wires.js"
import { crossLevelData, onLevelStart } from "../level.js"

export function globalButtonFactory(color: string) {
	return class extends Actor {
		id = `button${color[0].toUpperCase()}${color.substr(1).toLowerCase()}`
		tags = ["button"]
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
		tags = ["button"]
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

declare module "../level.js" {
	export interface CrossLevelDataInterface {
		greenButtonPressed: Partial<boolean>
	}
}
class ButtonGreen extends globalButtonFactory("green") {
	actorCompletelyJoined(): void {
		super.actorCompletelyJoined()
		crossLevelData.greenButtonPressed = !crossLevelData.greenButtonPressed
	}
}

onLevelStart.push(() => (crossLevelData.greenButtonPressed = false))

actorDB["buttonGreen"] = ButtonGreen

declare module "../level.js" {
	export interface CrossLevelDataInterface {
		blueButtonPressed: boolean
	}
}
class ButtonBlue extends globalButtonFactory("blue") {
	actorCompletelyJoined(): void {
		super.actorCompletelyJoined()
		crossLevelData.blueButtonPressed = !crossLevelData.blueButtonPressed
	}
}

onLevelStart.push(() => (crossLevelData.blueButtonPressed = false))

actorDB["buttonBlue"] = ButtonBlue

actorDB["complexButtonYellow"] = globalComplexButtonFactory("yellow")
declare module "../level.js" {
	export interface CrossLevelDataInterface {
		currentYellowButtonPress: Decision
	}
}
class ComplexButtonYellow extends globalComplexButtonFactory("yellow") {
	actorCompletelyJoined(other: Actor): void {
		super.actorCompletelyJoined(other)
		crossLevelData.currentYellowButtonPress = other.direction + 1
	}
}

onLevelStart.push(
	() => (crossLevelData.currentYellowButtonPress = Decision.NONE)
)

actorDB["complexButtonYellow"] = ComplexButtonYellow

export function ROConnectedButtonFactory(
	color: string,
	shouldActivateOnLevelStart?: boolean
) {
	return class extends Actor {
		id = `button${color[0].toUpperCase()}${color.substr(1).toLowerCase()}`
		tags = ["button"]
		connectedActor: Actor | null = null
		explicitlyConnectedTile: Tile | null = null
		getLayer(): Layer {
			return Layer.STATIONARY
		}
		levelStarted(): void {
			// Search for an explicit connection
			for (const connection of this.level.connections)
				if (
					connection[0][0] === this.tile.x &&
					connection[0][1] === this.tile.y
				)
					this.explicitlyConnectedTile =
						this.level.field[connection[1][0]]?.[connection[1][1]]
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

			if (shouldActivateOnLevelStart && this.tile.hasLayer(Layer.MOVABLE))
				this.connectedActor?.buttonPressed?.(color, "init")
		}
		actorCompletelyJoined(): void {
			if (!this.connectedActor?.exists) this.connectedActor = null
			this.connectedActor?.buttonPressed?.(color)
		}
		actorLeft(): void {
			if (!this.connectedActor?.exists) this.connectedActor = null
			this.connectedActor?.buttonUnpressed?.(color)
		}
		actorDestroyed(): void {
			if (!this.connectedActor?.exists) this.connectedActor = null
			this.connectedActor?.buttonUnpressed?.(color)
		}
	}
}

actorDB["buttonRed"] = ROConnectedButtonFactory("red")

actorDB["buttonBrown"] = ROConnectedButtonFactory("brown", true)

export function diamondConnectedButtonFactory(color: string) {
	return class extends Actor {
		id = `button${color[0].toUpperCase()}${color.substr(1).toLowerCase()}`
		tags = ["button"]
		connectedActor: Actor | null = null
		explicitlyConnectedTile: Tile | null = null
		getLayer(): Layer {
			return Layer.STATIONARY
		}
		levelStarted(): void {
			// Search for an explicit connection
			for (const connection of this.level.connections)
				if (
					connection[0][0] === this.tile.x &&
					connection[0][1] === this.tile.y
				)
					this.explicitlyConnectedTile =
						this.level.field[connection[1][0]]?.[connection[1][1]]
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
			if (!this.connectedActor?.exists) this.connectedActor = null
			this.connectedActor?.buttonPressed?.(color)
		}
		actorLeft(): void {
			if (!this.connectedActor?.exists) this.connectedActor = null
			this.connectedActor?.buttonUnpressed?.(color)
		}
	}
}

actorDB["buttonOrange"] = diamondConnectedButtonFactory("orange")

export class ButtonPurple extends Actor {
	id = "buttonPurple"
	tags = ["button"]
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	wireOverlapMode = WireOverlapMode.NONE
	actorOnTile(actor: Actor): void {
		if (actor.layer !== Layer.MOVABLE) return
		this.poweringWires = 0b1111
	}
	processOutput(): void {
		this.poweringWires = 0
	}
	providesPower = true
	requiresFullConnect = true
}

actorDB["buttonPurple"] = ButtonPurple

export class ButtonBlack extends Actor {
	id = "buttonBlack"
	tags = ["button"]
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	wireOverlapMode = WireOverlapMode.ALWAYS_CROSS
	poweringWires = 0b1111
	processOutput() {
		for (const movable of this.tile[Layer.MOVABLE]) {
			if (movable.cooldown <= 0) {
				this.poweringWires = 0
				return
			}
		}
		this.poweringWires = 0b1111
	}
	providesPower = true
	requiresFullConnect = true
}

actorDB["buttonBlack"] = ButtonBlack

export class ToggleSwitch extends Actor {
	id = "toggleSwitch"
	tags = ["button"]
	getLayer(): Layer {
		return Layer.STATIONARY
	}

	actorCompletelyJoined(): void {
		this.customData = this.customData === "on" ? "off" : "on"
	}
	wireOverlapMode = WireOverlapMode.NONE
	// This is no error, this is how CC2 does it, too
	processOutput() {
		this.poweringWires = this.customData === "on" ? 0b1111 : 0
	}
	poweringWires = this.customData === "on" ? 0b1111 : 0
	providesPower = true
	requiresFullConnect = true
}

actorDB["toggleSwitch"] = ToggleSwitch

export class ButtonGray extends Actor {
	id = "buttonGray"
	tags = ["button"]
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	actorCompletelyJoined(): void {
		for (let y = -2; y <= 2; y++) {
			for (let x = -2; x <= 2; x++) {
				const tile = this.level.field[this.tile.x + x]?.[this.tile.y + y]
				if (!tile) continue
				getTileWirable(tile).pulse?.(false)
			}
		}
	}
}

actorDB["buttonGray"] = ButtonGray
