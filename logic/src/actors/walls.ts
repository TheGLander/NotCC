import { Actor, matchTags } from "../actor.js"
import { Layer } from "../tile.js"
import { actorDB } from "../const.js"
import { Direction, hasOwnProperty } from "../helpers.js"
import { Playable } from "./playables.js"
import { WireOverlapMode } from "../wires.js"
import { crossLevelData, onLevelAfterTick } from "../level.js"
export class Wall extends Actor {
	id = "wall"
	tags = ["wall", "tinnable"]
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	blocks(): boolean {
		return true
	}
}

actorDB["wall"] = Wall

export class SteelWall extends Actor {
	id = "steelWall"
	tags = ["blocks-ghost"]
	immuneTags = ["tnt"]
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	blocks(): boolean {
		return true
	}
	wireOverlapMode = WireOverlapMode.CROSS
}

actorDB["steelWall"] = SteelWall

export class CustomWall extends Actor {
	id = "customWall"
	tags = ["blocks-ghost"]
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	blocks(): boolean {
		return true
	}
}

actorDB["customWall"] = CustomWall

function doorFactory(color: string) {
	const sentenceCaseName =
		color[0].toUpperCase() + color.substr(1).toLowerCase()
	return class extends Actor {
		id = `door${sentenceCaseName}`
		tags = ["door"]
		blockTags = ["normal-monster", "cc1block"]
		getLayer(): Layer {
			return Layer.STATIONARY
		}
		blocks(other: Actor): boolean {
			return !(other.inventory.keys[`key${sentenceCaseName}`]?.amount > 0)
		}
		actorCompletelyJoined(other: Actor): void {
			if (!other.inventory.keys[`key${sentenceCaseName}`]?.amount) return
			other.inventory.keys[`key${sentenceCaseName}`].amount--
			other.inventory.keys[`key${sentenceCaseName}`].type.keyUsed?.(other)
			this.destroy(null, null)
		}
	}
}

actorDB["doorBlue"] = doorFactory("blue")

actorDB["doorRed"] = doorFactory("red")

actorDB["doorGreen"] = doorFactory("green")

actorDB["doorYellow"] = doorFactory("yellow")

const shortDirNames = ["u", "r", "d", "l"]

export class ThinWall extends Actor {
	id = "thinWall"
	tags = ["thinWall"].concat(
		this.customData.includes("c") ? ["canopy", "blocks-tnt"] : []
	)
	allowedDirections = Array.from(this.customData)
		.map(val =>
			shortDirNames.includes(val) ? 2 ** shortDirNames.indexOf(val) : 0
		)
		.reduce((acc, val) => acc + val, 0)
	shouldDie(): boolean {
		if (this.tags.includes("canopy")) {
			// Remove all traces of the canopy
			this.tags = ["thinWall"]
			this.customData = this.customData.split("c").join("")
			return false
		}
		return true
	}
	getLayer(): Layer {
		return Layer.SPECIAL
	}
	blocks(_actor: Actor, otherMoveDirection: Direction): boolean {
		return !!((2 ** ((otherMoveDirection + 2) % 4)) & this.allowedDirections)
	}
	exitBlocks(actor: Actor, otherMoveDirection: Direction): boolean {
		if (actor.getCompleteTags("tags").includes("ignores-exit-block"))
			return false
		return !!((2 ** otherMoveDirection) & this.allowedDirections)
	}
}

actorDB["thinWall"] = ThinWall

export class InvisibleWall extends Actor {
	id = "invisibleWall"
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	animationLeft = 0
	blocks(): true {
		return true
	}
	bumped(other: Actor, direction: Direction): void {
		if (
			this._internalCollisionIgnores(other, direction) ||
			matchTags(other.getCompleteTags("tags"), ["cc1block", "normal-monster"])
		)
			return
		this.animationLeft = 36
	}
	onEachDecision(): void {
		if (this.animationLeft) this.animationLeft--
	}
}

actorDB["invisibleWall"] = InvisibleWall

export class AppearingWall extends Actor {
	id = "appearingWall"
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	blocks(): true {
		return true
	}
	bumped(other: Actor, direction: Direction): void {
		if (
			this._internalCollisionIgnores(other, direction) ||
			matchTags(other.getCompleteTags("tags"), ["cc1block", "normal-monster"])
		)
			return
		this.destroy(null, null)
		new Wall(this.level, this.tile.position)
	}
}

