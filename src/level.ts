import Actor from "./actor"
import { Field } from "./helpers"
import { KeyInputs } from "./pulse"
import { Playable } from "./actors/playables"
/**
 * The state of a level, used as a hub of realtime level properties, the most important one being `field`
 */

export class LevelState {
	playables: Playable[] = []
	lost: boolean = false
	field: Field<Actor[]> = []
	activeActors: Actor[] = []
	nextId = 0
	tick(): void {
		for (const i in this.activeActors) this.activeActors[i].tick()
		if (this.playables.length === 0) this.lost = true
	}
	giveInput(input: KeyInputs) {
		for (const i in this.playables) this.playables[i].lastInputs = input
	}
	constructor(public width: number, public height: number) {
		//Init field
		this.field = []
		for (let x = 0; x < width; x++) {
			this.field.push([])
			for (let y = 0; y < height; y++) this.field[x].push([])
		}
	}
	selectedPlayable: Actor
}
