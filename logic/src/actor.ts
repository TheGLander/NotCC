import { LevelState, crossLevelData } from "./level"
import { Decision, actorDB } from "./const"
import { Direction, hasOwnProperty } from "./helpers"
import { Layer, Tile } from "./tile"
import { Item, Key } from "./actors/items"
import { CircuitCity, isWired, Wirable, WireOverlapMode, Wires } from "./wires"
import { Playable } from "./actors"
import { iterableIndexOf } from "./iterableHelpers"

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

export abstract class Actor implements Wirable {
	moveDecision = Decision.NONE
	currentMoveSpeed: number | null = null
	oldTile: Tile | null = null
	cooldown = 0
	pendingDecision = Decision.NONE
	pendingDecisionLockedIn = false
	slidingState = SlidingState.NONE
	abstract getLayer(): Layer
	layer: Layer
	abstract id: string
	despawned = false
	exists = true
	isDeciding = false
	isPulled = false
	createdN: number
	newActor?: Actor
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

	nonIgnoredSlideBonkTags?: string[]
	getCompleteTags<T extends keyof this>(id: T, noItems?: boolean): string[] {
		let tags: string[]
		if (this[id]) tags = Array.from(this[id] as unknown as string[])
		else tags = []
		if (noItems) return tags
		for (const item of this.inventory.items) {
			//@ts-expect-error T is typeof string, it can index Record<string, string[]>
			const itemTags = item.carrierTags?.[id]
			if (itemTags) tags.push(...itemTags)
		}
		return tags
	}
	ignores?(other: Actor): boolean
	_internalIgnores(other: Actor, noItems?: boolean): boolean {
		return (
			(matchTags(
				this.getCompleteTags("tags", noItems),
				other.getCompleteTags("ignoreTags", noItems)
			) ||
				matchTags(
					other.getCompleteTags("tags", noItems),
					this.getCompleteTags("ignoreTags", noItems)
				) ||
				this.ignores?.(other) ||
				other.ignores?.(this)) ??
			false
		)
	}
	collisionIgnores?(other: Actor, enterDirection: Direction): boolean
	/**
	 * Amount of ticks it takes for the actor to move
	 */
	moveSpeed = 4
	tile: Tile
	inventory: Inventory = {
		items: [],
		keys: {},
		itemMax: 4,
	}
	dropItemN(id: number, noSideEffect = false): boolean {
		const itemToDrop = this.inventory.items[id]
		if (!itemToDrop) return false
		if (this.despawned) {
			console.warn("Dropping items while despawned in undefined behaviour.")
		}
		if (this.tile.hasLayer(itemToDrop.layer)) return false
		if (itemToDrop.canBeDropped && !itemToDrop.canBeDropped(this)) return false
		this.inventory.items.splice(id, 1)
		itemToDrop.oldTile = null
		itemToDrop.tile = this.tile
		this.level.actors.push(itemToDrop)
		itemToDrop._internalUpdateTileStates()
		if (!noSideEffect) itemToDrop.onDrop?.(this)
		itemToDrop.exists = true
		return true
	}
	dropItem(): boolean {
		return this.dropItemN(this.inventory.items.length - 1)
	}
	constructor(
		public level: LevelState,
		position: [number, number],
		public customData = "",
		public direction: Direction = Direction.UP
	) {
		this.layer = this.getLayer()
		level.actors.unshift(this)
		this.tile = level.field[position[0]][position[1]]
		this.tile.addActors(this)
		this.isDeciding = !!(
			this.layer === Layer.MOVABLE ||
			this.onEachDecision ||
			this.decideMovement
		)
		if (this.isDeciding) level.decidingActors.unshift(this)
		this.createdN = this.level.createdN++
		if (this.level.levelStarted) {
			this.onCreation?.()
			this.wired = isWired(this)
		}
	}
	/**
	 * Decides the movements the actor will attempt to do
	 * Must return an array of absolute directions
	 */
	decideMovement?(): Direction[]
	onEachDecision?(forcedOnly: boolean): void
	_internalDecide(forcedOnly = false): void {
		if (!this.exists) return
		this.bonked = false
		this.moveDecision = Decision.NONE

		if (this.cooldown) return // This is where the decision *actually* begins
		this.currentMoveSpeed = null
		this.isPushing = false
		if (this.pendingDecision) {
			this.moveDecision = this.pendingDecision
			this.pendingDecision = Decision.NONE
			this.pendingDecisionLockedIn = true
			return
		}
		// This is where the decision *actually* begins		// Since this is a generic actor, we cannot override weak sliding
		// TODO Ghost ice shenanigans
		if (this.slidingState) {
			this.moveDecision = this.direction + 1
			return
		}
		this.onEachDecision?.(forcedOnly)
		if (forcedOnly) return
		const directions = this.decideMovement?.()

		if (!directions || directions.length === 0) return

		for (const direction of directions)
			if (this.checkCollision(direction, true)) {
				// Yeah, we can go here
				this.moveDecision = direction + 1
				return
			}

		// Force last decision if all other fail

		this.moveDecision = directions[directions.length - 1] + 1
	}
	selfSpeedMod(mult: number): number {
		for (const item of this.inventory.items) {
			if (item.carrierSpeedMod) mult *= item.carrierSpeedMod(this, mult)
		}
		return mult
	}
	_internalStep(direction: Direction): boolean {
		if (this.cooldown || !this.moveSpeed) return false
		this.direction = direction
		const canMove = this.checkCollision(direction)
		this.bonked = !canMove
		this.direction = this.level.resolvedCollisionCheckDirection
		// Welp, something stole our spot, too bad
		if (!canMove) return false
		if (!this.isDeciding) this.level.decidingActors.push(this)
		this.isDeciding = true
		const newTile = this.tile.getNeighbor(
			this.level.resolvedCollisionCheckDirection,
			false
		)
		this.pendingDecision = Decision.NONE
		this.moveDecision = Decision.NONE
		// This is purely a defensive programming thing, shouldn't happen normally (checkCollision should check for going OOB)
		if (!newTile) return false
		let speedMult = 1
		speedMult = newTile.getSpeedMod(this)
		speedMult = this.selfSpeedMod(speedMult)
		const moveLength = (this.moveSpeed * 3) / speedMult
		this.currentMoveSpeed = this.cooldown = moveLength
		this.oldTile = this.tile
		this.tile = newTile
		// Finally, move ourselves to the new tile
		this._internalUpdateTileStates()
		return true
	}
	_internalMove(): void {
		if (!this.exists) return
		if (this.cooldown > 0) {
			this.isPulled = false
			this.moveDecision = Decision.NONE
			return
		}

		if (!this.moveDecision) {
			this.isPulled = false
			return
		}
		this.pendingDecision = Decision.NONE
		this.pendingDecisionLockedIn = false
		const ogDirection = this.moveDecision - 1
		const success = this._internalStep(ogDirection)

		this.isPulled = false
	}
	/**
	 * True if the last move failed
	 */
	bonked = false
	blocks?(other: Actor, otherMoveDirection: Direction): boolean
	blockedBy?(other: Actor, thisMoveDirection: Direction): boolean
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

