import { Actor, SlidingState, genericAnimatedArt } from "../actor"
import { Layers } from "../tile"
import { actorDB } from "../const"

function findNextTeleport<T extends Actor>(
	this: T,
	other: Actor,
	goInRRO = true,
	checkCollision = true
): T {
	// eslint-disable-next-line @typescript-eslint/no-this-alias
	let otherTeleport = this
	const thisConstructor = Object.getPrototypeOf(this).constructor
	let x = this.tile.x + (goInRRO ? -1 : 1)
	loop: for (
		let y = this.tile.y;
		// If we reached this tile, stop
		// eslint-disable-next-line no-constant-condition
		true;
		// This is used for valid level wrapping
		y = (y + this.level.height + (goInRRO ? -1 : 1)) % this.level.height
	)
		for (
			x = (this.level.width + x) % this.level.width;
			x >= 0 && x < this.level.width;
			goInRRO ? x-- : x++
		) {
			const newTeleport = this.level.field[x][y].allActors.find(
				val => val instanceof thisConstructor
			) as T | undefined
			if (newTeleport === this) break loop
			const teleportNeighbor = newTeleport?.tile.getNeighbor(other.direction)
			if (
				newTeleport &&
				teleportNeighbor &&
				(!checkCollision ||
					this.level.checkCollisionToTile(
						other,
						teleportNeighbor,
						other.direction,
						true
					))
			) {
				otherTeleport = newTeleport
				break loop
			}
		}
	return otherTeleport
}

export class BlueTeleport extends Actor {
	get layer(): Layers {
		return Layers.STATIONARY
	}
	art = genericAnimatedArt("teleportBlue", 4)
	actorCompletelyJoined(other: Actor): void {
		other.oldTile = other.tile
		other.tile = findNextTeleport.call(this, other).tile
		other._internalUpdateTileStates()
		other.slidingState = SlidingState.STRONG
		other._internalStep(other.direction)
	}
	onMemberSlideBonked(other: Actor): void {
		other.slidingState = SlidingState.NONE
	}
}

actorDB["teleportBlue"] = BlueTeleport

export class RedTeleport extends Actor {
	get layer(): Layers {
		return Layers.STATIONARY
	}
	art = genericAnimatedArt("teleportRed", 4)
	actorCompletelyJoined(other: Actor): void {
		other.oldTile = other.tile
		other.tile = findNextTeleport.call(this, other, false).tile
		other._internalUpdateTileStates()
		other.slidingState = other.lastStepSlideMode = SlidingState.WEAK
		other._internalDecide(false)
		other._internalMove()
	}
	onMemberSlideBonked(other: Actor): void {
		other.slidingState = SlidingState.NONE
	}
}

actorDB["teleportRed"] = RedTeleport
