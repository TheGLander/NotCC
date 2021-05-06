import { Actor, ActorArt, matchTags } from "../actor"
import { Layer } from "../tile"
import { actorDB } from "../const"
import { Direction } from "../helpers"
import { Playable } from "./playables"
import { LevelState } from "../level"
export class Wall extends Actor {
	id = "wall"
	tags = ["wall"]
	art: ActorArt = { actorName: "wall" }
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
	art: ActorArt = { actorName: "steelWall" }
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
	art: ActorArt = { actorName: "customWall", animation: this.customData }
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
		art: ActorArt = { actorName: "door", animation: color }
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
	art: () => ActorArt = () => ({
		actorName: "thinWall",
		animation: ["up", "right", "down", "left"][this.direction],
		cropSize: [
			(((this.direction + 1) % 2) + 1) / 2,
			((this.direction % 2) + 1) / 2,
		],
		imageOffset: [
			this.direction === Direction.RIGHT ? 0.5 : 0,
			this.direction === Direction.DOWN ? 0.5 : 0,
		],
	})
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

// TODO Secret eye interaction thing

export class InvisibleWall extends Actor {
	id = "invisibleWall"
	get layer(): Layer {
		return Layer.STATIONARY
	}
	animationLeft = 0
	art = (): ActorArt => ({ actorName: this.animationLeft ? "wall" : null })
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
	art: ActorArt = { actorName: "blueWall" }
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
	art = () => [
		{
			actorName: "outline",
			animation: "green",
		},
		this.customData === "on" && { actorName: "outlineWall" },
	]
	get layer(): Layer {
		return Layer.STATIONARY
	}
	blocks(): boolean {
		return this.customData === "on"
	}
	buttonPressed(color: string): void {
		if (color === "green")
			this.customData = this.customData === "on" ? "off" : "on"
	}
}

actorDB["toggleWall"] = ToggleWall

export class SwivelRotatingPart extends Actor {
	id = "swivelRotatingPart"
	immuneTags = ["tnt"]
	art = (): ActorArt => ({
		actorName: "swivel",
		animation: ["ur", "dr", "dl", "ul"][this.direction],
	})
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
	art = { actorName: "swivel", animation: "floor" }
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
	art = (): ActorArt => ({
		actorName: "greenWall",
		animation:
			this.customData === "real" || this.tile[Layer.MOVABLE].length === 0
				? "real"
				: "fake",
	})
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
