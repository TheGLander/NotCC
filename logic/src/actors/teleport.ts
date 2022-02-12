import { Actor, SlidingState } from "../actor"
import { Layer } from "../tile"
import { actorDB } from "../const"
import { Playable } from "./playables"
import { Item, ItemDestination } from "./items"
import { iterableFind, iterableIncludes } from "../iterableHelpers"
import { WireOverlapMode } from "../wires"

function findNextTeleport<T extends Teleport>(
	this: T,
	other: Actor,
	rro: boolean,
	validateDestination: (
		other: Actor,
		newTeleport: T,
		rolledOver: boolean
	) => boolean
): T {
	const thisConstructor = Object.getPrototypeOf(this).constructor
	let lastY = this.tile.y
	let rolledOver = false
	for (const tile of this.level.tiles(rro, this.tile.position)) {
		if (!rolledOver && Math.abs(tile.y - lastY) > 1) rolledOver = true
		lastY = tile.y
		const newTeleport = iterableFind(
			tile[this.layer],
			val => val instanceof thisConstructor
		)
		if (
			newTeleport &&
			validateDestination.call(this, other, newTeleport as T, rolledOver)
		)
			return newTeleport as T
	}
	return this
}

export abstract class Teleport extends Actor {
	tags = ["machinery"]
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	shouldProcessThing = false
	actorCompletelyJoined() {
		this.shouldProcessThing = true
	}
	actorOnTile(other: Actor): void {
		if (!this.shouldProcessThing) return
		if (other.slidingState) other.slidingState = SlidingState.NONE
		this.shouldProcessThing = false
		this.onTeleport(other)
	}

	abstract onTeleport(other: Actor): void
	requiresFullConnect = true
}
export class BlueTeleport extends Teleport {
	id = "teleportBlue"
	actorJoined(other: Actor): void {
		other.slidingState = SlidingState.STRONG
	}
	onTeleport(other: Actor): void {
		other.oldTile = other.tile
		const isWired = !!this.circuits
		other.tile = findNextTeleport.call(
			this,
			other,
			true,
			// TODO Logic gates
			(other, teleport, rolledOver) =>
				((!isWired && rolledOver) || isWired === teleport.wired) &&
				(!isWired ||
					!!teleport.circuits?.some(
						val => val && iterableIncludes(val.population.keys(), this)
					)) &&
				!teleport.tile.hasLayer(Layer.MOVABLE) &&
				this.level.checkCollisionFromTile(other, teleport.tile, other.direction)
		).tile
		other._internalUpdateTileStates()
		other.slidingState = SlidingState.STRONG
	}

	wireOverlapMode = WireOverlapMode.OVERLAP
}

actorDB["teleportBlue"] = BlueTeleport

export class RedTeleport extends Teleport {
	actorJoined(other: Actor): void {
		other.slidingState = SlidingState.WEAK
	}
	id = "teleportRed"
	onTeleport(other: Actor): void {
		other.slidingState = SlidingState.WEAK
		other.oldTile = other.tile
		if (!this.wired || this.poweredWires)
			other.tile = findNextTeleport.call(
				this,
				other,
				false,
				(other: Actor, teleport: Actor) => {
					if (teleport.tile.hasLayer(Layer.MOVABLE)) return false
					if (teleport.wired && !teleport.poweredWires) return false
					for (let offset = 0; offset < 4; offset++)
						if (
							this.level.checkCollisionFromTile(
								other,
								teleport.tile,
								(other.direction + offset) % 4
							)
						) {
							other.direction += offset
							other.direction %= 4
							return true
						}

					return false
				}
			).tile
		other._internalUpdateTileStates()
		other.slidingState = SlidingState.WEAK
		if (other instanceof Playable) other.hasOverride = true
	}
	actorOnTile(other: Actor): void {
		if (!this.shouldProcessThing) return
		if (other.slidingState) {
			if (this.wired && !this.poweredWires)
				other.slidingState = SlidingState.WEAK
			else other.slidingState = SlidingState.NONE
		}
		this.shouldProcessThing = false
		this.onTeleport(other)
	}
	wireOverlapMode = WireOverlapMode.NONE
}

actorDB["teleportRed"] = RedTeleport

export class GreenTeleport extends Teleport {
	id = "teleportGreen"
	actorJoined(other: Actor): void {
		other.slidingState = SlidingState.STRONG
	}
	onTeleport(other: Actor): void {
		other.slidingState = SlidingState.STRONG
		// All green TPs
		const allTeleports: this[] = [this]
		// TPs which do not have an actor on them
		let validTeleports: this[] = [this]
		let targetTeleport: this | undefined
		for (
			let teleport = findNextTeleport.call(this, other, false, () => true);
			teleport !== this;
			teleport = findNextTeleport.call(teleport, other, false, () => true)
		) {
			allTeleports.push(teleport as this)
			if (!teleport.tile.hasLayer(Layer.MOVABLE))
				validTeleports.push(teleport as this)
		}
		// We have only 1 teleport in level, do not even try anything
		if (allTeleports.length === 1) targetTeleport = this
		else {
			// This is a wack CC2 bug, I guess, (Props to magical and eevee from CCBBCDS for figuring it out)
			const targetIndex =
				(this.level.random() % (allTeleports.length - 1)) %
				validTeleports.length
			validTeleports = [
				...validTeleports.slice(targetIndex + 1),
				...validTeleports.slice(0, targetIndex + 1),
			]
			other.direction = this.level.random() % 4
			mainLoop: for (const teleport of validTeleports) {
				for (let offset = 0; offset < 4; offset++)
					if (
						this.level.checkCollisionFromTile(
							other,
							teleport.tile,
							(other.direction + offset) % 4
						)
					) {
						other.direction += offset
						other.direction %= 4
						targetTeleport = teleport
						break mainLoop
					}
			}
		}
		if (!targetTeleport)
			throw new Error(
				"This state should never happen, please report if this happens"
			)
		other.oldTile = other.tile
		other.tile = targetTeleport.tile
		other._internalUpdateTileStates()
		other.slidingState = SlidingState.STRONG
	}
}

actorDB["teleportGreen"] = GreenTeleport

export class YellowTeleport extends Teleport implements Item {
	actorJoined(other: Actor): void {
		other.slidingState = SlidingState.WEAK
	}
	tags = ["machinery"]
	id = "teleportYellow"
	destination = ItemDestination.ITEM
	blocks(): false {
		return false
	}
	ignores = this.blocks
	shouldPickup = true
	levelStarted(): void {
		// If this is the only yellow teleport at yellow start, never pick up
		this.shouldPickup =
			findNextTeleport.call(this, this, false, () => true) !== this
	}
	onTeleport(other: Actor): void {
		other.slidingState = SlidingState.WEAK
		const newTP = findNextTeleport.call(
			this,
			other,
			true,
			(other, teleport) =>
				!teleport.tile.hasLayer(Layer.MOVABLE) &&
				this.level.checkCollisionFromTile(other, teleport.tile, other.direction)
		)

		if (this.shouldPickup && newTP === this) {
			other.slidingState = SlidingState.NONE
			Item.prototype.actorCompletelyJoined.call(this, other)
		} else {
			other.oldTile = other.tile
			other.tile = newTP.tile
			other._internalUpdateTileStates()
			other.slidingState = SlidingState.WEAK
			if (other instanceof Playable) other.hasOverride = true
		}
	}
}

actorDB["teleportYellow"] = YellowTeleport
