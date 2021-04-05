import { Actor, SlidingState, ActorArt } from "../actor"
import { Layers } from "../tile"
import { actorDB } from "../const"
import { Wall } from "./walls"
import { LevelState } from "../level"

export class Ice extends Actor {
	art = { art: "ice" }
	get layer(): Layers {
		return Layers.STATIONARY
	}
	actorJoined(other: Actor): void {
		other.slidingState = SlidingState.STRONG
	}
	onMemberSlideBonked(other: Actor): void {
		// Turn the other way
		other.direction += 2
		other.direction %= 4
	}
	speedMod(): 2 {
		return 2
	}
}
actorDB["ice"] = Ice

export class ForceFloor extends Actor {
	art = (): ActorArt => ({ art: "forceFloor", rotation: this.direction * 90 })
	get layer(): Layers {
		return Layers.STATIONARY
	}
	actorCompletelyJoined(other: Actor): void {
		other.slidingState = SlidingState.WEAK
		other.direction = this.direction
	}
	onMemberSlideBonked(other: Actor): void {
		// Give them a single subtick of cooldown
		other.cooldown++
	}
	speedMod(): 2 {
		return 2
	}
}

actorDB["forceFloor"] = ForceFloor

export class RecessedWall extends Actor {
	art = { art: "popupWall" }
	get layer(): Layers {
		return Layers.STATIONARY
	}
	// Funny how recessed walls have the exact same collision as monsters
	collisionTags = ["!playable"]
	actorLeft(): void {
		this.destroy(this, null)
		new Wall(this.level, this.tile.position)
	}
}

actorDB["popupWall"] = RecessedWall

export class Void extends Actor {
	art = { art: "exit" }
	get layer(): Layers {
		return Layers.STATIONARY
	}
	actorCompletelyJoined(other: Actor): void {
		other.destroy(this, null)
	}
}

actorDB["void"] = Void

export class Water extends Actor {
	tags = ["water"]
	art = { art: "water" }
	get layer(): Layers {
		return Layers.STATIONARY
	}
	actorCompletelyJoined(other: Actor): void {
		other.destroy(this, "splash")
	}
}

actorDB["water"] = Water

export class Dirt extends Actor {
	art = { art: "dirt" }
	get layer(): Layers {
		return Layers.STATIONARY
	}
	collisionTags = ["cc1block", "normal-monster", "melinda"]
	actorCompletelyJoined(): void {
		this.destroy(this, null)
	}
}

actorDB["dirt"] = Dirt

export class Gravel extends Actor {
	art = { art: "gravel" }
	get layer(): Layers {
		return Layers.STATIONARY
	}
	collisionTags = ["normal-monster", "melinda"]
}

actorDB["gravel"] = Gravel

export class BlueTeleport extends Actor {
	get layer(): Layers {
		return Layers.STATIONARY
	}
	art = { art: "teleportBlue" }
	actorCompletelyJoined(other: Actor): void {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		let otherTeleport: BlueTeleport = this
		let x = this.tile.x - 1
		loop: for (
			let y = this.tile.y;
			y !== this.tile.y || x !== this.tile.x;
			y = (y + this.level.height - 1) % this.level.height
		)
			for (x = x === -1 ? this.level.width - 1 : x; x >= 0; x--) {
				const newTeleport: BlueTeleport | undefined = this.level.field[x][
					y
				].allActors.find(val => val instanceof BlueTeleport) as
					| BlueTeleport
					| undefined
				if (
					newTeleport &&
					this.level.checkCollision(newTeleport, other.direction, false)
				) {
					otherTeleport = newTeleport
					break loop
				}
			}
		other.oldTile = other.tile
		other.tile = otherTeleport.tile
		other._internalUpdateTileStates()
		other.slidingState = SlidingState.STRONG
		other._internalStep(other.direction)
	}
}

actorDB["teleportBlue"] = BlueTeleport
