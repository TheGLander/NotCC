import { Actor, SlidingState } from "../actor"
import { Layer, Tile } from "../tile"
import { actorDB } from "../const"
import { Playable } from "./playables"
import { Item, ItemDestination } from "./items"
import { iterableFind, iterableIncludes } from "../iterableHelpers"
import { CircuitCity, getTileWirable, WireOverlapMode } from "../wires"

function findNextTeleport<T extends Teleport>(
	this: T,
	rro: boolean,
	validateDestination?: (newTeleport: T, rolledOver: boolean) => boolean
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
		) as T | null
		if (
			newTeleport &&
			(!validateDestination ||
				validateDestination.call(this, newTeleport, rolledOver))
		)
			return newTeleport
	}
	return this
}

function findNextTile<T extends Teleport>(
	this: T,
	rro: boolean,
	validateDestination?: (newTeleport: Tile, rolledOver: boolean) => boolean
): Tile {
	let lastY = this.tile.y
	let rolledOver = false
	for (const tile of this.level.tiles(rro, this.tile.position)) {
		if (!rolledOver && Math.abs(tile.y - lastY) > 1) rolledOver = true
		lastY = tile.y
		if (
			!validateDestination ||
			validateDestination.call(this, tile, rolledOver)
		)
			return tile
	}
	return this.tile
}

export abstract class Teleport extends Actor {
	tags = ["machinery", "teleport"]
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	shouldProcessThing = false
	actorCompletelyJoined() {
		this.shouldProcessThing = true
	}
	actorOnTile(other: Actor): void {
		if (other._internalIgnores(this)) return
		if (other.bonked) other.slidingState = SlidingState.NONE
		if (!this.shouldProcessThing) return
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
		const thisNetwork = this.circuits?.find(val => val)
		const seenNetworks = new Set<CircuitCity>()
		other.tile = findNextTile.call(
			this,
			true,
			// TODO Logic gates
			(tile, rolledOver) => {
				while (other.newActor) other = other.newActor
				const wirable = getTileWirable(tile)
				const tpNetwork = wirable.circuits?.find(val => val)
				if (thisNetwork && !tpNetwork) return false
				if (!thisNetwork && tpNetwork && !rolledOver) {
					seenNetworks.add(tpNetwork)
					return false
				}
				if (wirable instanceof Tile || (wirable as Actor).id !== this.id)
					return false
				const teleport = wirable as BlueTeleport
				if (!thisNetwork && tpNetwork && seenNetworks.has(tpNetwork))
					return false
				if (tpNetwork && thisNetwork && thisNetwork !== tpNetwork) return false
				if (teleport.tile.hasLayer(Layer.MOVABLE)) return false
				return other.checkCollisionFromTile(
					teleport.tile,
					other.direction,
					true,
					false,
					false
				)
			}
		)
		while (other.newActor) other = other.newActor
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
			other.tile = findNextTeleport.call(this, false, (teleport: Actor) => {
				while (other.newActor) other = other.newActor
				if (teleport.tile.hasLayer(Layer.MOVABLE)) return false
				if (teleport.wired && !teleport.poweredWires) return false
				for (let offset = 0; offset < 4; offset++) {
					if (
						other.checkCollisionFromTile(
							teleport.tile,
							(other.direction + offset) % 4,
							true,
							false,
							false
						)
					) {
						while (other.newActor) other = other.newActor
						other.direction += offset
						other.direction %= 4
						return true
					}
					while (other.newActor) other = other.newActor
				}
				return false
			}).tile
		while (other.newActor) other = other.newActor
		other._internalUpdateTileStates()
		other.slidingState = SlidingState.WEAK
		if (other instanceof Playable) other.hasOverride = true
	}
	actorOnTile(other: Actor): void {
		if (other._internalIgnores(this)) return
		if (other.bonked && other.slidingState) {
			if (this.wired && !this.poweredWires)
				other.slidingState = SlidingState.WEAK
			else other.slidingState = SlidingState.NONE
		}
		if (!this.shouldProcessThing) return
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
		const allTeleports: this[] = []
		// TPs which do not have an actor on them
		let validTeleports: this[] = []
		let targetTeleport: this | undefined
		for (
			let teleport = findNextTeleport.call(this, false);
			teleport !== this;
			teleport = findNextTeleport.call(teleport, false)
		) {
			allTeleports.push(teleport as this)
			if (!teleport.tile.hasLayer(Layer.MOVABLE))
				validTeleports.push(teleport as this)
		}
		allTeleports.push(this)
		validTeleports.push(this)
		// We have only 1 teleport in level, do not even try anything
		if (allTeleports.length === 1) {
			targetTeleport = this
		} else {
			// This is a wack CC2 bug, I guess, (Props to magical and eevee from CCBBCDS for figuring it out)
			const targetIndex =
				(this.level.random() % (allTeleports.length - 1)) %
				validTeleports.length

			const dir = this.level.random() % 4

			mainLoop: for (let i = 0; i < validTeleports.length; i++) {
				let index = i + targetIndex
				const teleport = validTeleports[index]
				if (teleport === this) continue
				if (index >= validTeleports.length) break

				for (let offset = 0; offset < 4; offset++) {
					if (
						other.checkCollisionFromTile(
							teleport.tile,
							(dir + offset) % 4,
							true,
							false,
							false
						)
					) {
						while (other.newActor) other = other.newActor
						other.direction = (dir + offset) % 4
						targetTeleport = teleport
						break mainLoop
					}
					while (other.newActor) other = other.newActor
				}
			}
		}
		while (other.newActor) other = other.newActor
		if (!targetTeleport) targetTeleport = this
		other.oldTile = other.tile
		other.tile = targetTeleport.tile
		other._internalUpdateTileStates()
		other.slidingState = SlidingState.STRONG
	}
}

actorDB["teleportGreen"] = GreenTeleport

export class YellowTeleport extends Teleport implements Item {
	pickup = Item.prototype.pickup
	carrierTags?: Record<string, string[]> | undefined
	hasItemMod(): boolean {
		return Item.prototype.hasItemMod.call(this)
	}
	actorJoined(other: Actor): void {
		other.slidingState = SlidingState.WEAK
	}
	tags = ["machinery", "teleport"]
	id = "teleportYellow"
	destination = ItemDestination.ITEM
	blocks(): false {
		return false
	}
	ignores = this.blocks
	shouldPickup = true
	levelStarted(): void {
		// If this is the only yellow teleport at yellow start, never pick up
		this.shouldPickup = findNextTeleport.call(this, false) !== this
	}
	onTeleport(other: Actor): void {
		other.slidingState = SlidingState.WEAK
		const newTP = findNextTeleport.call(this, true, teleport => {
			while (other.newActor) other = other.newActor
			return (
				!teleport.tile.hasLayer(Layer.MOVABLE) &&
				other.checkCollisionFromTile(
					teleport.tile,
					other.direction,
					true,
					false,
					false
				)
			)
		})
		while (other.newActor) other = other.newActor
		let shouldTP = !(this.shouldPickup && newTP === this)
		if (!shouldTP) {
			other.slidingState = SlidingState.NONE
			shouldTP = !this.pickup(other)
		}
		if (shouldTP) {
			if (other.tile !== newTP.tile) {
				other.oldTile = other.tile
				other.tile = newTP.tile
				other._internalUpdateTileStates()
			}
			other.slidingState = SlidingState.WEAK
			if (other instanceof Playable) other.hasOverride = true
		}
	}
}

actorDB["teleportYellow"] = YellowTeleport
