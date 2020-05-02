import Actor from "../actor"
import { Direction } from "../helpers"
import { LevelState } from "../level"
import { KeyInputs } from "../pulse"
export class Playable extends Actor {
	selected: boolean | null = null
	playable = true
	relativeMovement = false
	lastInputs: KeyInputs
	constructor(name: string, extname?: string) {
		super(name, "playable", extname)
		this.onTick.push(function (this: Playable) {
			this.acceptInput()
		})
	}
	create(pos: [number, number], direction: Direction, level: LevelState) {
		const ret = super.create(pos, direction, level)
		ret.selected = false
		if (level.playables.length === 0) ret.selected = true
		level.playables.push(ret)
		return ret
	}
	acceptInput() {
		if (!this.selected) return
		const keysToProcess: string[] = []
		for (const i in this.lastInputs)
			if (this.lastInputs[i]) keysToProcess.push(i)
		for (; keysToProcess.length !== 0; ) {
			const key = keysToProcess.shift()
			switch (key) {
				case "up":
					if (!this.moving) {
						this.move(Direction.UP)
						this.rotate(Direction.UP)
					}
					break
				case "down":
					if (!this.moving) {
						this.move(Direction.DOWN)
						this.rotate(Direction.DOWN)
					}
					break
				case "left":
					if (!this.moving) {
						this.move(Direction.LEFT)
						this.rotate(Direction.LEFT)
					}
					break
				case "right":
					if (!this.moving) {
						this.move(Direction.RIGHT)
						this.rotate(Direction.RIGHT)
					}
					break
				default:
					break
			}
		}
	}
}

export const chip = new Playable("chip")
