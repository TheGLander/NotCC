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
	get allActors(): Actor[] {
		return [
			...this[Layer.ITEM],
			...this[Layer.MOVABLE],
			...this[Layer.STATIONARY],
			...this[Layer.ITEM_SUFFIX],
			...this[Layer.SPECIAL],
		]
	}
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
		for (const actor of actors) this[actor.layer].push(actor)
	}
	removeActors(actors: Actor | Actor[]): void {
		actors = actors instanceof Array ? actors : [actors]
		for (const actor of actors) {
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
		const offsets = [
			[-1, -1],
			[-1, 1],
			[1, 1],
			[1, -1],
		] as const
		const targets = [
			[0, -level],
			[-level, 0],
			[0, level],
			[level, 0],
		] as const
		for (
			let currOffset = [level, 0], currTarget = 0;
			true;
			currOffset[0] += offsets[currTarget][0],
				currOffset[1] += offsets[currTarget][1]
		) {
			if (
				currOffset[0] === targets[currTarget][0] &&
				currOffset[1] === targets[currTarget][1]
			)
				currTarget++
			if (currTarget === 4) break
			const tile =
				this.level.field[this.x + currOffset[0]]?.[this.y + currOffset[1]]
			if (tile) yield tile
		}
	}
}

export default Tile
