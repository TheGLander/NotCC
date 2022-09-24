import { Actor, SlidingState } from "../actor"
import { Layer } from "../tile"
import { Direction, relativeToAbsolute } from "../helpers"
import { GameState, KeyInputs, LevelState, onLevelAfterTick } from "../level"
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
		else return []
	}
	return directions
}

export abstract class Playable extends Actor {
	tags = ["playable", "real-playable"]
	// Players actually block everything, they just die if non-players bump into them
	blocks(): true {
		return true
	}
	pushTags = ["block"]
	hasOverride = false
	lastDecision = Decision.NONE
	playerBonked = false
	lastDecisionWasSliding = false
	constructor(
		level: LevelState,
		position: [number, number],
		customData?: string,
		direction?: Direction
	) {
		super(level, position, customData, direction)
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
	shouldDie(other: Actor) {
		// Can't be killed by a block we're pulling
		return !other.isPulled
	}
	_internalDecide(forcedOnly: boolean): void {
		this.moveDecision = Decision.NONE
		if (this.cooldown) return
		if (!forcedOnly) this.playerBonked = false

		// TODO Split screen

		let canMove =
			this.level.selectedPlayable === this &&
			(!this.slidingState ||
				(this.slidingState === SlidingState.WEAK && this.hasOverride)) &&
			!forcedOnly

		if (this.level.selectedPlayable === this && !forcedOnly) {
			if (
				this.level.gameInput.switchPlayable &&
				!this.level.releasedKeys.switchPlayable
			) {
				this.level.releasedKeys.switchPlayable = true
				this.level.selectedPlayable =
					this.level.playables[
						(this.level.playables.indexOf(this.level.selectedPlayable) + 1) %
							this.level.playables.length
					]
			}
			if (
				this.level.gameInput.rotateInv &&
				!this.level.releasedKeys.rotateInv &&
				this.inventory.items.length > 0
			) {
				this.inventory.items.unshift(this.inventory.items.pop() as Item)
				this.level.releasedKeys.rotateInv = true
			}
			if (
				this.level.gameInput.drop &&
				!this.level.releasedKeys.drop &&
				canMove
			) {
				this.dropItem()
				this.level.releasedKeys.drop = true
			}
		}
		this.lastDecisionWasSliding = false
		let bonked = false
		let [vert, horiz] = getMovementDirections(this.level.gameInput)
		if (
			this.slidingState &&
			(!canMove || (vert === undefined && horiz === undefined))
		) {
			// We are forced to move, or we *wanted* to be forced-moved
			this.moveDecision = this.direction + 1
			if (this.slidingState === SlidingState.WEAK && !forcedOnly)
				this.hasOverride = true
			this.lastDecisionWasSliding = true
		} else if (!canMove || (vert === undefined && horiz === undefined)) {
			// We don't wanna move or we can't
		} else {
			// We have a direction we certanly wanna move to
			if (vert === undefined || horiz === undefined) {
				// @ts-expect-error We ruled out the possibility of no directions earlier, so if any of them is undefined, the other one is not
				const chosenDirection: Direction = vert ?? horiz
				bonked = !this.checkCollision(chosenDirection)
				this.moveDecision = chosenDirection + 1
			} else {
				// We have two directions
				const canHoriz = this.checkCollision(horiz)
				//horiz = this.level.resolvedCollisionCheckDirection
				const canVert = this.checkCollision(vert)
				//vert = this.level.resolvedCollisionCheckDirection
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
			if (bonked && this === this.level.selectedPlayable) {
				this.playerBonked = true
			}
		}
		this.lastDecision =
			this.lastDecisionWasSliding && this.noSlidingBonk
				? Decision.NONE
				: this.moveDecision
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
	_internalStep(direction: Direction): boolean {
		const success = super._internalStep(direction)
		if (
			!success &&
			this.lastDecisionWasSliding &&
			this.slidingState &&
			this.noSlidingBonk
		) {
			this.bonked = false
		}
		if (!success && this.bonked && this === this.level.selectedPlayable) {
			this.playerBonked = true
		}
		return success
	}
}

export class Chip extends Playable {
	tags = [
		"playable",
		"real-playable",
		"chip",
		"can-reuse-key-green",
		"scares-teeth-blue",
	]
	transmogrifierTarget = "melinda"
	id = "chip"
}

actorDB["chip"] = Chip

export class Melinda extends Playable {
	tags = [
		"playable",
		"real-playable",
		"melinda",
		"can-reuse-key-yellow",
		"scares-teeth-red",
	]
	transmogrifierTarget = "chip"
	id = "melinda"
	ignoreTags = ["ice"]
}

actorDB["melinda"] = Melinda
