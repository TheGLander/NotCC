import { Actor, SlidingState } from "../actor.js"
import { Layer, Tile } from "../tile.js"
import { actorDB } from "../const.js"
import { Playable } from "./playables.js"
import { Item, ItemDestination } from "./items.js"
import { iterableFind, iterableIncludes } from "../iterableHelpers.js"
import {
	CircuitCity,
	getTileWirable,
	WireOverlapMode,
	Wires,
} from "../wires.js"

function findNextTeleport<T extends Actor>(
	teleport: T,
	rro: boolean,
	validateDestination?: (newTeleport: T, rolledOver: boolean) => boolean
): T {
	const thisConstructor = Object.getPrototypeOf(teleport).constructor
	let lastY = teleport.tile.y
	let rolledOver = false
	for (const tile of teleport.level.tiles(rro, teleport.tile.position)) {
		if (!rolledOver && Math.abs(tile.y - lastY) > 1) rolledOver = true
		lastY = tile.y
		const newTeleport = iterableFind(
			tile[teleport.layer],
			val => val instanceof thisConstructor
		) as T | null
		if (
			newTeleport &&
			(!validateDestination || validateDestination(newTeleport, rolledOver))
		)
			return newTeleport
	}
	return teleport
}

function findNextBlueTeleport<T extends Actor>(
	teleport: T,
	rro: boolean,
	validateDestination: (newTeleport: Tile, rolledOver: boolean) => T | null
): T | null {
	let lastY = teleport.tile.y
	let rolledOver = false
	for (const tile of teleport.level.tiles(rro, teleport.tile.position)) {
		if (!rolledOver && Math.abs(tile.y - lastY) > 1) rolledOver = true
		lastY = tile.y
		const res = validateDestination(tile, rolledOver)
		if (res) return res
	}
	return null
}

export abstract class Teleport extends Actor {
	tags = ["machinery", "teleport"]
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	shouldProcessThing = false
	actorCompletelyJoined(): void {
		this.shouldProcessThing = true
	}
	actorOnTile(other: Actor): void {
		if (other._internalIgnores(this)) return
		if (other.bonked) other.slidingState = SlidingState.NONE
		if (!this.shouldProcessThing) return
		this.shouldProcessThing = false
		this.level.sfxManager?.playOnce("teleport")
		this.onTeleport(other)
	}

	abstract onTeleport(other: Actor): void
	requiresFullConnect = true
}

export interface BlueTeleportTarget extends Actor {
	isBlueTeleportTarget(): boolean
	takeTeleport(other: Actor): void
	giveUpTeleport(other: Actor): void
	isBusy(other: Actor): boolean
	getTeleportOutputCircuit(): CircuitCity | undefined
	getTeleportInputCircuit(): CircuitCity[]
}

export function isBlueTeleportTarget(val: Actor): val is BlueTeleportTarget {
	return "isBlueTeleportTarget" in val && "takeTeleport" in val
}

export function doBlueTeleport(
	teleport: BlueTeleportTarget,
	other: Actor
): void {
	const thisNetwork = teleport.getTeleportOutputCircuit()
	const seenNetworks = new Set<CircuitCity>()
	const newTeleportish = findNextBlueTeleport(
		teleport,
		true,
		(tile, rolledOver) => {
			while (other.newActor) other = other.newActor
			const wirable = getTileWirable(tile)
			const tpNetworks =
				wirable.circuits?.reduce<CircuitCity[]>(
					(acc, val) => (val ? acc.concat(val) : acc),
					[]
				) ?? []
			if (thisNetwork && tpNetworks.length === 0) return null
			if (!thisNetwork && tpNetworks.length > 0 && !rolledOver) {
				for (const network of tpNetworks) seenNetworks.add(network)
				return null
			}
			if (wirable instanceof Tile || !isBlueTeleportTarget(wirable as Actor))
				return null
			const newTeleport = wirable as BlueTeleportTarget
			if (!thisNetwork && tpNetworks.some(val => seenNetworks.has(val)))
				return null
			if (
				tpNetworks.length > 0 &&
				thisNetwork &&
				!newTeleport.getTeleportInputCircuit().includes(thisNetwork)
			)
				return null
			if (
				!thisNetwork &&
				tpNetworks.length > 0 &&
				!newTeleport
					.getCompleteTags("tags")
					.includes("janky-blue-teleport-overflow-target")
			)
				return null
			if (newTeleport.isBusy(other)) return null
			return newTeleport
		}
	)
	const newTeleport = newTeleportish ?? teleport
	teleport.giveUpTeleport(other)
	newTeleport.takeTeleport(other)
}

export class BlueTeleport extends Teleport implements BlueTeleportTarget {
	isBlueTeleportTarget(): boolean {
		return true
	}
	takeTeleport(other: Actor): void {
		other.oldTile = other.tile
		other.tile = this.tile
		other._internalUpdateTileStates(
			!iterableIncludes(other.oldTile[other.layer], other)
		)
		other.slidingState = SlidingState.STRONG
	}
	giveUpTeleport(other: Actor): void {
		other.tile.removeActors(other)
	}
	isBusy(other: Actor): boolean {
		return (
			this.tile.hasLayer(Layer.MOVABLE) ||
			!other.checkCollisionFromTile(this.tile, other.direction, false, false)
		)
	}
	id = "teleportBlue"
	tags = ["machinery", "teleport", "janky-blue-teleport-overflow-target"]
	actorJoined(other: Actor): void {
		other.slidingState = SlidingState.STRONG
	}
	onTeleport(other: Actor): void {
		doBlueTeleport(this, other)
	}
	getTeleportOutputCircuit(): CircuitCity | undefined {
		return this.circuits?.find(val => val)
	}
	getTeleportInputCircuit(): CircuitCity[] {
		return (
			this.circuits?.reduce<CircuitCity[]>(
				(acc, val) => (val ? acc.concat(val) : acc),
				[]
			) ?? []
		)
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
			other.tile = findNextTeleport(this, false, (teleport: Actor) => {
				while (other.newActor) other = other.newActor
				if (teleport.tile.hasLayer(Layer.MOVABLE)) return false
				if (teleport.wired && !teleport.poweredWires) return false
				for (let offset = 0; offset < 4; offset++) {
					if (
						other.checkCollisionFromTile(
							teleport.tile,
							(other.direction + offset) % 4,
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
		this.level.sfxManager?.playOnce("teleport")
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
		const validTeleports: this[] = []
		let targetTeleport: this | undefined
		for (
			let teleport = findNextTeleport(this, false);
			teleport !== this;
			teleport = findNextTeleport(teleport, false)
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
				const index = i + targetIndex
				const teleport = validTeleports[index]
				if (teleport === this) continue
				if (index >= validTeleports.length) break

				for (let offset = 0; offset < 4; offset++) {
					if (
						other.checkCollisionFromTile(
							teleport.tile,
							(dir + offset) % 4,
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
		return Item.prototype.hasItemMod.apply(this)
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
		this.shouldPickup = findNextTeleport(this, false) !== this
	}
	onTeleport(other: Actor): void {
		other.slidingState = SlidingState.WEAK
		const newTP = findNextTeleport(this, true, teleport => {
			while (other.newActor) other = other.newActor
			return (
				!teleport.tile.hasLayer(Layer.MOVABLE) &&
				other.checkCollisionFromTile(
					teleport.tile,
					other.direction,
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
