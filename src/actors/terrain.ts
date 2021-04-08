import {
	Actor,
	SlidingState,
	ActorArt,
	genericDirectionableArt,
} from "../actor"
import { Layers } from "../tile"
import { actorDB } from "../const"
import { Wall } from "./walls"
import { genericAnimatedArt } from "../actor"
import { Playable } from "./playables"
import { GameState } from "../level"

export class Ice extends Actor {
	art: ActorArt = { actorName: "ice", animation: "normal" }
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
	art = genericDirectionableArt("forceFloor", 2)
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
	art = { actorName: "popupWall" }
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
	art = { actorName: "exit" }
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
	art = genericAnimatedArt("water", 4)
	get layer(): Layers {
		return Layers.STATIONARY
	}
	actorCompletelyJoined(other: Actor): void {
		other.destroy(this, "splash")
	}
}

actorDB["water"] = Water

export class Dirt extends Actor {
	art = { actorName: "dirt" }
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
	art: ActorArt = { actorName: "gravel" }
	get layer(): Layers {
		return Layers.STATIONARY
	}
	collisionTags = ["normal-monster", "melinda"]
}

actorDB["gravel"] = Gravel

export class Exit extends Actor {
	art = genericAnimatedArt("exit", 4)
	get layer(): Layers {
		return Layers.STATIONARY
	}
	collisionTags = ["monster", "cc1block"]
	actorCompletelyJoined(other: Actor): void {
		if (other instanceof Playable) {
			other.destroy(this, null)
			if (this.level.playables.length === 0)
				this.level.gameState = GameState.WON
		}
	}
}

actorDB["exit"] = Exit
