import { Actor } from "./actor.js"
import { LevelState } from "./level.js"
import { Direction } from "./helpers.js"
import { CircuitCity, Wirable, WireOverlapMode, Wires } from "./wires.js"
import { GlitchInfo } from "./parsers/nccs.pb.js"

export enum Layer {
	STATIONARY, // Terrain, etc.
	ITEM, // All item-eque things: Bombs, echips, boots, keys, etc.
	ITEM_SUFFIX, // No sign, etc.
	MOVABLE, // Blocks, Players, Monsters
	SPECIAL, // Thin walls, canopies, etc.
}

export class Tile implements Wirable {
	protected *getAllLayers(): IterableIterator<Actor> {
		if (this[Layer.STATIONARY]) yield this[Layer.STATIONARY]
		if (this[Layer.ITEM]) yield this[Layer.ITEM]
		if (this[Layer.ITEM_SUFFIX]) yield this[Layer.ITEM_SUFFIX]
		if (this[Layer.MOVABLE]) yield this[Layer.MOVABLE]
		if (this[Layer.SPECIAL]) yield this[Layer.SPECIAL]
	}
	protected *getAllLayersReverse(): IterableIterator<Actor> {
		if (this[Layer.SPECIAL]) yield this[Layer.SPECIAL]
		if (this[Layer.MOVABLE]) yield this[Layer.MOVABLE]
		if (this[Layer.ITEM_SUFFIX]) yield this[Layer.ITEM_SUFFIX]
		if (this[Layer.ITEM]) yield this[Layer.ITEM]
		if (this[Layer.STATIONARY]) yield this[Layer.STATIONARY]
	}
	get allActors(): IterableIterator<Actor> {
		return this.getAllLayers()
	}
	get allActorsReverse(): IterableIterator<Actor> {
		return this.getAllLayersReverse()
	}
	[Layer.STATIONARY]?: Actor;
	[Layer.ITEM]?: Actor;
	[Layer.ITEM_SUFFIX]?: Actor;
	[Layer.MOVABLE]?: Actor;
	[Layer.SPECIAL]?: Actor
	x: number
	y: number
	constructor(
		public level: LevelState,
		public position: [number, number],
		actors: Actor[]
	) {
		;[this.x, this.y] = position
		this.addActors(actors)
	}
	findActor(func: (val: Actor, i: number) => boolean): Actor | null {
		let i = 0
		// Handle the per-layer situation first
		for (const actor of this.getAllLayers()) if (func(actor, i++)) return actor
		return null
	}
	hasLayer(layer: Layer): boolean {
		return layer in this
	}
	/**
	 * Adds new actors to the tile, sorting everything automatically
	 */
	addActors(actors: Actor | Actor[]): void {
		actors = actors instanceof Array ? actors : [actors]
		for (const actor of actors) {
			const layer = actor.layer
			if (!this[layer]) this[layer] = actor
			else {
				this[layer]!.despawned = true
				this.level.despawnedActors.push(this[layer]!)
				this[layer] = actor
				this.level.addGlitch({
					glitchKind: GlitchInfo.KnownGlitches.DESPAWN,
					location: { x: this.x, y: this.y },
					specifier: 1,
				})
			}
		}
	}
	removeActors(actors: Actor | Actor[]): void {
		actors = actors instanceof Array ? actors : [actors]

		for (const actor of actors) {
			const theLayer = this[actor.layer]
			// Ignore attempts to remove a non-existant actor
			if (!theLayer) continue
			if (theLayer !== actor) {
				this.level.addGlitch({
					glitchKind: GlitchInfo.KnownGlitches.DESPAWN,
					location: { x: this.x, y: this.y },
					specifier: 2,
				})
				theLayer.despawned = true
				this.level.despawnedActors.push(theLayer)
			}
			delete this[actor.layer]
		}
	}
	getNeighbor(direction: Direction, wrap = true): Tile | null {
		switch (direction) {
			case Direction.UP:
				return (
					this.level.field[this.position[0]]?.[this.position[1] - 1] ?? null
				)
			case Direction.LEFT:
				if (this.x === 0 && wrap)
					return this.level.field[this.level.width - 1]?.[this.y - 1] ?? null
				return (
					this.level.field[this.position[0] - 1]?.[this.position[1]] ?? null
				)
			case Direction.DOWN:
				return (
					this.level.field[this.position[0]]?.[this.position[1] + 1] ?? null
				)
			case Direction.RIGHT:
				if (this.x === this.level.width - 1 && wrap)
					return this.level.field[0]?.[this.y + 1] ?? null
				return (
					this.level.field[this.position[0] + 1]?.[this.position[1]] ?? null
				)
		}
	}
	getSpeedMod(other: Actor): number {
		let speedMod = 1
		for (const actor of this.getAllLayers())
			if (actor.speedMod && !actor._internalIgnores(other))
				speedMod *= actor.speedMod(other)
		return speedMod
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
	wires = 0
	poweredWires = 0
	wireTunnels = 0
	circuits?: [CircuitCity?, CircuitCity?, CircuitCity?, CircuitCity?]
	wireOverlapMode: WireOverlapMode = WireOverlapMode.CROSS
	poweringWires = 0
}