	shouldDie?(killer: Actor): boolean

	_internalShouldDie(killer: Actor, noItems = false): boolean {
		return !(
			this._internalIgnores(killer, noItems) ||
			matchTags(
				killer.getCompleteTags("tags"),
				this.getCompleteTags("immuneTags")
			) ||
			(this.shouldDie && !this.shouldDie(killer))
		)
	}
	_internalCollisionIgnores(other: Actor, direction: Direction): boolean {
		return !!(
			matchTags(
				this.getCompleteTags("tags"),
				other.getCompleteTags("collisionIgnoreTags")
			) || other.collisionIgnores?.(this, direction)
		)
	}
	_internalBlocks(other: Actor, moveDirection: Direction): boolean {
		return (
			// A hack for teleports, but it's not that dumb of a limitation, so maybe it's fine?
			other !== this &&
			// FIXME A hack for blocks, really shouldn't be a forced limitation
			(!!(this.cooldown && this.moveSpeed) ||
				(!this._internalCollisionIgnores(other, moveDirection) &&
					(this.blocks?.(other, moveDirection) ||
						other.blockedBy?.(this, moveDirection) ||
						matchTags(
							other.getCompleteTags("tags"),
							this.getCompleteTags("blockTags")
						) ||
						matchTags(
							this.getCompleteTags("tags"),
							other.getCompleteTags("blockedByTags")
						))))
		)
	}
	enterTile(noOnTile = false): void {
		let thisActor: Actor = this
		this.noSlidingBonk = false
		for (const actor of thisActor.tile.allActorsReverse) {
			if (actor === thisActor) continue
			const notIgnores = !thisActor._internalIgnores(actor)
			if (actor.slidingPlayableShouldntBonk && notIgnores)
				this.noSlidingBonk = true
			if (this.noSlidingBonk && hasOwnProperty(this, "hasOverride"))
				this.hasOverride = true
			if (notIgnores && actor.actorCompletelyJoined)
				actor.actorCompletelyJoined(thisActor)
			if (thisActor.newActor) thisActor = thisActor.newActor
			if (!noOnTile && actor.actorOnTile) {
				actor.actorOnTile(thisActor)
			}
			if (thisActor.newActor) thisActor = thisActor.newActor
		}
		if (this.exists) {
			this.newTileCompletelyJoined?.()
			for (const item of this.inventory.items)
				item.onCarrierCompleteJoin?.(this)
		}
		this.cooldown = 0
	}
	_internalDoCooldown(): void {
		if (!this.exists) return
		if (this.cooldown > 0 && this.cooldown <= 1) {
			if (this.pendingDecision) this.pendingDecisionLockedIn = true
			this.enterTile()
		} else if (this.cooldown > 0) this.cooldown--
		else if (this.exists) {
			let thisActor: Actor = this
			for (const actor of [...this.tile.allActors])
				if (actor !== thisActor && actor.actorOnTile) {
					actor.actorOnTile(thisActor)
					if (thisActor.newActor) thisActor = thisActor.newActor
				}
		}
		this.bonked = false
	}
	isPushing = false
	/**
	 * Checks if a specific actor can move in a certain direction
	 * @param actor The actor to check for
	 * @param direction The direction the actor wants to move in
	 * @param pushBlocks If true, it will push blocks
	 * @returns If the actor *can* move in that direction
	 */
	checkCollision(
		direction: Direction,
		pushBlocks = true,
		exitOnly = false,
		pull = true
	): boolean {
		return this.checkCollisionFromTile(
			this.tile,
			direction,
			pushBlocks,
			exitOnly,
			pull
		)
	}
	/**
	 * Checks if a specific actor can move in a certain direction to a certain tile
	 * @param this The actor to check for
	 * @param direction The direction the actor wants to enter the tile
	 * @param fromTile The tile the actor is coming from
	 * @param pushBlocks If true, it will push blocks
	 * @returns If the actor *can* move in that direction
	 */
	checkCollisionFromTile(
		this: Actor,
		fromTile: Tile,
		direction: Direction,
		pushBlocks = true,
		exitOnly = false,
		pull = true
	): boolean {
		// This is a pass by reference-esque thing, please don't die of cring
		this.level.resolvedCollisionCheckDirection = direction

		// Do stuff on the leaving tile

		for (const exitActor of fromTile.allActorsReverse)
			if (exitActor._internalExitBlocks(this, direction)) {
				if (exitOnly && !exitActor.persistOnExitOnlyCollision) continue
				exitActor.bumped?.(this, direction)
				this.bumpedActor?.(exitActor, direction, true)
				return false
			} else {
				if (
					!exitActor.redirectTileMemberDirection ||
					this._internalIgnores(exitActor)
				)
					continue
				const redirection = exitActor.redirectTileMemberDirection(
					this,
					direction
				)
				if (redirection === null) return false
				this.onRedirect?.((redirection - direction + 4) % 4)
				this.level.resolvedCollisionCheckDirection = direction = redirection
			}
		if (exitOnly) return true
		const newTile = fromTile.getNeighbor(direction, false)
		if (newTile === null) {
			this.bumpedEdge?.(fromTile, direction)
			return false
		}

		const toPush: Actor[] = []

		// Do stuff on the entering tile
		loop: for (const layer of [
			Layer.ITEM_SUFFIX,
			Layer.SPECIAL,
			Layer.STATIONARY,
			Layer.MOVABLE,
			Layer.ITEM,
		])
			for (let blockActor of newTile[layer]) {
				for (const item of this.inventory.items)
					item.onCarrierBump?.(this, blockActor, direction)
				if (blockActor.newActor) blockActor = blockActor.newActor
				blockActor.bumped?.(this, direction)
				this.bumpedActor?.(blockActor, direction, false)
				if (blockActor._internalBlocks(this, direction))
					if (this._internalCanPush(blockActor, direction))
						toPush.push(blockActor)
					else {
						this.level.resolvedCollisionCheckDirection = direction
						return false
					}
				if (
					layer === Layer.MOVABLE &&
					iterableIndexOf(newTile[layer], blockActor) ===
						newTile.layerLength(layer) - 1
				)
					// This is dumb
					break loop
			}

		for (const pushable of toPush) {
			this.level.resolvedCollisionCheckDirection = direction
			if (pushable.slidingState) {
				// Blocks with no cooldown can't have their pending decision be overriden
				if (!pushable.pendingDecisionLockedIn) {
					pushable.pendingDecision = pushable.moveDecision = direction + 1
				}
				return false
			}
			if (
				pushable.cooldown ||
				!pushable.checkCollision(direction, pushBlocks)
			) {
				this.level.resolvedCollisionCheckDirection = direction
				return false
			}
			if (pushBlocks) {
				if (pushable._internalStep(direction)) pushable.cooldown--
			}
		}
		this.level.resolvedCollisionCheckDirection = direction
		if (pull && this.getCompleteTags("tags").includes("pulling")) {
			const backTile = this.tile.getNeighbor((direction + 2) % 4)
			if (!backTile) return true
			for (const pulledActor of backTile[Layer.MOVABLE]) {
				if (pulledActor.cooldown && pulledActor.moveSpeed) return false

				if (
					!pushBlocks ||
					(pulledActor.pendingDecisionLockedIn && pulledActor.isPulled) ||
					!pulledActor.getCompleteTags("tags").includes("block") ||
					(pulledActor.canBePushed && !pulledActor.canBePushed(this, direction))
				) {
					pulledActor.isPulled = true
					continue
				}
				pulledActor.isPulled = true
				pulledActor.direction = direction
				pulledActor.pendingDecision = pulledActor.moveDecision = direction + 1
			}
		}
		if (toPush.length !== 0) this.isPushing = true
		return true
	}
	/**
	 * Updates tile states and calls hooks
	 */
	_internalUpdateTileStates(noTileRemove?: boolean): void {
		if (this.despawned) {
			// We moved! That means this is no longer despawned and we are no longer omni-present
			this.despawned = false
			if (crossLevelData.despawnedActors.includes(this))
				crossLevelData.despawnedActors.splice(
					crossLevelData.despawnedActors.indexOf(this),
					1
				)
		}
		if (!noTileRemove) {
			this.oldTile?.removeActors(this)
			this.slidingState = SlidingState.NONE
			// Spread from and to to not have actors which create new actors instantly be interacted with
			if (this.oldTile)
				for (const actor of [...this.oldTile.allActorsReverse])
					if (!this._internalIgnores(actor)) actor.actorLeft?.(this)
		}

		this.tile.addActors(this)

		for (const actor of [...this.tile.allActorsReverse])
			if (actor !== this && !this._internalIgnores(actor))
				actor.actorJoined?.(this)
		this.newTileJoined?.()
		for (const item of this.inventory.items) item.onCarrierJoin?.(this)
	}
	destroy(
		killer?: Actor | null,
		animType: string | null = "explosion",
		extendedAnim = false,
		shouldDieNoItems = false
	): boolean {
		if (killer && !this._internalShouldDie(killer, shouldDieNoItems))
			return false
		if (this.level.actors.includes(this))
			this.level.actors.splice(this.level.actors.indexOf(this), 1)
		const decidingPos = this.level.decidingActors.indexOf(this)
		if (this.level.decidingActors.includes(this))
			this.level.decidingActors.splice(
				this.level.decidingActors.indexOf(this),
				1
			)
		if (this.despawned) {
			if (crossLevelData.despawnedActors.includes(this))
				crossLevelData.despawnedActors.splice(
					crossLevelData.despawnedActors.indexOf(this),
					1
				)
		}
		if (this.level.circuitInputs.includes(this)) {
			this.level.circuitInputs.splice(this.level.circuitInputs.indexOf(this), 1)
		}
		if (this.level.circuitOutputs.includes(this)) {
			this.level.circuitOutputs.splice(
				this.level.circuitOutputs.indexOf(this),
				1
			)
		}
		this.tile.removeActors(this)
		this.exists = false
		if (
			animType &&
			actorDB[`${animType}Anim`] &&
			!this.tile.hasLayer(Layer.MOVABLE)
		) {
			const anim = new actorDB[`${animType}Anim`](
				this.level,
				this.tile.position,
				extendedAnim ? "extended" : ""
			)
			if (decidingPos !== -1) {
				this.level.decidingActors.splice(
					this.level.decidingActors.indexOf(anim),
					1
				)
				this.level.decidingActors.splice(decidingPos, 0, anim)
			}
			anim.direction = this.direction
			anim.currentMoveSpeed = this.currentMoveSpeed
			anim.cooldown = this.cooldown
			anim.inventory = this.inventory
			this.newActor = anim
		}
		for (const thing of this.tile.allActors) {
			thing.actorDestroyed?.(this)
		}
		return true
	}
	getVisualPosition(): [number, number] {
		if (!this.cooldown || !this.currentMoveSpeed || !this.oldTile)
			return this.tile.position
		const progress = 1 - this.cooldown / this.currentMoveSpeed
		return [
			this.oldTile.x * (1 - progress) + this.tile.x * progress,
			this.oldTile.y * (1 - progress) + this.tile.y * progress,
		]
	}
	actorDestroyed?(actor: Actor): void
	/**
	 * Called when another actor bumps into this actor
	 * @param other The actor which bumped into this actor
	 */
	bumped?(other: Actor, bumpDirection: Direction): void
	/**
	 * Called when this actor bumps into another actor
	 * @param other The actor which this actor bumped into
	 */
	bumpedActor?(other: Actor, bumpDirection: Direction, onExit: boolean): void
	_internalCanPush(other: Actor, direction: Direction): boolean {
		//if (other.pendingDecision) return false
		if (
			!matchTags(
				other.getCompleteTags("tags"),
				this.getCompleteTags("pushTags")
			) ||
			!(other.canBePushed?.(this, direction) ?? true)
		)
			return false
		if (other.pendingDecisionLockedIn) return false
		return other.checkCollision(direction, true, true)
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
		return (
			(!other.collisionIgnores?.(this, exitDirection) &&
				!matchTags(
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
	actorOnTile?(other: Actor): void
	replaceWith(other: typeof actorDB[string], customData?: string): Actor {
		const decidingPos = this.level.decidingActors.indexOf(this)
		this.destroy(null, null)
		const newActor = new other(
			this.level,
			this.tile.position,
			customData ?? this.customData
		)
		newActor.direction = this.direction
		newActor.inventory = this.inventory
		if (newActor.isDeciding && decidingPos !== -1) {
			this.level.decidingActors.splice(
				this.level.decidingActors.indexOf(newActor),
				1
			)
			this.level.decidingActors.splice(decidingPos, 0, newActor)
		}
		this.newActor = newActor
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
	bumpedEdge?(fromTile: Tile, direction: Direction): void
	wires = 0
	/**
	 * The currently powered wires, either by it's own abilities of via neighbors
	 */
	poweredWires = 0
	/**
	 * The wires this actor is powering itself
	 */
	poweringWires = 0
	wireTunnels = 0
	circuits?: [CircuitCity?, CircuitCity?, CircuitCity?, CircuitCity?]
	wireOverlapMode: WireOverlapMode = WireOverlapMode.NONE
	/**
	 * Called at the start of wire phase, usually used to update powered wires.
	 */
	updateWires?(): void
	pulse?(actual: boolean): void
	unpulse?(): void
	listensWires?: boolean
	onCreation?(): void
	providesPower?: boolean
	wired = false
	/**
	 * If true, this will be actually checked on exit-only collision checks
	 */
	persistOnExitOnlyCollision?: boolean
	slidingPlayableShouldntBonk?: boolean
	noSlidingBonk = false
	onRedirect?(delta: number): void
}
