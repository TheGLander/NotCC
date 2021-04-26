import { Actor, ActorArt } from "../actor"
import { Layers } from "../tile"
import { actorDB } from "../const"
import { Direction } from "../helpers"
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
