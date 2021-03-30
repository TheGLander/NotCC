import { Actor } from "./actor"
import { LevelState } from "./level"
import { Direction } from "./helpers"

export enum Layers {
	STATIONARY,
	ITEM,
	ITEM_SUFFIX,
	MOVABLE,
	EFFECT,
}

class Tile extends Array<Array<Actor>> {
	allActors: Actor[] = []
	x: number
	y: number
	constructor(
		public level: LevelState,
		public position: [number, number],
		actors: Actor[]
	) {
		super()
		for (let i = 0; i <= 4; i++) this[i] = []
		;[this.x, this.y] = position
		this.addActors(actors)
	}
	/**
	 * Adds new actors to the tile, sorting everything automatically
	 */
	addActors(actors: Actor | Actor[]): void {
		actors = actors instanceof Array ? actors : [actors]
		this.allActors.push(...actors)
		for (const actor of actors) {
			this[actor.layer].push(actor)
		}
	}
	removeActors(actors: Actor | Actor[]): void {
		actors = actors instanceof Array ? actors : [actors]
		for (const actor of actors) {
			this.allActors.splice(this.allActors.indexOf(actor), 1)
			this[actor.layer].splice(this[actor.layer].indexOf(actor))
		}
	}
	getNeighbor(direction: Direction): Tile | null {
		switch (direction) {
			case Direction.UP:
				return (
					this.level.field[this.position[0]]?.[this.position[1] - 1] ?? null
				)
			case Direction.LEFT:
				return (
					this.level.field[this.position[0] - 1]?.[this.position[1]] ?? null
				)
			case Direction.DOWN:
				return (
					this.level.field[this.position[0]]?.[this.position[1] + 1] ?? null
				)
			case Direction.RIGHT:
				return (
					this.level.field[this.position[0] + 1]?.[this.position[1]] ?? null
				)
		}
	}
}

export default Tile
