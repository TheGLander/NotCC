import { Actor, SlidingState } from "../actor.js"
import { Layer } from "../tile.js"
import { actorDB, Decision } from "../const.js"
import { LevelState } from "../level.js"
import { Direction } from "../helpers.js"

export abstract class Animation extends Actor {
	animationCooldown = 16
	animationLength = 16
	moveSpeed = 0
	static blockTags = ["real-playable"]
	abstract getSfx(): string
	getLayer(): Layer {
		return Layer.MOVABLE
	}
	constructor(
		level: LevelState,
		position: [number, number],
		customData = "",
		direction?: Direction
	) {
		super(level, position, customData, direction)
		if (customData === "extended") {
			this.animationCooldown += 3
			this.animationLength += 3
			this.animationCooldown--
		}
		level.sfxManager?.playOnce(this.getSfx())
	}
	_internalDecide(): void {
		this.pendingDecision = this.moveDecision = Decision.NONE
		this.slidingState = SlidingState.NONE
		this.pendingDecisionLockedIn = false
		this.animationCooldown--
		if (!this.animationCooldown) this.destroy(null, null)
	}
	// eslint-disable-next-line @typescript-eslint/no-empty-function
	_internalDoCooldown(): void {}
	bumped(other: Actor, moveDirection: number): void {
		if (
			this._internalBlocks(other, moveDirection) ||
			other instanceof Animation
		)
			return
		this.destroy(null, null)
	}
}

export class Explosion extends Animation {
	id = "explosionAnim"
	getSfx(): string {
		return "explosion"
	}
}

actorDB["explosionAnim"] = Explosion

export class Splash extends Animation {
	id = "splashAnim"
	getSfx(): string {
		return "splash"
	}
}

actorDB["splashAnim"] = Splash
