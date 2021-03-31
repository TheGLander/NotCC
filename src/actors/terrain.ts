import { Actor, SlidingState, ActorArt } from "../actor"
import { Layers } from "../tile"
import { actorDB } from "../const"

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
