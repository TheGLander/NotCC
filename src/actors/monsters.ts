import { Actor, genericDirectionableArt } from "../actor"
import { Layers } from "../tile"
import { Direction, relativeToAbsolute } from "../helpers"
import { Playable } from "./playables"
import { actorDB } from "../const"

export class Monster extends Actor {
	moveSpeed = 4
	get layer(): Layers {
		return Layers.MOVABLE
	}
	blocks(other: Actor): boolean {
		return !(other instanceof Playable)
	}
	newTileJoined(): void {
		const playable = this.tile[Layers.MOVABLE].find(
			val => val instanceof Playable
		)
		if (playable) this.actorJoined(playable)
	}
	actorJoined(other: Actor): void {
		if (other instanceof Playable) other.destroy(this)
	}
}

export class Centipede extends Monster {
	art = genericDirectionableArt("centipede")
	decideMovement(): Direction[] {
		const dir = relativeToAbsolute(this.direction)
		return [dir.RIGHT, dir.FORWARD, dir.LEFT, dir.BACKWARD]
	}
}

actorDB["centipede"] = Centipede

export class Ball extends Monster {
	art = { art: "ball" }
	decideMovement(): Direction[] {
		const dir = relativeToAbsolute(this.direction)
		return [dir.FORWARD, dir.BACKWARD]
	}
}

actorDB["ball"] = Ball
