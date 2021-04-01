import { Actor, SlidingState, ActorArt } from "../actor"
import { Layers } from "../tile"
import { actorDB } from "../const"
import { Playable } from "./playables"
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
	blocks(other: Actor): boolean {
		return !(other instanceof Playable)
	}
	actorLeft(): void {
		this.tile.removeActors(this)
		this.tile.addActors(
			new Wall(this.level, this.direction, this.tile.position)
		)
		// TODO Proper removal
		this.level.activeActors.splice(this.level.activeActors.indexOf(this), 1)
	}
}

actorDB["popupWall"] = RecessedWall
