import { Actor } from "../actor"
import { Layers } from "../tile"
import { actorDB } from "../const"
import { Playable } from "./playables"

export class Animation extends Actor {
	animationCooldown = 16
	get layer(): Layers {
		return Layers.ANIMATION
	}
	blocks(other: Actor): boolean {
		return other instanceof Playable
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
	art = { art: "boom" }
}

actorDB["explosionAnim"] = Explosion

export class Splash extends Animation {
	art = { art: "splash" }
}

actorDB["splashAnim"] = Splash
