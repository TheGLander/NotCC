import { Actor, SlidingState } from "../actor"
import { Layers } from "../tile"

export class Ice extends Actor {
	art = { art: "ice" }
	get layer(): Layers {
		return Layers.STATIONARY
	}
	actorJoined(other: Actor): void {
		other.slidingState = SlidingState.STRONG
	}
}
