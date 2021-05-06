import { Actor } from "./actor"
import { LevelState } from "./level"
import { Direction } from "./helpers"

export enum Layer {
	STATIONARY, // Terrain, etc.
	ITEM, // All item-eque things: Bombs, echips, boots, keys, etc.
	ITEM_SUFFIX, // No sign, etc.
	MOVABLE, // Blocks, Players, Monsters
	SPECIAL, // Thin walls, canopies, swivels, etc.
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
		for (let i = 0; i <= 5; i++) this[i] = []
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
			if (this.allActors.includes(actor))
				this.allActors.splice(this.allActors.indexOf(actor), 1)
			if (this[actor.layer].includes(actor))
				this[actor.layer].splice(this[actor.layer].indexOf(actor), 1)
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
	getSpeedMod(other: Actor): number {
		return this.allActors.reduce(
			(acc, val) =>
				val.speedMod && !other._internalIgnores(val)
					? val.speedMod(other) * acc
					: acc,
			1
		)
	}
	*getDiamondSearch(level: number): IterableIterator<Tile> {
		if (level === 1) {
			for (let i = 0; i < 4; i++) {
				const tile = this.getNeighbor(i)
				if (tile) yield tile
			}
			return
		}
		for (let yOff = -level; yOff <= level; yOff++) {
			const xOff = level - Math.abs(yOff)
			const tile1 = this.level.field[this.x - xOff]?.[this.y + yOff]
			if (tile1) yield tile1
			if (xOff !== 0) {
				const tile2 = this.level.field[this.x + xOff]?.[this.y + yOff]
				if (tile2) yield tile2
			}
		}
	}
}

export default Tile
