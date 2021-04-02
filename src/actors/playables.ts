import { Actor, genericDirectionableArt, SlidingState } from "../actor"
import { Layers } from "../tile"
import { Direction, relativeToAbsolute } from "../helpers"
import { KeyInputs } from "../pulse"
import { LevelState } from "../level"
import { Decision, actorDB } from "../const"

export class Playable extends Actor {
	art = genericDirectionableArt("chip")
	lastInputs?: KeyInputs
	lastStepSlideMode: SlidingState = SlidingState.NONE
	constructor(
		level: LevelState,
		direction: Direction,
		position: [number, number]
	) {
		super(level, direction, position)
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
				(this.slidingState === SlidingState.WEAK &&
					this.lastStepSlideMode === SlidingState.WEAK))

		// TODO Inventory stuff
		const [vert, horiz] = this.getMovementDirections()
		if (this.slidingState && !canMove) {
			// We are forced to move
			this.moveDecision = this.direction + 1
			this.lastStepSlideMode = this.slidingState
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
			// We were bonked instantly, so we are actually still moving due to the weak slide
			if (bonked) this.lastStepSlideMode = this.slidingState
			// We were not bonked and did something, so we were not sliding then
			else this.lastStepSlideMode = SlidingState.NONE
		}
	}
	moveSpeed = 4
	destroy(other?: Actor | null, anim?: string | null): void {
		// TODO Helmet stuff
		this.level.lost = true
		super.destroy(other, anim)
	}
}

actorDB["chip"] = Playable
