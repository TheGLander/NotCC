import { Actor } from "../actor"
import { Layer } from "../tile"
import { actorDB, Decision } from "../const"
import { LevelState, crossLevelData, onLevelAfterTick } from "../level"

export abstract class Animation extends Actor {
	animationCooldown = 16
	blockTags = ["playable"]
	ignoreTags = ["!playable"]
	getLayer(): Layer {
		return Layer.MOVABLE
	}
	constructor(level: LevelState, position: [number, number]) {
		super(level, position)
		crossLevelData.queuedDespawns?.push(this)
	}
	_internalDecide(): void {
		this.pendingDecision = this.moveDecision = Decision.NONE
		this.animationCooldown--
		if (!this.animationCooldown) {
			this.destroy(null, null)
			if (this.tile.hasLayer(Layer.MOVABLE))
				this.tile[Layer.MOVABLE].next().value.despawn()
		}
	}
	// eslint-disable-next-line @typescript-eslint/no-empty-function
	_internalDoCooldown(): void {}
	bumped(other: Actor, moveDirection: number): void {
		if (this._internalBlocks(other, moveDirection)) return
		this.destroy(null, null)
	}
}

declare module "../level" {
	export interface CrossLevelDataInterface {
		queuedDespawns?: Animation[]
	}
}

crossLevelData.queuedDespawns = []

export class Explosion extends Animation {
	id = "explosionAnim"
}

actorDB["explosionAnim"] = Explosion

export class Splash extends Animation {
	id = "splashAnim"
}

actorDB["splashAnim"] = Splash
