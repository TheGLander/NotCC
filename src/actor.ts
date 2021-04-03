import { LevelState } from "./level"
import { Decision, actorDB } from "./const"
import { Direction } from "./helpers"
import { Layers } from "./tile"
import Tile from "./tile"
import { Animation } from "./actors/animation"

/**
 * Current state of sliding, playables can escape weak sliding.
 */
export enum SlidingState {
	NONE,
	// Force floors
	WEAK,
	// Ice
	STRONG,
}

export interface ActorArt {
	/**
	 * Name of the art piece to display
	 */
	art: string
	/**
	 * The direction the art piece should be facing
	 */
	rotation?: number
}

/**
 * Checks if a tag collections matches a tag rule of another tag collection.
 * @param actorTags The tag collection the actor has, they are being tested against the rules, cannot have tags which start with "!"
 * @param ruleTags The rules which the actor tags are tested for. A rule is considered fulfilled if
 *
 * a. The rule tag does not start with "!" and is present in the actor tag collection
 *
 * b. The rule tag starts with "!", and the actor tag collection does not contain the rule tag (with the "!" removed)
 * @example ```js
 * matchTags(["foo", "bar"], ["bar", "baz"]) // true
 * matchTags(["foo", "baz"], ["!foo"]) // false
 * matchTags(["foo", "bar"], ["!foo", "bar"]) // true
 * ```
 */
export function matchTags(actorTags: string[], ruleTags: string[]): boolean {
	return !!ruleTags.find(val =>
		val.startsWith("!")
			? !actorTags.includes(val.substr(1))
			: actorTags.includes(val)
	)
}

export abstract class Actor {
	moveDecision = Decision.NONE
	currentMoveSpeed: number | null = null
	oldTile: Tile | null = null
	cooldown = 0
	pendingDecision = Decision.NONE
	slidingState = SlidingState.NONE
	abstract layer: Layers
	art?: ActorArt | (() => ActorArt)
	/**
	 * Tags which the actor can push, provided the pushed actor can be pushed
	 */
	pushTags: string[] = []
	/**
	 * General-use tags to use, for example, for collisions
	 */
	tags: string[] = []
	/**
	 * Tags which this actor blocks.
	 */
	collisionTags: string[] = []
	/**
	 * Tags which this actor will not conduct any interactions with.
	 */
	ignoreTags: string[] = []
	_internalIgnores(other: Actor): boolean {
		// TODO Item additional tags/code(?)
		return (
			matchTags(this.tags, other.ignoreTags) ||
			matchTags(other.tags, this.ignoreTags)
		)
	}
	/**
	 * Amount of ticks it takes for the actor to move
	 */
	moveSpeed = 0
	tile: Tile
	pushable = false

