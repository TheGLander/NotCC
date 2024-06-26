import { LevelState } from "./level.js"
import {
	Decision,
	actorDB,
	hasTag,
	makeTagFlagField,
	hasTagOverlap,
} from "./const.js"
import { Direction, hasOwnProperty } from "./helpers.js"
import { Layer, Tile } from "./tile.js"
import { Item, Key } from "./actors/items.js"
import { CircuitCity, isWired, Wirable, WireOverlapMode } from "./wires.js"
import { iterableIndexOf } from "./iterableHelpers.js"

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

export const tagProperties = [
	"pushTags",
	"tags",
	"blockTags",
	"blockedByTags",
	"collisionIgnoreTags",
	"ignoreTags",
	"immuneTags",
] as const

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
	pushTags = BigInt(0)
	/**
	 * General-use tags to use, for example, for collisions
	 */
	tags = BigInt(0)
	hasTag(tag: string) {
		return hasTag(this, tag)
	}
	/**
	 * Tags which this actor blocks
	 */
	blockTags = BigInt(0)
	/**
	 * Tags which this actor is blocked by
	 */
	blockedByTags = BigInt(0)

	/**
	 * Tags which this actor refuses to be blocked by
	 */
	collisionIgnoreTags = BigInt(0)
	/**
	 * Tags which this actor will not conduct any interactions with.
	 */
	ignoreTags = BigInt(0)
	/**
	 * Tags which this actor should not be destroyed by
	 */
	immuneTags = BigInt(0)

	calcTag(prop: string, items: boolean) {
		let initTags =
			(Object.getPrototypeOf(this).constructor[prop] as bigint) ?? BigInt(0)
		if (items) {
			initTags |= this.calcItemTags(prop)
		}
		return initTags
	}
	calcItemTags(prop: string) {
		let tags = BigInt(0)
		for (const item of this.inventory.items) {
			const carrierTags = item.carrierTags?.[prop]
			tags |= carrierTags ?? BigInt(0)
		}
		return tags
	}
	recomputeTags(items = true) {
		for (const prop of tagProperties) {
			this[prop] = this.calcTag(prop, items)
		}
	}
	ignores?(other: Actor): boolean
	_internalIgnores(other: Actor): boolean {
		return (
			(hasTagOverlap(this.tags, other.ignoreTags) ||
				hasTagOverlap(other.tags, this.ignoreTags) ||
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
		if (this.level.cc1Boots) return false
		const itemToDrop = this.inventory.items[id]
		if (!itemToDrop) return false
		if (this.despawned) {
			console.warn("Dropping items while despawned in undefined behaviour.")
		}
		if (this.tile[itemToDrop.layer]) return false
		if (itemToDrop.canBeDropped && !itemToDrop.canBeDropped(this)) return false
		this.inventory.items.splice(id, 1)
		itemToDrop.oldTile = null
		itemToDrop.tile = this.tile
		this.level.actors.push(itemToDrop)
		itemToDrop._internalUpdateTileStates()
		if (!noSideEffect) itemToDrop.onDrop?.(this)
		itemToDrop.exists = true
		if (itemToDrop.carrierTags) {
			for (const prop in itemToDrop.carrierTags) {
				this[prop as "tags"] = this.calcTag(prop, true)
			}
		}
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
		for (const tagProp of tagProperties.concat(
			(new.target as any).extraTagProperties ?? []
		)) {
			this[tagProp] = (new.target as any)[tagProp] ?? BigInt(0)
		}
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

		if (this.cooldown || this.frozen) return // This is where the decision *actually* begins
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
			if (this.checkCollision(direction)) {
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
	actorCompletelyLeft?(other: Actor): void
	/**
	 * Called when another actor joins the current tile
	 */
	actorJoined?(other: Actor): void
	/**
	 * Called when another actor stops moving after joining a tile
	 */
	actorCompletelyJoined?(other: Actor): void
	actorCompletelyJoinedIgnored?(other: Actor): void
	/**
	 * Called when this actor steps on a new tile
	 */
	newTileJoined?(): void
	/**
	 * Called when this actor stops walking to a new tile
	 */
	newTileCompletelyJoined?(): void

	shouldDie?(killer: Actor): boolean

	_internalShouldDie(killer: Actor): boolean {
		return !(
			this._internalIgnores(killer) ||
			hasTagOverlap(killer.tags, this.immuneTags) ||
			(this.shouldDie && !this.shouldDie(killer))
		)
	}
	_internalCollisionIgnores(other: Actor, direction: Direction): boolean {
		return !!(
			hasTagOverlap(this.tags, other.collisionIgnoreTags) ||
			other.collisionIgnores?.(this, direction)
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
						hasTagOverlap(other.tags, this.blockTags) ||
						hasTagOverlap(this.tags, other.blockedByTags))))
		)
	}
	enterTile(noOnTile = false): void {
		let thisActor: Actor = this
		if (thisActor.oldTile) {
			for (const actor of thisActor.oldTile.allActorsReverse) {
				if (!thisActor._internalIgnores(actor)) {
					actor.actorCompletelyLeft?.(thisActor)
					if (thisActor.newActor) thisActor = thisActor.newActor
				}
			}
		}
		for (const actor of thisActor.tile.allActorsReverse) {
			if (actor === thisActor) continue
			const notIgnores = !thisActor._internalIgnores(actor)
			if (notIgnores) actor.actorCompletelyJoined?.(thisActor)
			else actor.actorCompletelyJoinedIgnored?.(thisActor)
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
		redirectOnly = false,
		pull = true
	): boolean {
		return this.checkCollisionFromTile(this.tile, direction, redirectOnly, pull)
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
		redirectOnly = false,
		pull = true
	): boolean {
		// This is a pass by reference-esque thing, please don't die of cring
		this.level.resolvedCollisionCheckDirection = direction

		// Do stuff on the leaving tile

		for (const exitActor of fromTile.allActorsReverse)
			if (!redirectOnly && exitActor._internalExitBlocks(this, direction)) {
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
		if (redirectOnly) return true
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
		]) {
			let blockActor = newTile[layer]
			if (!blockActor) continue
			for (const item of this.inventory.items) {
				item.onCarrierBump?.(this, blockActor, direction)
				if (blockActor.newActor) blockActor = blockActor.newActor
			}
			blockActor.bumped?.(this, direction)
			this.bumpedActor?.(blockActor, direction, false)
			if (blockActor._internalBlocks(this, direction))
				if (this._internalCanPush(blockActor, direction))
					toPush.push(blockActor)
				else {
					this.level.resolvedCollisionCheckDirection = direction
					return false
				}
			if (layer === Layer.MOVABLE)
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
			if (pushable.cooldown || !pushable.checkCollision(direction)) {
				this.level.resolvedCollisionCheckDirection = direction
				return false
			}
			if (pushable._internalStep(direction)) {
				pushable.cooldown--
				if (this.hasTag("plays-block-push-sfx"))
					this.level.sfxManager?.playOnce("block push")
			}
		}
		this.level.resolvedCollisionCheckDirection = direction
		if (toPush.length !== 0) this.isPushing = true
		if (pull && this.hasTag("pulling")) {
			const backTile = this.tile.getNeighbor((direction + 2) % 4)
			if (!backTile) return true
			const pulledActor = backTile[Layer.MOVABLE]
			if (pulledActor) {
				if (pulledActor.cooldown && pulledActor.moveSpeed) return false

				if (
					(pulledActor.pendingDecisionLockedIn && pulledActor.isPulled) ||
					!pulledActor.hasTag("block") ||
					(pulledActor.canBePushed && !pulledActor.canBePushed(this, direction))
				) {
					pulledActor.isPulled = true
					return true
				}
				pulledActor.isPulled = true
				pulledActor.direction = direction
				if (pulledActor.frozen) return true
				pulledActor.pendingDecision = pulledActor.moveDecision = direction + 1
			}
		}
		return true
	}
	/**
	 * Updates tile states and calls hooks
	 */
	_internalUpdateTileStates(noTileRemove?: boolean): void {
		this.respawn(false)
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
	respawn(putOnTile = true): void {
		if (!this.despawned) return
		this.despawned = false
		if (this.level.despawnedActors.includes(this))
			this.level.despawnedActors.splice(
				this.level.despawnedActors.indexOf(this),
				1
			)
		if (putOnTile) {
			this.tile.addActors(this)
		}
	}
	despawn(): void {
		if (this.despawned) return
		this.level.despawnedActors.push(this)
		this.despawned = true
		this.tile.removeActors(this)
	}
	destroy(
		killer?: Actor | null,
		animType: string | null = "explosion"
	): boolean {
		if (killer && !this._internalShouldDie(killer)) return false
		if (this.level.actors.includes(this))
			this.level.actors.splice(this.level.actors.indexOf(this), 1)
		const decidingPos = this.level.decidingActors.indexOf(this)
		if (this.level.decidingActors.includes(this))
			this.level.decidingActors.splice(
				this.level.decidingActors.indexOf(this),
				1
			)
		if (this.despawned) {
			if (this.level.despawnedActors.includes(this))
				this.level.despawnedActors.splice(
					this.level.despawnedActors.indexOf(this),
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
		if (animType && actorDB[`${animType}Anim`] && !this.tile[Layer.MOVABLE]) {
			const anim = new actorDB[`${animType}Anim`](
				this.level,
				this.tile.position
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
		for (const item of this.inventory.items) {
			item.onCarrierDestroyed?.(this)
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
			!hasTagOverlap(other.tags, this.pushTags) ||
			!(other.canBePushed?.(this, direction) ?? true)
		)
			return false
		if (other.pendingDecisionLockedIn) return false
		return other.checkCollision(direction, true)
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
				!hasTagOverlap(this.tags, other.collisionIgnoreTags) &&
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
	replaceWith(other: (typeof actorDB)[string], customData?: string): Actor {
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
		newActor.recomputeTags()
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
	onRedirect?(delta: number): void
	/**
	 * If true, the actor can't move at all
	 */
	frozen = false
}
