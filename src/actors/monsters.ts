import { Actor, genericDirectionableArt } from "../actor"
import { Layers } from "../tile"
import { Direction, relativeToAbsolute } from "../helpers"
import { Playable } from "./playables"
import { actorDB } from "../const"

export class Monster extends Actor {
	moveSpeed = 4
	collisionTags = ["!playable"]
	tags = ["monster", "normal-monster"]
	get layer(): Layers {
		return Layers.MOVABLE
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
	bumped(other: Actor): void {
		// Monsters kill players which bump into them, for some reason (This only applies to slapping)
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

export class Ant extends Monster {
	art = genericDirectionableArt("ant")
	decideMovement(): Direction[] {
		const dir = relativeToAbsolute(this.direction)
		return [dir.LEFT, dir.FORWARD, dir.RIGHT, dir.BACKWARD]
	}
}

actorDB["ant"] = Ant

export class Glider extends Monster {
	ignoreTags = ["water"]
	art = genericDirectionableArt("glider")
	decideMovement(): Direction[] {
		const dir = relativeToAbsolute(this.direction)
		return [dir.FORWARD, dir.LEFT, dir.RIGHT, dir.BACKWARD]
	}
}

actorDB["glider"] = Glider

export class Fireball extends Monster {
	ignoreTags = ["fire"]
	tags = ["monster", "normal-monster", "melting"]
	art = genericDirectionableArt("fireball")
	decideMovement(): Direction[] {
		const dir = relativeToAbsolute(this.direction)
		return [dir.FORWARD, dir.RIGHT, dir.LEFT, dir.BACKWARD]
	}
}

actorDB["fireball"] = Fireball

export class Ball extends Monster {
	art = { art: "ball" }
	decideMovement(): Direction[] {
		const dir = relativeToAbsolute(this.direction)
		return [dir.FORWARD, dir.BACKWARD]
	}
}

actorDB["ball"] = Ball
