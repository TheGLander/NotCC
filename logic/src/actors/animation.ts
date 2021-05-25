import { Actor } from "../actor"
import { Layer } from "../tile"
import { actorDB, Decision } from "../const"
import {
	LevelState,
	onLevelDecisionTick,
	crossLevelData,
	onLevelAfterTick,
} from "../level"

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
		if (this.cooldown) this.cooldown++
	}
	bumped(): void {
		this.destroy(null, null)
		crossLevelData.queuedDespawns?.splice(
			crossLevelData.queuedDespawns.indexOf(this),
			1
		)
	}
}

onLevelAfterTick.push(() => {
	if (!crossLevelData.queuedDespawns) return
	for (const anim of [...crossLevelData.queuedDespawns]) {
		anim.animationCooldown--
		if (anim.animationCooldown <= 0) {
			// Always destoy the animation, just to not mess up anything
			anim.destroy(null, null)
			// If we were actually despawned, despawn that
			if (anim.tile[Layer.MOVABLE][0]) anim.tile[Layer.MOVABLE][0].despawn()
			crossLevelData.queuedDespawns.splice(
				crossLevelData.queuedDespawns.indexOf(anim),
				1
			)
		}
	}
})

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
