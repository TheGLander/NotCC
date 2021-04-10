import { Actor, ActorArt } from "../actor"
import { Layers } from "../tile"
import { actorDB } from "../const"

export abstract class Animation extends Actor {
	animationCooldown = 16
	blockTags = ["playable"]
	get layer(): Layers {
		return Layers.ANIMATION
	}
	onEachDecision(): void {
		this.animationCooldown--
		if (this.animationCooldown === 0) this.destroy(null, null) // Haha imagine if explosions recursively created more explosions
	}
	actorJoined(): void {
		// Welp, something stepped on us, byebye
		this.destroy(null, null)
	}
}

export class Explosion extends Animation {
	id = "explosionAnim"
	art = (): ActorArt => {
		return {
			actorName: "boom",
			animation: "default",
			frame: Math.floor(4 - this.animationCooldown / 4),
		}
	}
}

actorDB["explosionAnim"] = Explosion

export class Splash extends Animation {
	id = "splashAnim"
	art = (): ActorArt => {
		return {
			actorName: "splash",
			animation: "default",
			frame: Math.floor(4 - this.animationCooldown / 4),
		}
	}
}

actorDB["splashAnim"] = Splash
