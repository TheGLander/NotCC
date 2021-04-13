import {
	Actor,
	genericDirectionableArt,
	ActorArt,
	genericAnimatedArt,
} from "../actor"
import { Layers } from "../tile"
import { Direction, relativeToAbsolute } from "../helpers"
import { Playable } from "./playables"
import { actorDB } from "../const"

export abstract class Monster extends Actor {
	blockTags = ["!playable"]
	tags = ["monster", "normal-monster", "movable"]
	get layer(): Layers {
		return Layers.MOVABLE
	}
	newTileJoined(): void {
		const playable = this.tile[Layers.MOVABLE].find(
			val => val instanceof Playable
		)
		if (playable) playable.destroy(this)
	}
	bumped(other: Actor): void {
		// Monsters kill players which bump into them if they can move into them
		if (other instanceof Playable && !other._internalBlocks(this))
			other.destroy(this)
	}
}

export class Centipede extends Monster {
	id = "centipede"
	art = genericDirectionableArt("centipede", 3)
	decideMovement(): Direction[] {
		const dir = relativeToAbsolute(this.direction)
		return [dir.RIGHT, dir.FORWARD, dir.LEFT, dir.BACKWARD]
	}
}

actorDB["centipede"] = Centipede

export class Ant extends Monster {
	id = "ant"
	art = genericDirectionableArt("ant", 4)
	decideMovement(): Direction[] {
		const dir = relativeToAbsolute(this.direction)
		return [dir.LEFT, dir.FORWARD, dir.RIGHT, dir.BACKWARD]
	}
}

actorDB["ant"] = Ant

export class Glider extends Monster {
	id = "glider"
	ignoreTags = ["water"]
	art = genericDirectionableArt("glider", 2)
	decideMovement(): Direction[] {
		const dir = relativeToAbsolute(this.direction)
		return [dir.FORWARD, dir.LEFT, dir.RIGHT, dir.BACKWARD]
	}
}

actorDB["glider"] = Glider

export class Fireball extends Monster {
	id = "fireball"
	ignoreTags = ["fire"]
	tags = ["monster", "normal-monster", "movable", "melting"]
	// TODO Rotation
	art = genericAnimatedArt("fireball", 4)
	decideMovement(): Direction[] {
		const dir = relativeToAbsolute(this.direction)
		return [dir.FORWARD, dir.RIGHT, dir.LEFT, dir.BACKWARD]
	}
}

actorDB["fireball"] = Fireball

export class Ball extends Monster {
	id = "ball"
	art: ActorArt = { actorName: "ball" }
	decideMovement(): Direction[] {
		const dir = relativeToAbsolute(this.direction)
		return [dir.FORWARD, dir.BACKWARD]
	}
}

actorDB["ball"] = Ball
