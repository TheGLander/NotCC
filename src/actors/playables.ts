import { Actor, genericDirectionableArt, SlidingState } from "../actor"
import { Layers } from "../tile"
import { Direction, relativeToAbsolute } from "../helpers"
import { KeyInputs } from "../pulse"
import { GameState, LevelState } from "../level"
import { Decision, actorDB } from "../const"

// TODO Move chip-specific behavior outta here

export abstract class Playable extends Actor {
	tags = ["playable"]
	blockTags = ["playable"]
	pushTags = ["block"]
	lastInputs?: KeyInputs
	hasOverride = false
	constructor(level: LevelState, position: [number, number]) {
		super(level, position)
		level.playables.push(this)
		if (!level.selectedPlayable) level.selectedPlayable = this
	}
	decideMovement(): Direction[] {
		const dir = relativeToAbsolute(this.direction)
		return [dir.RIGHT, dir.FORWARD, dir.LEFT, dir.BACKWARD]
	}
	get layer(): Layers {
		return Layers.MOVABLE
	}
	/**
	 * Used internally for input management
	 */
	getMovementDirections(): [Direction?, Direction?] {
		if (!this.lastInputs) return []
		const directions: [Direction?, Direction?] = []
		for (const directionName of ["up", "right", "down", "left"] as const) {
			if (!this.lastInputs[directionName]) continue
			const direction =
				Direction[
					directionName.toUpperCase() as "UP" | "RIGHT" | "DOWN" | "LEFT"
				]
			/**
			 * Type of the direction, 0 is vertical, 1 is horizontal (Not a pseudo-boolean)
			 */
			const dirType = direction % 2
			if (directions[dirType] === undefined) directions[dirType] = direction
			// If we have a counter-direction, reset the direction type
			else directions[dirType] = undefined
		}
		return directions
	}
	_internalDecide(forcedOnly: boolean): void {
		this.moveDecision = Decision.NONE
		if (this.cooldown) return

		const canMove =
			!forcedOnly &&
			(!this.slidingState ||
				(this.slidingState === SlidingState.WEAK && this.hasOverride))

		// TODO Inventory stuff
		const [vert, horiz] = this.getMovementDirections()
		if (
			this.slidingState &&
			(!canMove || (vert === undefined && horiz === undefined))
		) {
			// We are forced to move, or we *wanted* to be forced-moved
			this.moveDecision = this.direction + 1
			if (this.slidingState === SlidingState.WEAK) this.hasOverride = true
		} else if (!canMove || (vert === undefined && horiz === undefined)) {
			// We don't wanna move or we can't
		} else {
			let bonked = false
			// We have a direction we certanly wanna move to
			if (vert === undefined || horiz === undefined) {
				// @ts-expect-error We ruled out the possibility of no directions earlier, so if any of them is undefined, the other one is not
				this.moveDecision = (vert ?? horiz) + 1
				bonked = !this.level.checkCollision(this, this.moveDecision - 1, true)
			} else {
				// We have two directions
				const canHoriz = this.level.checkCollision(this, horiz, true)
				const canVert = this.level.checkCollision(this, vert, true)
				if (canHoriz && !canVert) this.moveDecision = horiz + 1
				else if (canVert && !canHoriz) this.moveDecision = vert + 1
				else {
					bonked = !canHoriz
					// We can move in both / none directions, crap
					// We first try to be biased towards current direction
					if (horiz === this.direction) this.moveDecision = horiz + 1
					else if (vert === this.direction) this.moveDecision = vert + 1
					// As a last resort, we always pick horiz over vert
					else this.moveDecision = horiz + 1
				}
			}
			this.hasOverride = bonked
		}
	}
	destroy(other?: Actor | null, anim?: string | null): void {
		this.level.gameState = GameState.LOST
		super.destroy(other, anim)
		this.level.playables.splice(this.level.playables.indexOf(this), 1)
		if (this === this.level.selectedPlayable) {
			if (this.level.playables[0])
				this.level.selectedPlayable = this.level.playables[0]
		}
	}
}

export class Chip extends Playable {
	tags = ["playable", "chip", "can-reuse-key-green"]
	id = "chip"
	art = genericDirectionableArt("chip", 8)
}

actorDB["chip"] = Chip
