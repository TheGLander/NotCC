import { Actor, ActorArt, matchTags } from "../actor"
import { Layers } from "../tile"
import { actorDB } from "../const"
import { Direction } from "../helpers"
import { Playable } from "./playables"
export class Wall extends Actor {
	id = "wall"
	tags = ["wall"]
	art: ActorArt = { actorName: "wall" }
	get layer(): Layers {
		return Layers.STATIONARY
	}
	blocks(): boolean {
		return true
	}
}

actorDB["wall"] = Wall

function doorFactory(color: string) {
	const sentenceCaseName =
		color[0].toUpperCase() + color.substr(1).toLowerCase()
	return class extends Actor {
		id = `door${sentenceCaseName}`
		tags = ["door"]
		blockTags = ["normal-monster", "cc1-block"]
		art: ActorArt = { actorName: "door", animation: color }
		get layer(): Layers {
			return Layers.STATIONARY
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
	get layer(): Layers {
		return Layers.SPECIAL
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
	get layer(): Layers {
		return Layers.STATIONARY
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
	get layer(): Layers {
		return Layers.STATIONARY
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
	get layer(): Layers {
		return Layers.STATIONARY
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
	art: () => ActorArt = () => ({
		actorName: "outline",
		animation: "green",
		compositePieces:
			this.customData === "on" ? [{ actorName: "outlineWall" }] : [],
	})
	get layer(): Layers {
		return Layers.STATIONARY
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
