import { LevelState } from "./level"
import { Decision } from "./const"
import { Direction } from "./helpers"
import { Layers } from "./tile"
import Tile from "./tile"

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
	/**
	 * Name of the art piece to display
	 */
	art: string
	/**
	 * The direction the art piece should be facing
	 */
	rotation?: number
}

export abstract class Actor {
	moveDecision = Decision.NONE
	currentMoveSpeed: number | null = null
	oldTile: Tile | null = null
	cooldown = 0
	pendingDecision = Decision.NONE
	slidingState = SlidingState.NONE
	abstract layer: Layers
	art?: ActorArt | (() => ActorArt)
	/**
	 * Amount of ticks it takes for the actor to move
	 */
	moveSpeed = 0
	tile: Tile
	pushable = false

	constructor(
		public level: LevelState,
		public direction: Direction,
		position: [number, number]
	) {
		level.activeActors.unshift(this)
		this.tile = level.field[position[0]][position[1]]
		this.tile.addActors([this])
	}
	/**
	 * Decides the movements the actor will attempt to do
	 * Must return an array of absolute directions
	 */
	decideMovement?(): (Direction | (() => Direction))[]
	onBlocked?(blocker?: Actor): void
	_internalDecide(forcedOnly = false): void {
		this.moveDecision = Decision.NONE
		if (this.cooldown) return
		this.currentMoveSpeed = this.oldTile = null
		// This is where the decision *actually* begins
		// If the thing has a decision queued up, do it forcefully
		// (Currently only used for blocks pushed while sliding)
		if (this.pendingDecision) {
			this.moveDecision = this.pendingDecision
			return
		}
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
		// TODO Force redirection of movement (train tracks)
		this.direction = direction
		const canMove = this.level.checkCollision(this, direction, true)
		// Welp, something stole our spot, too bad
		if (!canMove || !this.moveSpeed) return false
		const newTile = this.tile.getNeighbor(direction)
		if (!newTile) return false
		// TODO Speed mods
		const moveLength = this.moveSpeed * 3
		this.currentMoveSpeed = this.cooldown = moveLength
		this.oldTile = this.tile
		this.tile = newTile
		// Finally, move ourselves to the new tile
		this._internalUpdateTileStates()
		return true
	}
	_internalMove(): void {
		if (this.cooldown > 0 || !this.moveDecision) return
		this._internalStep(this.moveDecision - 1)
		this.pendingDecision = Decision.NONE
		// TODO Instabonking:tm:
	}
	blocks?(other: Actor): boolean
	blockedBy?(other: Actor): boolean
	/**
	 * Called when another actor leaves the current tile
	 */
	actorLeft?(other: Actor): void
	/**
	 * Called when another actor joins the current tile
	 */
	actorJoined?(other: Actor): void
	_internalBlocks(other: Actor): boolean {
		if (this.blocks?.(other)) return true
		return other.blockedBy?.(this) ?? false
	}
	_internalDoCooldown() {
		if (this.cooldown > 0) this.cooldown--
	}
	/**
	 * Updates tile states and calls hooks
	 */
	_internalUpdateTileStates() {
		this.oldTile?.removeActors(this)
		this.tile.addActors(this)
		for (const actor of this.oldTile?.allActors ?? []) actor.actorLeft?.(this)
		this.slidingState = SlidingState.NONE
		for (const actor of this.tile.allActors) actor.actorJoined?.(this)
	}
}
/**
 * Creates an art function for a generic directionable actor
 */
export const genericDirectionableArt = (name: string) =>
	function (this: Actor): ActorArt {
		return {
			art: `${name}${["Up", "Right", "Down", "Left"][this.direction]}`,
		}
	}
