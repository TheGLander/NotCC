import { Actor, matchTags } from "../actor"
import { Layer } from "../tile"
import { actorDB } from "../const"
import { Direction } from "../helpers"
import { Playable } from "./playables"
import { LevelState } from "../level"
export class Wall extends Actor {
	id = "wall"
	tags = ["wall"]
	get layer(): Layer {
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
	immuneTags = ["tnt"]
	get layer(): Layer {
		return Layer.STATIONARY
	}
	blocks(): boolean {
		return true
	}
}

actorDB["steelWall"] = SteelWall

export class CustomWall extends Actor {
	id = "customWall"
	get layer(): Layer {
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
		get layer(): Layer {
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

export class ThinWall extends Actor {
	id = "thinWall"
	tags = ["thinWall"]
	get layer(): Layer {
		return Layer.SPECIAL
	}
	blocks(_actor: Actor, otherMoveDirection: Direction): boolean {
		return otherMoveDirection === (this.direction + 2) % 4
	}
	exitBlocks(_actor: Actor, otherMoveDirection: Direction): boolean {
		return otherMoveDirection === this.direction
	}
}

actorDB["thinWall"] = ThinWall

export class InvisibleWall extends Actor {
	id = "invisibleWall"
	get layer(): Layer {
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
	get layer(): Layer {
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
	id = "wall"
	tags = ["wall"]
	get layer(): Layer {
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
	get layer(): Layer {
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

export class SwivelRotatingPart extends Actor {
	id = "swivelRotatingPart"
	immuneTags = ["tnt"]
	get layer(): Layer {
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
}

export class Swivel extends Actor {
	id = "swivel"
	rotatingPart?: SwivelRotatingPart
	get layer(): Layer {
		return Layer.STATIONARY
	}
	constructor(level: LevelState, position: [number, number]) {
		super(level, position)
	}
	levelStarted(): void {
		this.rotatingPart = new SwivelRotatingPart(this.level, this.tile.position)
		this.rotatingPart.direction = this.direction
	}
	destroy(killer?: Actor | null, animType?: string | null): boolean {
		if (super.destroy(killer, animType)) {
			this.rotatingPart?.destroy(null, null)
			return true
		}
		return false
	}
}

actorDB["swivel"] = Swivel

export class GreenWall extends Actor {
	id = "greenWall"
	tags = ["wall"]
	get layer(): Layer {
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
