import { Actor } from "../actor"
import { Layers } from "../tile"
import { Direction, relativeToAbsolute } from "../helpers"
import { KeyInputs } from "../pulse"
import { LevelState } from "../level"
import { Decision } from "../const"

export class Playable extends Actor {
	lastInputs?: KeyInputs
	constructor(
		level: LevelState,
		direction: Direction,
		position: [number, number]
	) {
		super(level, direction, position)
		level.playables.push(this)
	}
	decideMovement(): Direction[] {
		const dir = relativeToAbsolute(this.direction)
		return [dir.RIGHT, dir.FORWARD, dir.LEFT, dir.BACKWARD]
	}
	get layer(): Layers {
		return Layers.MOVABLE
	}
	_internalDecide(forcedOnly: boolean): void {
		this.moveDecision = Decision.NONE
		if (this.cooldown) return
		const canMove = !forcedOnly && !this.slidingState // TODO Weak sliding
		// TODO Slapping
		// TODO Inventory stuff
		const stringDirections = ["up", "right", "down", "left"] as const
		const direction = stringDirections.findIndex(dir => this.lastInputs?.[dir])
		if (this.slidingState)
			// We are forced to move
			this.moveDecision = this.direction + 1
		else if (!canMove || direction === -1) {
			// We can't / don't wanna move, sad
		} else {
			this.moveDecision = direction + 1
		}
	}
	moveSpeed = 4
}