	constructor(
		public level: LevelState,
		public direction: Direction,
		position: [number, number]
	) {
		level.activeActors.unshift(this)
		this.tile = level.field[position[0]][position[1]]
		this.tile.addActors([this])
	}
	/**
	 * Decides the movements the actor will attempt to do
	 * Must return an array of absolute directions
	 */
	decideMovement?(): (Direction | (() => Direction))[]
	onBlocked?(blocker?: Actor): void
	onEachDecision?(forcedOnly: boolean): void
	_internalDecide(forcedOnly = false): void {
		this.moveDecision = Decision.NONE
		this.onEachDecision?.(forcedOnly)
		if (this.cooldown) return
		this.currentMoveSpeed = this.oldTile = null
		// This is where the decision *actually* begins
		// If the thing has a decision queued up, do it forcefully
		// (Currently only used for blocks pushed while sliding)
		if (this.pendingDecision) {
			this.moveDecision = this.pendingDecision
			return
		}
		// Since this is a generic actor, we cannot override weak sliding
		// TODO Ghost ice shenanigans
		if (this.slidingState) {
			this.moveDecision = this.direction + 1
			return
		}
		if (forcedOnly) return
		// TODO Traps
		const directions = this.decideMovement?.()

		if (!directions) return

		// eslint-disable-next-line prefer-const
		for (let [i, direction] of directions.entries()) {
			direction = typeof direction === "function" ? direction() : direction
			// TODO Force redirection of movement (train tracks)

			if (this.level.checkCollision(this, direction)) {
				// Yeah, we can go here
				this.moveDecision = direction + 1
				return
			}

			// Force last decision if all other fail
			if (i === directions.length - 1) this.moveDecision = direction + 1
		}
	}
	// This is defined separately only because of Instabonking:tm:
	_internalStep(direction: Direction): boolean {
		if (this.cooldown) return false
		// TODO Force redirection of movement (train tracks)
		this.direction = direction
		const canMove = this.level.checkCollision(this, direction, true)
		// Welp, something stole our spot, too bad
		if (!canMove || !this.moveSpeed) return false
		const newTile = this.tile.getNeighbor(direction)
		if (!newTile) return false
		// TODO Speed mods
		const moveLength = this.moveSpeed * 3
		this.currentMoveSpeed = this.cooldown = moveLength
		this.oldTile = this.tile
		this.tile = newTile
		// Finally, move ourselves to the new tile
		this._internalUpdateTileStates()
		return true
	}
	_internalMove(): void {
		if (this.cooldown > 0 || !this.moveDecision) return
		const ogDirection = this.moveDecision - 1
		const bonked = !this._internalStep(ogDirection)
		this.pendingDecision = Decision.NONE
		if (bonked && this.slidingState) {
			for (const bonkListener of this.tile.allActors)
				bonkListener.onMemberSlideBonked?.(this)
			if (ogDirection !== this.direction) this._internalStep(this.direction)
		}
	}
	blocks?(other: Actor): boolean
	blockedBy?(other: Actor): boolean
	/**
	 * Called when another actor on the tile was bonked while sliding
	 */
	onMemberSlideBonked?(other: Actor): void
	/**
	 * Called when another actor leaves the current tile
	 */
	actorLeft?(other: Actor): void
	/**
	 * Called when another actor joins the current tile
	 */
	actorJoined?(other: Actor): void
	/**
	 * Called when another actor stops moving after joining a tile
	 */
	actorCompletelyJoined?(other: Actor): void
	/**
	 * Called when this actor steps on a new tile
	 */
	newTileJoined?(): void
	/**
	 * Called when this actor stops walking to a new tile
	 */
	newTileCompletelyJoined?(): void

	_internalBlocks(other: Actor): boolean {
		return (
			!this._internalIgnores(other) &&
			(this.blocks?.(other) ||
				other.blockedBy?.(this) ||
				matchTags(other.tags, this.collisionTags))
		)
	}
	_internalDoCooldown(): void {
		if (this.cooldown === 1) {
			this.cooldown--
			for (const actor of this.tile.allActors)
				if (!this._internalIgnores(actor)) actor.actorCompletelyJoined?.(this)
			this.newTileCompletelyJoined?.()
		} else if (this.cooldown > 0) this.cooldown--
	}
	/**
	 * Updates tile states and calls hooks
	 */
	_internalUpdateTileStates(): void {
		this.oldTile?.removeActors(this)
		this.tile.addActors(this)
		// Spread from and to to not have actors which create new actors instantly be interacted with
		if (this.oldTile)
			for (const actor of [...this.oldTile.allActors])
				if (!this._internalIgnores(actor)) actor.actorLeft?.(this)
		this.slidingState = SlidingState.NONE
		for (const actor of [...this.tile.allActors])
			if (!this._internalIgnores(actor)) actor.actorJoined?.(this)
		this.newTileJoined?.()
	}
	destroy(killer?: Actor | null, animType: string | null = "explosion"): void {
		// TODO Avoid killing if we ignore the actor
		this.tile.removeActors(this)
		this.level.activeActors.splice(this.level.activeActors.indexOf(this), 1)
		this.level.destroyedThisTick.push(this)
		if (animType && actorDB[`${animType}Anim`]) {
			// @ts-expect-error Obviously, this is not an abstract class
			const anim: Animation = new actorDB[`${animType}Anim`](
				this.level,
				this.direction,
				this.tile.position
			)

			anim.currentMoveSpeed = this.currentMoveSpeed
			anim.cooldown = this.cooldown
		}
	}
	/**
	 * Called when another actor bumps into this actor
	 * @param other The actor which bumped into this actor
	 */
	bumped?(other: Actor): void
	_internalCanPush(other: Actor): boolean {
		return (
			!this._internalIgnores(other) &&
			matchTags(other.tags, this.pushTags) &&
			other.pushable
		)
	}
}
/**
 * Creates an art function for a generic directionable actor
 */
export const genericDirectionableArt = (name: string) =>
	function (this: Actor): ActorArt {
		return {
			art: `${name}${["Up", "Right", "Down", "Left"][this.direction]}`,
		}
	}
