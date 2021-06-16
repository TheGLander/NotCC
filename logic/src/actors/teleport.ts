import { Actor, SlidingState } from "../actor"
import { Layer } from "../tile"
import { actorDB } from "../const"
import { Playable } from "./playables"
import { Item, ItemDestination } from "./items"

function findNextTeleport<T extends Actor>(
	this: T,
	other: Actor,
	goInRRO = true,
	validateDestination: (other: Actor, newTeleport: T) => boolean = (
		other,
		teleport
	) => {
		return (
			(teleport.tile[Layer.MOVABLE].length === 0 &&
				this.level.checkCollisionToTile(
					other,
					teleport.tile,
					other.direction
				)) ??
			false
		)
	}
): T {
	const thisConstructor = Object.getPrototypeOf(this).constructor
	let x = this.tile.x + (goInRRO ? -1 : 1)
	for (
		let y = this.tile.y;
		// If we reached this tile, stop
		// eslint-disable-next-line no-constant-condition
		true;
		// This is used for valid level wrapping
		y = (y + this.level.height + (goInRRO ? -1 : 1)) % this.level.height,
			x = (this.level.width + x) % this.level.width
	)
		for (; x >= 0 && x < this.level.width; goInRRO ? x-- : x++) {
			const newTeleport = this.level.field[x][y].allActors.find(
				val => val instanceof thisConstructor
			) as T | undefined
			if (newTeleport === this) return this
			if (newTeleport && validateDestination.call(this, other, newTeleport))
				return newTeleport
		}
}

export class BlueTeleport extends Actor {
	id = "teleportBlue"
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	actorJoined(other: Actor): void {
		other.slidingState = SlidingState.STRONG
	}

	actorCompletelyJoined(other: Actor): void {
		other.oldTile = other.tile
		other.tile = findNextTeleport.call(this, other).tile
		other._internalUpdateTileStates()
		other.slidingState = SlidingState.STRONG
		other.pendingDecision = other.direction + 1
	}
	onMemberSlideBonked(other: Actor): void {
		other.slidingState = SlidingState.NONE
	}
}

actorDB["teleportBlue"] = BlueTeleport

export class RedTeleport extends Actor {
	id = "teleportRed"
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	actorCompletelyJoined(other: Actor): void {
		other.oldTile = other.tile
		other.tile = findNextTeleport.call(
			this,
			other,
			false,
			(other: Actor, teleport: Actor) => {
				if (teleport.tile[Layer.MOVABLE].length !== 0) return false
				for (let offset = 0; offset < 4; offset++)
					if (
						this.level.checkCollisionToTile(
							other,
							teleport.tile,
							(other.direction + offset) % 4
						)
					)
						return true

				return false
			}
		).tile
		other._internalUpdateTileStates()
		other.slidingState = SlidingState.WEAK
		if (other instanceof Playable) other.hasOverride = true
	}
	onMemberSlideBonked(other: Actor): void {
		other.slidingState = SlidingState.NONE
	}
}

actorDB["teleportRed"] = RedTeleport

export class GreenTeleport extends Actor {
	id = "teleportGreen"
	getLayer(): Layer {
		return Layer.STATIONARY
	}
	actorCompletelyJoined(other: Actor): void {
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
			if (teleport.tile[Layer.MOVABLE].length === 0)
				validTeleports.push(teleport as this)
		}
		// We have only 1 teleport in level, do not even try anything
		if (allTeleports.length === 1) targetTeleport = this
		else {
			// This is a wack CC2 bug, I guess, (Props to magical and eevee from CCBBC for figuring it out)
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
						this.level.checkCollisionToTile(
							other,
							teleport.tile,
							other.direction + offset
						)
					) {
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
	onMemberSlideBonked(other: Actor): void {
		other.slidingState = SlidingState.NONE
	}
}

actorDB["teleportGreen"] = GreenTeleport

export class YellowTeleport extends Actor implements Item {
	id = "teleportYellow"
	destination = ItemDestination.ITEM
	blocks(): false {
		return false
	}
	onMemberSlideBonked(other: Actor): void {
		other.slidingState = SlidingState.NONE
	}
	ignores = this.blocks
	shouldPickup = true
	levelStarted(): void {
		// If this is the only yellow teleport at yellow start, never pick up
		this.shouldPickup =
			findNextTeleport.call(this, this, false, () => true) !== this
	}
	actorCompletelyJoined(other: Actor): void {
		const newTP = findNextTeleport.call(this, other, false)
		if (this.shouldPickup && newTP === this)
			Item.prototype.actorCompletelyJoined.call(this, other)
		else {
			other.oldTile = other.tile
			other.tile = newTP.tile
			other._internalUpdateTileStates()
			other.slidingState = SlidingState.WEAK
			if (other instanceof Playable) other.hasOverride = true
		}
	}
	getLayer(): Layer {
		return Layer.STATIONARY
	}
}

actorDB["teleportYellow"] = YellowTeleport
