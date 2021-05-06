import {
	Actor,
	genericDirectionableArt,
	ActorArt,
	genericAnimatedArt,
} from "../actor"
import { Layer } from "../tile"
import { Direction, relativeToAbsolute } from "../helpers"
import { Playable } from "./playables"
import { actorDB } from "../const"
import { genericStretchyArt } from "../actor"

export abstract class Monster extends Actor {
	blocks(): true {
		return true
	}
	tags = ["monster", "normal-monster", "movable"]
	get layer(): Layer {
		return Layer.MOVABLE
	}
	bumped(other: Actor): void {
		// Monsters kill players which bump into them if they can move into them
		if (other instanceof Playable) other.destroy(this)
	}
	// Monsters kill players which they bump into
	bumpedActor = this.bumped
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

export class TeethRed extends Monster {
	id = "teethRed"
	art = (() => {
		let currentFrame = 0
		return (): ActorArt => ({
			actorName: "teethRed",
			animation:
				this.direction % 2 === 0
					? "vertical"
					: ["right", "left"][(this.direction - 1) / 2],
			frame: this.cooldown ? Math.floor((currentFrame++ % 9) / 3) : 0,
		})
	})()
	decideMovement(): Direction[] {
		if (!this.level.selectedPlayable || (this.level.currentTick + 1) % 8 >= 4)
			return []
		const dx = this.tile.x - this.level.selectedPlayable.tile.x,
			dy = this.tile.y - this.level.selectedPlayable.tile.y
		const directions: Direction[] = []
		if (dx) directions.push(Math.sign(dx) + 2)
		if (dy) directions.push(-Math.sign(dy) + 1)
		if (Math.abs(dy) >= Math.abs(dx)) directions.reverse()
		return directions
	}
}

actorDB["teethRed"] = TeethRed

export class TankBlue extends Monster {
	id = "tankBlue"
	art = genericDirectionableArt("tankBlue", 2)
	turnPending = false
	decideMovement(): Direction[] {
		if (this.turnPending) {
			this.turnPending = false
			return [(this.direction + 2) % 4]
		}
		return [this.direction]
	}
	buttonPressed(color: string): void {
		if (color === "blue") this.turnPending = true
	}
}

actorDB["tankBlue"] = TankBlue

export class BlobMonster extends Monster {
	id = "blob"
	moveSpeed = 8
	art = genericStretchyArt("blob", 8)
	decideMovement(): [Direction] {
		return [(this.level.random() + this.level.blobMod()) % 4]
	}
}

actorDB["blob"] = BlobMonster

export class Walker extends Monster {
	id = "walker"
	art = genericStretchyArt("walker", 8)
	decideMovement(): [Direction] {
		if (!this.level.checkCollision(this, this.direction))
			return [(this.level.random() + this.direction) % 4]
		return [this.direction]
	}
}

actorDB["walker"] = Walker
