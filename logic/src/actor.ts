import { LevelState, crossLevelData } from "./level"
import { Decision, actorDB } from "./const"
import { Direction } from "./helpers"
import { Layer } from "./tile"
import Tile from "./tile"
import { Item, Key } from "./actors/items"
import { iterableIncludes } from "./iterableHelpers"

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
	abstract getLayer(): Layer
	layer: Layer
	abstract id: string
	despawned = false
	isDeciding = false
	/**
	 * Kinda like destroying, but bugged and shouldn't be used
	 */
	despawn(intended = false): void {
		this.despawned = true
		this.tile.removeActors(this)
		if (!intended) {
			crossLevelData.despawnedActors?.push(this)
			console.warn("A despawn has happended")
		}
	}
	respawn(): void {
		this.despawned = false
		if (!iterableIncludes(this.tile.allActors, this)) {
			// Remove all other things on the same layer
			for (const actor of this.tile[this.layer]) actor.despawn()
			this.tile.optimizedState[this.layer] = this
		}
	}
	/**
	 * Tags which the actor can push, provided the pushed actor can be pushed
	 */
	pushTags?: string[]
	/**
	 * General-use tags to use, for example, for collisions
	 */
	tags?: string[]
	/**
	 * Tags which this actor blocks
	 */
	blockTags?: string[]
	/**
	 * Tags which this actor is blocked by
	 */
	blockedByTags?: string[]

	/**
	 * Tags which this actor refuses to be blocked by
	 */
	collisionIgnoreTags?: string[]
	/**
	 * Tags which this actor will not conduct any interactions with.
	 */
	ignoreTags?: string[]
	/**
	 * Tags which this actor should not be destroyed by
	 */
	immuneTags?: string[]
	getCompleteTags<T extends keyof this>(id: T): string[] {
		return [
			...((this[id] as unknown as string[])
				? (this[id] as unknown as string[])
				: []),
			...this.inventory.items.reduce(
				(acc, val) => [
					...acc, // @ts-expect-error Typescript dumb
					...(val.carrierTags?.[id] ? val.carrierTags[id] : []),
				],
				new Array<string>()
			),
		]
	}
	ignores?(other: Actor): boolean
	_internalIgnores(other: Actor): boolean {
		return (
			(matchTags(
				this.getCompleteTags("tags"),
				other.getCompleteTags("ignoreTags")
			) ||
				matchTags(
					other.getCompleteTags("tags"),
					this.getCompleteTags("ignoreTags")
				) ||
				this.ignores?.(other) ||
				other.ignores?.(this)) ??
			false
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
		if (this.tile.hasLayer(Layer.ITEM)) return
		const itemToDrop = this.inventory.items.pop()
		if (!itemToDrop) return
		if (this.despawned)
			alert(
				"At this state, the game really should crash, so this is really undefined behavior"
			)
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
		this.layer = this.getLayer()
		level.actors.push(this)
		this.tile = level.field[position[0]][position[1]]
		for (const actor of this.tile[this.layer]) actor.despawn()
		this.tile.optimizedState[this.layer] = this
		if (level.levelStarted)
			for (const actor of this.tile.allActors)
				if (actor.newActorOnTile && !actor._internalIgnores(this))
					actor.newActorOnTile(this)
		this.isDeciding = !!(
			this.layer === Layer.MOVABLE ||
			this.onEachDecision ||
			this.decideMovement
		)
		if (this.isDeciding) level.decidingActors.push(this)
	}
	/**
	 * Decides the movements the actor will attempt to do
	 * Must return an array of absolute directions
	 */
	decideMovement?(): Direction[]
	onBlocked?(blocker?: Actor): void
	onEachDecision?(forcedOnly: boolean): void
	_internalDecide(forcedOnly = false): void {
		this.moveDecision = Decision.NONE
		if (this.cooldown) return
		// If we have a pending decision, don't do anything, doing decisions may cause a state change, otherwise
		if (this.pendingDecision) return
		// This is where the decision *actually* begins
		this.currentMoveSpeed = null
		// Since this is a generic actor, we cannot override weak sliding
		// TODO Ghost ice shenanigans
		if (this.slidingState) {
			this.moveDecision = this.direction + 1
			return
		}
		this.onEachDecision?.(forcedOnly)
		if (forcedOnly) return
		const directions = this.decideMovement?.()

		if (!directions) return

		for (const direction of directions)
			if (this.level.checkCollision(this, direction)) {
				// Yeah, we can go here
				this.moveDecision = direction + 1
				return
			}

		// Force last decision if all other fail
		if (directions.length > 0)
			this.moveDecision = directions[directions.length - 1] + 1
	}

	_internalStep(direction: Direction): boolean {
		if (this.cooldown || !this.moveSpeed) return false
		this.direction = direction
		const canMove = this.level.checkCollision(this, direction, true)
		this.direction = this.level.resolvedCollisionCheckDirection
		// Welp, something stole our spot, too bad
		if (!canMove) return false
		if (!this.isDeciding) this.level.decidingActors.push(this)
		this.isDeciding = true
		const newTile = this.tile.getNeighbor(
			this.level.resolvedCollisionCheckDirection
		)
		// This is purely a defensive programming thing, shouldn't happen normally (checkCollision should check for going OOB)
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
				if (!this._internalIgnores(bonkListener))
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
	/**
	 * Called when a new actor was born on the same tile as this
	 */
	newActorOnTile?(actor: Actor): void
	_internalShouldDestroy(other: Actor): boolean {
		return !(
			this._internalIgnores(other) ||
			matchTags(
				other.getCompleteTags("tags"),
				this.getCompleteTags("immuneTags")
			)
		)
	}

	_internalBlocks(other: Actor, moveDirection: Direction): boolean {
		return (
			!matchTags(
				this.getCompleteTags("tags"),
				other.getCompleteTags("collisionIgnoreTags")
			) &&
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
		if (!this.cooldown) {
			for (const actor of [...this.tile.allActors])
				if (actor !== this && !this._internalIgnores(actor))
					actor.continuousActorCompletelyJoined?.(this)
		}
	}
	/**
	 * Updates tile states and calls hooks
	 */
	_internalUpdateTileStates(): void {
		if (this.despawned) {
			// We moved! That means this is no longer despawned and we are no longer omni-present
			this.despawned = false
			if (crossLevelData.despawnedActors?.includes(this))
				crossLevelData.despawnedActors.splice(
					crossLevelData.despawnedActors.indexOf(this),
					1
				)
		}
		this.oldTile?.removeActors(this)
		// Spread from and to to not have actors which create new actors instantly be interacted with
		if (this.oldTile) {
			for (const actor of this.oldTile[this.layer]) actor.despawn(false)
			for (const actor of [...this.oldTile.allActors])
				if (!this._internalIgnores(actor)) actor.actorLeft?.(this)
		}
		// Despawn all actors which are already there, you should've blocked this, if you cared to exist!
		for (const actor of this.tile[this.layer]) actor.despawn(false)

		this.tile.addActors(this)
		this.slidingState = SlidingState.NONE
		for (const actor of [...this.tile.allActors])
			if (actor !== this && !this._internalIgnores(actor))
				actor.actorJoined?.(this)
		this.newTileJoined?.()
	}
	destroy(
		killer?: Actor | null,
		animType: string | null = "explosion"
	): boolean {
		if (killer && !this._internalShouldDestroy(killer)) return false
		if (this.level.actors.includes(this))
			this.level.actors.splice(this.level.actors.indexOf(this), 1)
		if (this.level.decidingActors.includes(this))
			this.level.decidingActors.splice(
				this.level.decidingActors.indexOf(this),
				1
			)
		this.despawn(true)
		if (
			animType &&
			actorDB[`${animType}Anim`] &&
			!this.tile.hasLayer(Layer.MOVABLE)
		) {
			const anim = new actorDB[`${animType}Anim`](
				this.level,
				this.tile.position
			)
			anim.direction = this.direction
			anim.currentMoveSpeed = this.currentMoveSpeed
			anim.cooldown = this.cooldown
		}
		return true
	}
	/**
	 * Called when another actor bumps into this actor
	 * @param other The actor which bumped into this actor
	 */
	bumped?(other: Actor, bumpDirection: Direction): void
	/**
	 * Called when this actor bumps into another actor
	 * @param other The actor which this actor bumped into
	 */
	bumpedActor?(other: Actor, bumpDirection: Direction): void
	_internalCanPush(other: Actor, direction: Direction): boolean {
		return (
			!other.cooldown &&
			!this._internalIgnores(other) &&
			matchTags(
				other.getCompleteTags("tags"),
				this.getCompleteTags("pushTags")
			) &&
			(other.canBePushed?.(this, direction) ?? true)
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
			(!matchTags(
				this.getCompleteTags("tags"),
				other.getCompleteTags("collisionIgnoreTags")
			) &&
				this.exitBlocks?.(other, exitDirection)) ??
			false
		)
	}
	/**
	 * The colors of buttons this actor cares about
	 */
	caresButtonColors: string[] = []
	/**
	 * Called when a button is pressed, called only when the button applies to the actor
	 * @param type The string color name of the button
	 * @param data Custom data the button sent
	 */
	buttonPressed?(type: string, data?: string): void
	/**
	 * Called when a button is released, called only when the button applies to the actor
	 * @param type The string color name of the button
	 * @param data Custom data the button sent
	 */
	buttonUnpressed?(type: string, data?: string): void
	/**
	 * Called when the level starts
	 */
	levelStarted?(): void
	/**
	 * Called each subtick if anything is on this (called at cooldown time (move time))
	 */
	continuousActorCompletelyJoined?(other: Actor): void
	replaceWith(other: typeof actorDB[string]): Actor {
		this.destroy(null, null)
		const newActor = new other(this.level, this.tile.position, this.customData)
		newActor.direction = this.direction
		newActor.inventory = this.inventory
		return newActor
	}
	/**
	 * Checks if an actor can push this actor
	 */
	canBePushed?(other: Actor, direction: Direction): boolean
	/**
	 * When an actor tries to check anything direction related while being on this actor, the direction can be changed with this
	 * Returning null is the same as exit-blocking on all sides
	 */
	redirectTileMemberDirection?(
		other: Actor,
		direction: Direction
	): Direction | null
}
