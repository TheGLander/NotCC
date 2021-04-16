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
import { GameState, LevelState } from "../level"

export class Ice extends Actor {
	id = "ice"
	tags = ["ice"]
	art: ActorArt = { actorName: "ice" }
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
	id = "forceFloor"
	tags = ["force-floor"]
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
	id = "popupWall"
	art = { actorName: "popupWall" }
	get layer(): Layers {
		return Layers.STATIONARY
	}
	// Funny how recessed walls have the exact same collision as monsters
	blockTags = ["!playable"]
	actorLeft(): void {
		this.destroy(this, null)
		new Wall(this.level, this.tile.position)
	}
}

actorDB["popupWall"] = RecessedWall

export class Void extends Actor {
	id = "void"
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
	id = "water"
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
	id = "dirt"
	tags = ["filth"]
	art = { actorName: "dirt" }
	get layer(): Layers {
		return Layers.STATIONARY
	}
	blockTags = ["cc1block", "normal-monster", "melinda"]
	actorCompletelyJoined(): void {
		this.destroy(this, null)
	}
}

actorDB["dirt"] = Dirt

export class Gravel extends Actor {
	id = "gravel"
	tags = ["filth"]
	art: ActorArt = { actorName: "gravel" }
	get layer(): Layers {
		return Layers.STATIONARY
	}
	blockTags = ["normal-monster", "melinda"]
}

actorDB["gravel"] = Gravel

export class Exit extends Actor {
	id = "exit"
	art = genericAnimatedArt("exit", 4)
	get layer(): Layers {
		return Layers.STATIONARY
	}
	blockTags = ["monster", "cc1block"]
	actorCompletelyJoined(other: Actor): void {
		if (other instanceof Playable) {
			other.destroy(this, null)
			if (this.level.playables.length === 0)
				this.level.gameState = GameState.WON
		}
	}
}

actorDB["exit"] = Exit

export class EChipGate extends Actor {
	id = "echipGate"
	art = { actorName: "echipGate" }
	get layer(): Layers {
		return Layers.STATIONARY
	}
	blockTags = ["normal-monster", "block"] // TODO Directional blocks
	actorCompletelyJoined(other: Actor): void {
		if (this.level.chipsLeft === 0) this.destroy(other, null)
	}
	blocks(): boolean {
		return this.level.chipsLeft !== 0
	}
}

actorDB["echipGate"] = EChipGate

export class Hint extends Actor {
	id = "hint"
	art = { actorName: "hint" }
	hint: string | null = null
	constructor(level: LevelState, position: [number, number]) {
		super(level, position)
		const hint =
			level.hintsLeft.length === 1 ? level.hintsLeft[0] : level.hintsLeft.pop()
		if (hint) this.hint = hint
	}
	get layer(): Layers {
		return Layers.STATIONARY
	}
	actorCompletelyJoined(other: Actor): void {
		// Sorry
		if (other instanceof Playable && this.hint) alert(this.hint)
	}
	blockTags = ["normal-monster", "cc1block"]
}

actorDB["hint"] = Hint

export class Fire extends Actor {
	id = "fire"
	art = genericAnimatedArt("fire", 4)
	tags = ["fire"]
	blockTags = ["monster"]
	get layer(): Layers {
		return Layers.STATIONARY
	}
	actorCompletelyJoined(other: Actor): void {
		other.destroy(this)
	}
}

actorDB["fire"] = Fire
