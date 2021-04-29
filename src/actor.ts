import { LevelState } from "./level"
import { Decision, actorDB } from "./const"
import { Direction } from "./helpers"
import { Layers } from "./tile"
import Tile from "./tile"
import { Item, Key } from "./actors/items"

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
	actorName: string | null
	/**
	 * Name of the art piece to display, "default" by default, if null, doesn't draw anything
	 */
	animation?: string | null
	frame?: number
	/**
	 * Offsets the art by a certain amount, 0 is up/left, 1 is bottom/right, [0, 0] by default
	 */
	imageOffset?: [number, number]
	/**
	 * Crops the art by a certain amount `1` is one tile worth of art, [1, 1] by default
	 */
	cropSize?: [number, number]
	/**
	 * Additional art to draw
	 */
	compositePieces?: ActorArt[]
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

export interface Inventory {
	keys: Record<string, { amount: number; type: Key }>
	items: Item[]
	// The max amount of items the actor can carry
	itemMax: number
}

export abstract class Actor {
	moveDecision = Decision.NONE
	currentMoveSpeed: number | null = null
	oldTile: Tile | null = null
	cooldown = 0
	pendingDecision = Decision.NONE
	slidingState = SlidingState.NONE
	abstract layer: Layers
	abstract id: string
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
	 * Tags which this actor blocks
	 */
	blockTags: string[] = []
	/**
	 * Tags which this actor is blocked by
	 */
	blockedByTags: string[] = []

	/**
	 * Tags which this actor refuses to be blocked by
	 */
	collisionIgnoreTags: string[] = []
	/**
	 * Tags which this actor will not conduct any interactions with.
	 */
	ignoreTags: string[] = []
	getCompleteTags<T extends keyof this>(id: T): string[] {
		// @ts-expect-error Typescript dumb
		return this[id] instanceof Array
			? [
					...((this[id] as unknown) as string[]),
					...this.inventory.items.reduce(
						(acc, val) => [
							...acc, // @ts-expect-error Typescript dumb
							...(val.carrierTags[id] ? val.carrierTags[id] : []),
						],
						new Array<string>()
					),
			  ]
			: null
	}

	_internalIgnores(other: Actor): boolean {
		return (
			matchTags(
				this.getCompleteTags("tags"),
				other.getCompleteTags("ignoreTags")
			) ||
			matchTags(
				other.getCompleteTags("tags"),
				this.getCompleteTags("ignoreTags")
			)
		)
	}

	/**
	 * Amount of ticks it takes for the actor to move
	 */
	moveSpeed = 4
	tile: Tile
	direction = Direction.UP
	inventory: Inventory = {
		items: [],
		keys: {},
		itemMax: 4,
	}
	dropItem(): void {
		const itemToDrop = this.inventory.items.pop()
		if (!itemToDrop) return
		itemToDrop.oldTile = null
		itemToDrop.tile = this.tile
		this.level.actors.push(itemToDrop)
		itemToDrop._internalUpdateTileStates()
		itemToDrop.onDrop?.(this)
	}
	constructor(
		public level: LevelState,
		position: [number, number],
		public customData = ""
	) {
		level.actors.push(this)
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
		// If we have a pending decision, don't do anything, doing decisions may cause a state change, otherwise
		if (this.pendingDecision) return
		// This is where the decision *actually* begins
		this.currentMoveSpeed = this.oldTile = null
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
		const moveLength = (this.moveSpeed * 3) / newTile.getSpeedMod(this)
		this.currentMoveSpeed = this.cooldown = moveLength
		this.oldTile = this.tile
		this.tile = newTile
		// Finally, move ourselves to the new tile
		this._internalUpdateTileStates()
		return true
	}
	_internalMove(): void {
		// If the thing has a decision queued up, do it forcefully
		// (Currently only used for blocks pushed while sliding)
		if (this.pendingDecision) {
			this.moveDecision = this.pendingDecision
			this.pendingDecision = Decision.NONE
		}

		if (this.cooldown > 0 || !this.moveDecision) return
		const ogDirection = this.moveDecision - 1
		const bonked = !this._internalStep(ogDirection)
		if (bonked && this.slidingState) {
			for (const bonkListener of this.tile.allActors)
				bonkListener.onMemberSlideBonked?.(this)
			if (ogDirection !== this.direction) this._internalStep(this.direction)
		}
	}
	blocks?(other: Actor, otherMoveDirection: Direction): boolean
	blockedBy?(other: Actor, thisMoveDirection: Direction): boolean
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

