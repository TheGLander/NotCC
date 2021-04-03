import { Actor, SlidingState, ActorArt } from "../actor"
import { Layers } from "../tile"
import { actorDB } from "../const"
import { Wall } from "./walls"

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
		this.tile.addActors(
			new Wall(this.level, this.direction, this.tile.position)
		)
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