actorDB["appearingWall"] = AppearingWall

export class BlueWall extends Actor {
	id = "blueWall"
	tags = ["wall"]
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	blocks(other: Actor): boolean {
		return (
			this.customData === "real" ||
			matchTags(other.getCompleteTags("tags"), ["cc1block", "normal-monster"])
		)
	}
	bumped(other: Actor, direction: Direction): void {
		if (
			this._internalCollisionIgnores(other, direction) ||
			matchTags(other.getCompleteTags("tags"), ["cc1block", "normal-monster"])
		)
			return
		this.destroy(null, null)
		if (this.customData === "real") new Wall(this.level, this.tile.position)
	}
}

actorDB["blueWall"] = BlueWall

export class ToggleWall extends Actor {
	id = "toggleWall"

	getLayer(): Layer {
		return Layer.STATIONARY
	}
	blocks(): boolean {
		return this.customData === "on"
	}
	pulse(): void {
		this.customData = this.customData === "on" ? "off" : "on"
	}
	greenToggle(): void {
		this.customData = this.customData === "on" ? "off" : "on"
	}
}

onLevelAfterTick.push(level => {
	if (crossLevelData.greenButtonPressed) {
		for (const terrain of level.actors) {
			if (
				hasOwnProperty(terrain, "greenToggle") &&
				typeof terrain.greenToggle === "function"
			)
				terrain.greenToggle()
		}
		crossLevelData.greenButtonPressed = false
	}
})

actorDB["toggleWall"] = ToggleWall

export class HoldWall extends Actor {
	id = "holdWall"
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	blocks(): boolean {
		return this.customData === "on"
	}
	pulse(): void {
		this.customData = this.customData === "on" ? "off" : "on"
	}
	unpulse(): void {
		this.customData = this.customData === "on" ? "off" : "on"
	}
}

actorDB["holdWall"] = HoldWall

/* export class SwivelRotatingPart extends Actor {
	id = "swivelRotatingPart"
	immuneTags = ["tnt"]
	getLayer(): Layer {
		return Layer.SPECIAL
	}
	blocks(_actor: Actor, otherMoveDirection: Direction): boolean {
		return (
			otherMoveDirection === (this.direction + 2) % 4 ||
			otherMoveDirection === (this.direction + 3) % 4
		)
	}
	actorLeft(actor: Actor): void {
		if (actor.direction === this.direction) this.direction++
		else if (actor.direction === (this.direction + 1) % 4) this.direction += 3
		this.direction %= 4
	}
} */

export class Swivel extends Actor {
	id = "swivel"
	// rotatingPart?: SwivelRotatingPart
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	/* levelStarted(): void {
		this.rotatingPart = new SwivelRotatingPart(this.level, this.tile.position)
		this.rotatingPart.direction = this.direction
	} */
	/* destroy(killer?: Actor | null, animType?: string | null): boolean {
		if (super.destroy(killer, animType)) {
			this.rotatingPart?.destroy(null, null)
			return true
		}
		return false
	}*/
	blocks(_actor: Actor, otherMoveDirection: Direction): boolean {
		return (
			otherMoveDirection === (this.direction + 2) % 4 ||
			otherMoveDirection === (this.direction + 3) % 4
		)
	}
	actorLeft(actor: Actor): void {
		if (actor.direction === this.direction) this.direction++
		else if (actor.direction === (this.direction + 1) % 4) this.direction += 3
		this.direction %= 4
	}
	pulse(): void {
		this.direction += 1
		this.direction %= 4
	}
}

actorDB["swivel"] = Swivel

export class GreenWall extends Actor {
	id = "greenWall"
	tags = ["wall"]
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	blocks(other: Actor): boolean {
		return (
			this.customData === "real" ||
			matchTags(other.getCompleteTags("tags"), ["block"])
		)
	}
}

actorDB["greenWall"] = GreenWall

export class NoChipSign extends Actor {
	id = "noChipSign"
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	blockTags = ["chip"]
}

actorDB["noChipSign"] = NoChipSign

export class NoMelindaSign extends Actor {
	id = "noMelindaSign"
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	blockTags = ["melinda"]
}

actorDB["noMelindaSign"] = NoMelindaSign
