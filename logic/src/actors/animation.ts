import { Actor } from "../actor"
import { Layer } from "../tile"
import { actorDB } from "../const"
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
		crossLevelData.queuedDespawns?.push({
			ticksLeft: this.animationCooldown,
			position: this.tile.position,
		})
	}
	onEachDecision(): void {
		this.animationCooldown--
		if (this.cooldown) this.cooldown++
	}
	// Despawning means destroying, for animations
	despawn(): void {
		if (this.level.actors.includes(this))
			this.level.actors.splice(this.level.actors.indexOf(this), 1)
		if (this.level.decidingActors.includes(this))
			this.level.decidingActors.splice(
				this.level.decidingActors.indexOf(this),
				1
			)
		super.despawn(true)
	}
}

export interface QueuedAnimationDespawn {
	ticksLeft: number
	position: [number, number]
	animationOnly?: boolean
}

onLevelDecisionTick.push(level => {
	if (!crossLevelData.queuedDespawns) return
	for (const despawn of [...crossLevelData.queuedDespawns]) {
		despawn.ticksLeft--
		if (despawn.ticksLeft <= 0) {
			const actors =
				level.field[despawn.position[0]]?.[despawn.position[1]]?.[Layer.MOVABLE]
			if (despawn.animationOnly)
				actors.find(val => val instanceof Animation)?.despawn()
			else actors[0]?.despawn()
			crossLevelData.queuedDespawns.splice(
				crossLevelData.queuedDespawns.indexOf(despawn),
				1
			)
		}
	}
})

onLevelAfterTick.push(level => {
	if (crossLevelData.queuedDespawns)
		for (const despawn of [...crossLevelData.queuedDespawns])
			if (despawn.animationOnly === undefined)
				// If the tile has an animation, this is for animations ONLY
				despawn.animationOnly = level.field[despawn.position[0]]?.[
					despawn.position[1]
				]?.[Layer.MOVABLE]?.some(actor => actor instanceof Animation)
})

declare module "../level" {
	export interface CrossLevelDataInterface {
		queuedDespawns?: QueuedAnimationDespawn[]
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
