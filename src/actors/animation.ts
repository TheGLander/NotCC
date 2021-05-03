import { Actor, ActorArt } from "../actor"
import { Layers } from "../tile"
import { actorDB } from "../const"
import { LevelState, onLevelDecisionTick, crossLevelData } from "../level"

export abstract class Animation extends Actor {
	animationCooldown = 16
	blockTags = ["playable"]
	get layer(): Layers {
		return Layers.MOVABLE
	}
	constructor(level: LevelState, position: [number, number]) {
		super(level, position)
		// If there is any movable on the tile, despawn self and queue despawn of anything on the tile
		if (this.tile[Layers.MOVABLE].length > 1) {
			this.destroy(null, null)
			crossLevelData.queuedDespawns?.push({
				ticksLeft: this.animationCooldown,
				position: this.tile.position,
			})
		}
	}
	onEachDecision(): void {
		this.animationCooldown--
		if (this.animationCooldown === 0 && !this.despawned)
			this.destroy(null, null) // Haha imagine if explosions recursively created more explosions
	}
	actorJoined(): void {
		// Welp, something stepped on us, byebye
		this.destroy(null, null)
	}
}

export interface QueuedAnimationDespawn {
	ticksLeft: number
	position: [number, number]
}

onLevelDecisionTick.push(level => {
	if (!crossLevelData.queuedDespawns) return
	for (const despawn of [...crossLevelData.queuedDespawns]) {
		despawn.ticksLeft--
		if (despawn.ticksLeft <= 0) {
			level.field[despawn.position[0]]?.[despawn.position[1]]?.[
				Layers.MOVABLE
			][0]?.despawn()
			crossLevelData.queuedDespawns.splice(
				crossLevelData.queuedDespawns.indexOf(despawn),
				1
			)
		}
	}
})

declare module "../level" {
	export interface CrossLevelDataInterface {
		queuedDespawns?: QueuedAnimationDespawn[]
	}
}

crossLevelData.queuedDespawns = []

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
