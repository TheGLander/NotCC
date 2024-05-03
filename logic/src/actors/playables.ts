import { Actor, SlidingState } from "../actor.js"
import { Layer } from "../tile.js"
import { Direction, relativeToAbsolute } from "../helpers.js"
import { GameState, LevelState } from "../level.js"
import { Decision, actorDB } from "../const.js"
import { Item } from "./items.js"
import { GlitchInfo } from "../parsers/nccs.pb.js"
import { KeyInputs } from "../inputs.js"

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
	static tags = ["playable", "real-playable"]
	// Players actually block everything, they just die if non-players bump into them
	blocks(): true {
		return true
	}
	static pushTags = ["block"]
	hasOverride = false
	lastDecision = Decision.NONE
	playerBonked = false
	constructor(
		level: LevelState,
		position: [number, number],
		customData?: string,
		direction?: Direction
	) {
		super(level, position, customData, direction)
		level.playables.unshift(this)
		if (!this.level.selectedPlayable) this.level.selectedPlayable = this
		if (
			!this.level.levelStarted &&
			this.level.levelData?.playablesRequiredToExit === "all"
		) {
			this.level.playablesLeft += 1
		}
	}
	decideMovement(): Direction[] {
		const dir = relativeToAbsolute(this.direction)
		return [dir.RIGHT, dir.FORWARD, dir.LEFT, dir.BACKWARD]
	}
	getLayer(): Layer {
		return Layer.MOVABLE
	}
	getCanMove(): boolean {
		return (
			this.level.selectedPlayable === this &&
			(!this.slidingState ||
				(this.slidingState === SlidingState.WEAK && this.hasOverride))
		)
	}
	canDoAnything(): boolean {
		// Can't do anything if you're dead!
		if (!this.exists) return false
		if (this.level.selectedPlayable !== this) return false
		if (this.cooldown > 0) return false
		// Normal movement
		if (this.getCanMove()) return true
		// Player switching
		if (this.level.playablesLeft > 1) return true
		// Item cycling
		if (this.inventory.items.length >= 2) return true
		return false
	}
	shouldDie(other: Actor): boolean {
		// Can't be killed by a block we're pulling
		return !other.isPulled
	}
	_internalDecide(forcedOnly: boolean): void {
		this.moveDecision = Decision.NONE
		if (this.cooldown || this.frozen) return
		this.isPushing = false
		const wasBonked = this.playerBonked
		if (!forcedOnly) this.playerBonked = false

		let characterSwitched = false

		// TODO Split screen

		const canMove = this.getCanMove() && !forcedOnly

		if (this.level.selectedPlayable === this && !forcedOnly) {
			if (
				this.level.gameInput.switchPlayable &&
				this.level.playables.length > 1 &&
				!this.level.releasedKeys.switchPlayable
			) {
				this.level.releasedKeys.switchPlayable = true
				characterSwitched = true
				this.level.selectedPlayable =
					this.level.playables[
						(this.level.playables.indexOf(this.level.selectedPlayable) + 1) %
							this.level.playables.length
					]
			}
			if (
				this.level.gameInput.rotateInv &&
				!this.level.releasedKeys.rotateInv &&
				this.inventory.items.length > 0 &&
				!this.level.cc1Boots
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
		let bonked = false
		const [vert, horiz] = getMovementDirections(this.level.gameInput)
		if (
			this.slidingState &&
			(!canMove || (vert === undefined && horiz === undefined))
		) {
			// We are forced to move, or we *wanted* to be forced-moved
			this.moveDecision = this.direction + 1
			if (this.slidingState === SlidingState.WEAK && !forcedOnly)
				this.hasOverride = true
		} else if (!canMove || (vert === undefined && horiz === undefined)) {
			// We don't wanna move or we can't
		} else {
			if (characterSwitched) {
				this.level.addGlitch({
					glitchKind: GlitchInfo.KnownGlitches.SIMULTANEOUS_CHARACTER_MOVEMENT,
					location: { x: this.tile.x, y: this.tile.y },
				})
			}
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
			this.hasOverride = bonked && this.slidingState === SlidingState.WEAK
			if (
				bonked &&
				this === this.level.selectedPlayable &&
				!(
					this.tile[Layer.STATIONARY] &&
					this.tile[Layer.STATIONARY].hasTag("force-floor")
				)
			) {
				if (!wasBonked) {
					this.level.sfxManager?.playOnce("bump")
				}
				this.playerBonked = true
			}
		}
		this.lastDecision = this.moveDecision
	}
	deathReason?: string
	destroy(other?: Actor | null, anim?: string | null): boolean {
		if (!super.destroy(other, anim)) return false
		if (this.level.playables.includes(this)) {
			this.level.playables.splice(this.level.playables.indexOf(this), 1)
		}
		this.deathReason = other?.id
		this.level.gameState = GameState.DEATH
		return true
	}
	replaceWith(other: (typeof actorDB)[string]): Actor {
		const newActor = super.replaceWith(other) as Playable
		// `replaceWith` calls `destroy`, which is usually considered death, but
		// transformation isn't death, so actually undo all of the death reporting
		// the `destroy` did.
		delete this.deathReason
		if (this.level.selectedPlayable === this) {
			this.level.selectedPlayable = newActor
		}
		this.level.gameState = GameState.PLAYING
		return newActor
	}
}

export class Chip extends Playable {
	static tags = [
		"playable",
		"real-playable",
		"chip",
		"can-reuse-key-green",
		"scares-teeth-blue",
		"overpowers-trap-sliding",
		"plays-block-push-sfx",
	]
	transmogrifierTarget = "melinda"
	id = "chip"
}

actorDB["chip"] = Chip

export class Melinda extends Playable {
	static tags = [
		"playable",
		"real-playable",
		"melinda",
		"can-reuse-key-yellow",
		"scares-teeth-red",
		"overpowers-trap-sliding",
		"plays-block-push-sfx",
	]
	transmogrifierTarget = "chip"
	id = "melinda"
	static ignoreTags = ["ice"]
}

actorDB["melinda"] = Melinda
