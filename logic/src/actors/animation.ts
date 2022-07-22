import { Actor } from "../actor"
import { Layer } from "../tile"
import { actorDB, Decision } from "../const"
import { LevelState } from "../level"
import { Direction } from "../helpers"

export abstract class Animation extends Actor {
	animationCooldown = 16
	animationLength = 16
	moveSpeed: number = 0
	blockTags = ["real-playable"]
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
	}
	_internalDecide(): void {
		this.pendingDecision = this.moveDecision = Decision.NONE
		this.animationCooldown--
		if (!this.animationCooldown) this.destroy(null, null)
	}
	// eslint-disable-next-line @typescript-eslint/no-empty-function
	_internalDoCooldown(): void {}
	bumped(other: Actor, moveDirection: number): void {
		if (this._internalBlocks(other, moveDirection)) return
		this.destroy(null, null)
	}
}

export class Explosion extends Animation {
	id = "explosionAnim"
}

actorDB["explosionAnim"] = Explosion

export class Splash extends Animation {
	id = "splashAnim"
}

actorDB["splashAnim"] = Splash
