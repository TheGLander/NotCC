import { Actor, SlidingState } from "../actor"
import { Layer } from "../tile"
import { Direction, relativeToAbsolute } from "../helpers"
import { GameState, KeyInputs, LevelState } from "../level"
import { Decision, actorDB } from "../const"
import { Item } from "./items"

export function getMovementDirections(
	input: KeyInputs
): [Direction?, Direction?] {
	const directions: [Direction?, Direction?] = []
	for (const directionName of ["up", "right", "down", "left"] as const) {
		if (!input[directionName]) continue
		const direction =
			Direction[directionName.toUpperCase() as "UP" | "RIGHT" | "DOWN" | "LEFT"]
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

export abstract class Playable extends Actor {
	tags = ["playable"]
	// Players actually block everything, they just die if non-players bump into them
	blocks(): true {
		return true
	}
	pushTags = ["block"]
	hasOverride = false
	constructor(level: LevelState, position: [number, number]) {
		super(level, position)
		level.playables.unshift(this)
		if (!this.level.selectedPlayable) this.level.selectedPlayable = this
	}
	levelStarted(): void {
		if (this.level.levelData?.playablesRequiredToExit === "all")
			this.level.playablesLeft++
	}
	decideMovement(): Direction[] {
		const dir = relativeToAbsolute(this.direction)
		return [dir.RIGHT, dir.FORWARD, dir.LEFT, dir.BACKWARD]
	}
	getLayer(): Layer {
		return Layer.MOVABLE
	}

	_internalDecide(forcedOnly: boolean): void {
		this.moveDecision = Decision.NONE
		if (
			this.level.selectedPlayable === this &&
			(this.slidingState || !this.cooldown) &&
			this.level.gameInput.switchPlayable &&
			this.level.debouncedInputs.switchPlayable <= 0
		) {
			this.level.playablesToSwap = true
			this.level.debounceInput("switchPlayable")
		}
		// TODO Split screen

		if (this.cooldown) return

		let canMove =
			this.level.selectedPlayable === this &&
			(!this.slidingState ||
				(this.slidingState === SlidingState.WEAK && this.hasOverride)) &&
			!forcedOnly
		if (canMove) {
			if (
				this.level.gameInput.rotateInv &&
				this.level.debouncedInputs.rotateInv <= 0
			) {
				if (this.inventory.items.length > 0)
					this.inventory.items.unshift(this.inventory.items.pop() as Item)
				this.level.debounceInput("rotateInv")
			}
			if (this.level.gameInput.drop && this.level.debouncedInputs.drop <= 0) {
				this.dropItem()
				this.level.debounceInput("drop")
			}
		}

		let [vert, horiz] = getMovementDirections(this.level.gameInput)
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
				bonked = !this.level.checkCollision(this, vert ?? horiz)
				this.moveDecision = this.level.resolvedCollisionCheckDirection + 1
			} else {
				// We have two directions
				const canHoriz = this.level.checkCollision(this, horiz)
				horiz = this.level.resolvedCollisionCheckDirection
				const canVert = this.level.checkCollision(this, vert)
				vert = this.level.resolvedCollisionCheckDirection
				if (canHoriz && !canVert) this.moveDecision = horiz + 1
				else if (canVert && !canHoriz) this.moveDecision = vert + 1
				else {
					// We can move in both / none directions, crap
					bonked = !canHoriz
					// Just discovered: When both dirs are blocked, always choose horiz
					if (!canHoriz) this.moveDecision = horiz + 1
					else {
						// We first try to be biased towards current direction
						if (horiz === this.direction) this.moveDecision = horiz + 1
						else if (vert === this.direction) this.moveDecision = vert + 1
						// As a last resort, we always pick horiz over vert
						else this.moveDecision = horiz + 1
					}
				}
			}
			this.hasOverride = bonked
		}
	}
	destroy(other?: Actor | null, anim?: string | null): boolean {
		if (!super.destroy(other, anim)) return false
		if (this.level.playables.includes(this))
			this.level.playables.splice(this.level.playables.indexOf(this), 1)
		this.level.gameState = GameState.LOST
		return true
	}
	replaceWith(other: typeof actorDB[string]): Actor {
		const newActor = super.replaceWith(other)
		if (this.level.selectedPlayable === this)
			this.level.selectedPlayable = newActor as Playable
		this.level.gameState = GameState.PLAYING
		return newActor
	}
}

export class Chip extends Playable {
	tags = ["playable", "chip", "can-reuse-key-green", "scares-teeth-blue"]
	transmogrifierTarget = "melinda"
	id = "chip"
}

actorDB["chip"] = Chip

export class Melinda extends Playable {
	tags = ["playable", "melinda", "can-reuse-key-yellow", "scares-teeth-red"]
	transmogrifierTarget = "chip"
	id = "melinda"
	ignoreTags = ["ice"]
}

actorDB["melinda"] = Melinda