	_internalBlocks(other: Actor, moveDirection: Direction): boolean {
		return (
			!matchTags(
				this.getCompleteTags("tags"),
				other.getCompleteTags("collisionIgnoreTags")
			) &&
			!this._internalIgnores(other) &&
			(this.blocks?.(other, moveDirection) ||
				other.blockedBy?.(this, moveDirection) ||
				matchTags(
					other.getCompleteTags("tags"),
					this.getCompleteTags("blockTags")
				) ||
				matchTags(
					this.getCompleteTags("tags"),
					other.getCompleteTags("blockedByTags")
				))
		)
	}
	_internalDoCooldown(): void {
		if (this.cooldown === 1) {
			this.cooldown--
			for (const actor of [...this.tile.allActors])
				if (actor !== this && !this._internalIgnores(actor))
					actor.actorCompletelyJoined?.(this)
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
			if (actor !== this && !this._internalIgnores(actor))
				actor.actorJoined?.(this)
		this.newTileJoined?.()
	}
	destroy(killer?: Actor | null, animType: string | null = "explosion"): void {
		if (killer && this._internalIgnores(killer)) return
		this.tile.removeActors(this)
		this.level.actors.splice(this.level.actors.indexOf(this), 1)
		this.level.destroyedThisTick.push(this)
		if (animType && actorDB[`${animType}Anim`]) {
			const anim = new actorDB[`${animType}Anim`](
				this.level,
				this.tile.position
			)
			anim.direction = this.direction
			anim.currentMoveSpeed = this.currentMoveSpeed
			anim.cooldown = this.cooldown
		}
	}
	/**
	 * Called when another actor bumps into this actor
	 * @param other The actor which bumped into this actor
	 */
	bumped?(other: Actor, bumpDirection: Direction): void
	_internalCanPush(other: Actor): boolean {
		return (
			!this._internalIgnores(other) &&
			matchTags(other.getCompleteTags("tags"), this.getCompleteTags("pushTags"))
		)
	}
	/**
	 * Called when a new actor enters the tile, must return the number to divide the speed by
	 */
	speedMod?(other: Actor): number
	/**
	 * Called when another actor tries to exit the tile this actor is on
	 * @param other The actor which tried to exit
	 * @param exitDirection The direction the actor is trying to exit in
	 */
	exitBlocks?(other: Actor, exitDirection: Direction): boolean
	_internalExitBlocks(other: Actor, exitDirection: Direction): boolean {
		// TODO Block exit via tags(?) Not sure if that can be useful
		return (
			(!this._internalIgnores(other) &&
				this.exitBlocks?.(other, exitDirection)) ??
			false
		)
	}
	/**
	 * Called when a button is pressed, called only when the button applies to the actor
	 * @param type The string color name of the button
	 */
	buttonPressed?(type: string): void
}
/**
 * Creates an art function for a generic directionable actor
 */
export const genericDirectionableArt = (name: string, animLength: number) => {
	let currentFrame = 0
	return function (this: Actor): ActorArt {
		return {
			actorName: name,
			animation: ["up", "right", "down", "left"][this.direction],
			frame: this.cooldown
				? Math.floor((currentFrame++ % (animLength * 3)) / 3)
				: 0,
		}
	}
}

export const genericAnimatedArt = (name: string, animLength: number) => {
	let currentFrame = 0
	return function (this: Actor): ActorArt {
		return {
			actorName: name,
			frame: Math.floor((currentFrame++ % (animLength * 3)) / 3),
		}
	}
}
