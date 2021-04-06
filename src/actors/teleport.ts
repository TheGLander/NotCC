import { Actor, SlidingState } from "../actor"
import { Layers } from "../tile"
import { actorDB } from "../const"

export class BlueTeleport extends Actor {
	get layer(): Layers {
		return Layers.STATIONARY
	}
	art = { art: "teleportBlue" }
	actorCompletelyJoined(other: Actor): void {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		let otherTeleport: BlueTeleport = this
		let x = this.tile.x - 1
		loop: for (
			let y = this.tile.y;
			// If we reached this tile, stop
			// eslint-disable-next-line no-constant-condition
			true;
			// This is used for valid level wrapping
			y = (y + this.level.height - 1) % this.level.height
		)
			for (x = x === -1 ? this.level.width - 1 : x; x >= 0; x--) {
				const newTeleport = this.level.field[x][y].allActors.find(
					val => val instanceof BlueTeleport
				) as BlueTeleport | undefined
				if (newTeleport === this) break loop
				const teleportNeighbor = newTeleport?.tile.getNeighbor(other.direction)
				if (
					newTeleport &&
					teleportNeighbor &&
					this.level.checkCollisionToTile(
						other,
						teleportNeighbor,
						other.direction,
						true
					)
				) {
					otherTeleport = newTeleport
					break loop
				}
			}
		other.oldTile = other.tile
		other.tile = otherTeleport.tile
		other._internalUpdateTileStates()
		other.slidingState = SlidingState.STRONG
		other._internalStep(other.direction)
	}
	onMemberSlideBonked(other: Actor): void {
		other.slidingState = SlidingState.NONE
	}
}

actorDB["teleportBlue"] = BlueTeleport
