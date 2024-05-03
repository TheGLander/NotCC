import { Actor } from "../actor.js"
import { Layer } from "../tile.js"
import { actorDB, Decision } from "../const.js"
import { Tile } from "../tile.js"
import { getTileWirable, WireOverlapMode } from "../wires.js"
import { onLevelStart } from "../level.js"

export function globalButtonFactory(color: string) {
	return class extends Actor {
		id = `button${color[0].toUpperCase()}${color.substr(1).toLowerCase()}`
		static tags = ["button"]
		getLayer(): Layer {
			return Layer.STATIONARY
		}
		actorCompletelyJoined(): void {
			this.level.sfxManager?.playOnce("button press")

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
		static tags = ["button"]
		getLayer(): Layer {
			return Layer.STATIONARY
		}
		actorCompletelyJoined(other: Actor): void {
			this.level.sfxManager?.playOnce("button press")

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

class ButtonGreen extends globalButtonFactory("green") {
	actorCompletelyJoined(): void {
		super.actorCompletelyJoined()
		this.level.greenButtonPressed = !this.level.greenButtonPressed
	}
}

actorDB["buttonGreen"] = ButtonGreen

class ButtonBlue extends globalButtonFactory("blue") {
	actorCompletelyJoined(): void {
		super.actorCompletelyJoined()
		this.level.blueButtonPressed = !this.level.blueButtonPressed
	}
}

actorDB["buttonBlue"] = ButtonBlue

class ComplexButtonYellow extends globalComplexButtonFactory("yellow") {
	actorCompletelyJoined(other: Actor): void {
		super.actorCompletelyJoined(other)
		this.level.currentYellowButtonPress = other.direction + 1
	}
}

actorDB["complexButtonYellow"] = ComplexButtonYellow

export function ROConnectedButtonFactory(
	color: string,
	shouldActivateOnLevelStart?: boolean
) {
	return class extends Actor {
		id = `button${color[0].toUpperCase()}${color.substr(1).toLowerCase()}`
		static tags = ["button"]
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
			this.level.sfxManager?.playOnce("button press")
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
		static tags = ["button"]
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
			} else {
				const maxDimension = Math.max(this.level.width, this.level.height)
				mainLoop: for (
					let currentLevel = 1;
					currentLevel <= maxDimension + 1;
					currentLevel += 1
				) {
					for (const tile of this.tile.getDiamondSearch(currentLevel)) {
						for (const actor of tile.allActors) {
							if (actor.caresButtonColors.includes(color)) {
								this.connectedActor = actor
								break mainLoop
							}
						}
					}
				}
			}
		}
		actorCompletelyJoined(): void {
			this.level.sfxManager?.playOnce("button press")
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
	static tags = ["button"]
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	wireOverlapMode = WireOverlapMode.NONE
	actorCompletelyJoined(): void {
		this.level.sfxManager?.playOnce("button press")
	}
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
	static tags = ["button"]
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	wireOverlapMode = WireOverlapMode.ALWAYS_CROSS
	poweringWires = 0b1111
	actorCompletelyJoined(): void {
		this.level.sfxManager?.playOnce("button press")
	}
	processOutput() {
		const movable = this.tile[Layer.MOVABLE]
		if (movable && movable.cooldown <= 0) {
			this.poweringWires = 0
			return
		}

		this.poweringWires = 0b1111
	}
	providesPower = true
	requiresFullConnect = true
}

actorDB["buttonBlack"] = ButtonBlack

export class ToggleSwitch extends Actor {
	id = "toggleSwitch"
	static tags = ["button"]
	getLayer(): Layer {
		return Layer.STATIONARY
	}

	actorCompletelyJoined(): void {
		this.level.sfxManager?.playOnce("button press")

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
	static tags = ["button"]
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	actorCompletelyJoined(): void {
		this.level.sfxManager?.playOnce("button press")

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
