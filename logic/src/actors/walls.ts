import { Actor, matchTags } from "../actor"
import { Layer } from "../tile"
import { actorDB } from "../const"
import { Direction } from "../helpers"
import { Playable } from "./playables"
import { WireOverlapMode } from "../wires"
export class Wall extends Actor {
	id = "wall"
	tags = ["wall"]
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	blocks(): boolean {
		return true
	}
}

actorDB["wall"] = Wall

// TODO Ghost blockage
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
		blockTags = ["normal-monster", "cc1-block"]
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
			this.destroy(other, null)
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
	tags = ["thinWall"]
	allowedDirections = Array.from(this.customData)
		.map(val =>
			shortDirNames.includes(val) ? 2 ** shortDirNames.indexOf(val) : 0
		)
		.reduce((acc, val) => acc + val, 0)

	getLayer(): Layer {
		return Layer.SPECIAL
	}
	blocks(_actor: Actor, otherMoveDirection: Direction): boolean {
		return !!((2 ** ((otherMoveDirection + 2) % 4)) & this.allowedDirections)
	}
	exitBlocks(_actor: Actor, otherMoveDirection: Direction): boolean {
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
	bumped(other: Actor): void {
		// TODO Dupes and rovers also mark this as visible
		if (other instanceof Playable) this.animationLeft = 36
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
	bumped(other: Actor): void {
		// TODO Dupes and rovers also mark this as visible
		if (other instanceof Playable) {
			this.destroy(other, null)
			new Wall(this.level, this.tile.position)
		}
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
	bumped(other: Actor): void {
		if (
			matchTags(other.getCompleteTags("tags"), ["cc1block", "normal-monster"])
		)
			return
		this.destroy(other, null)
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
	caresButtonColors = ["green"]
	buttonPressed(): void {
		this.customData = this.customData === "on" ? "off" : "on"
	}
}

actorDB["toggleWall"] = ToggleWall

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
