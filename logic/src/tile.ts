import { Actor } from "./actor"
import { LevelState, crossLevelData } from "./level"
import { Direction } from "./helpers"
import { CircuitCity, Wirable, WireOverlapMode, Wires } from "./wires"

export enum Layer {
	STATIONARY, // Terrain, etc.
	ITEM, // All item-eque things: Bombs, echips, boots, keys, etc.
	ITEM_SUFFIX, // No sign, etc.
	MOVABLE, // Blocks, Players, Monsters
	SPECIAL, // Thin walls, canopies, etc.
}

class Tile implements Wirable {
	optimizedState: Partial<Record<Layer, Actor | Actor[]>> = {}
	protected *getAllLayers(): IterableIterator<Actor> {
		for (let i = 0; i <= Layer.SPECIAL; i++) yield* this.getLayer(i)
	}
	protected *getAllLayersReverse(): IterableIterator<Actor> {
		for (let i = Layer.SPECIAL; i >= 0; i--) yield* this.getLayer(i)
	}
	protected *getLayer(layer: Layer): IterableIterator<Actor> {
		if (!this.optimizedState[layer]) return
		if (this.optimizedState[layer] instanceof Actor)
			yield this.optimizedState[layer] as Actor
		else yield* this.optimizedState[layer] as Actor[]
	}
	get [Layer.ITEM](): IterableIterator<Actor> {
		return this.getLayer(Layer.ITEM)
	}
	get [Layer.ITEM_SUFFIX](): IterableIterator<Actor> {
		return this.getLayer(Layer.ITEM_SUFFIX)
	}
	get [Layer.MOVABLE](): IterableIterator<Actor> {
		return this.getLayer(Layer.MOVABLE)
	}
	get [Layer.SPECIAL](): IterableIterator<Actor> {
		return this.getLayer(Layer.SPECIAL)
	}
	get [Layer.STATIONARY](): IterableIterator<Actor> {
		return this.getLayer(Layer.STATIONARY)
	}
	get allActors(): IterableIterator<Actor> {
		return this.getAllLayers()
	}
	get allActorsReverse(): IterableIterator<Actor> {
		return this.getAllLayersReverse()
	}
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
	findActor(
		layer: Layer,
		func: (val: Actor, i: number) => boolean
	): Actor | null
	findActor(func: (val: Actor, i: number) => boolean): Actor | null
	findActor(
		funcOrLayer: Layer | ((val: Actor, i: number) => boolean),
		funcIfLayer?: (val: Actor, i: number) => boolean
	): Actor | null {
		// Handle the per-layer situation first
		if (!(funcOrLayer instanceof Function) && funcIfLayer) {
			const theLayer = this.optimizedState[funcOrLayer]
			if (!theLayer) return null
			if (!(theLayer instanceof Array))
				return funcIfLayer(theLayer, 0) ? theLayer : null
			return theLayer.find(funcIfLayer) ?? null
		}
		if (!(funcOrLayer instanceof Function)) return null
		let i = 0
		for (const actor of this.getAllLayers())
			if (funcOrLayer(actor, i++)) return actor
		return null
	}
	layerLength(layer: Layer): number {
		const theLayer = this.optimizedState[layer]
		if (!theLayer) return 0
		if (theLayer instanceof Actor) return 1
		return theLayer.length
	}
	hasLayer(layer: Layer): boolean {
		return !!this.optimizedState[layer]
	}
	/**
	 * Adds new actors to the tile, sorting everything automatically
	 */
	addActors(actors: Actor | Actor[]): void {
		actors = actors instanceof Array ? actors : [actors]
		for (const actor of actors) {
			const theLayer = this.optimizedState[actor.layer]
			if (!theLayer) this.optimizedState[actor.layer] = actor
			else if (this.level.extendedMode) {
				if (theLayer instanceof Actor)
					this.optimizedState[actor.layer] = [theLayer, actor]
				else theLayer.push(actor)
			} else {
				if (theLayer instanceof Actor) {
					theLayer.despawned = true
					crossLevelData.despawnedActors.push(theLayer)
				} else
					theLayer.forEach(val => {
						val.despawned = true
						crossLevelData.despawnedActors.push(val)
					})
				this.optimizedState[actor.layer] = actor
				console.warn("A despawn has happened.")
			}
		}
	}
	removeActors(actors: Actor | Actor[]): void {
		actors = actors instanceof Array ? actors : [actors]

		for (const actor of actors) {
			const theLayer = this.optimizedState[actor.layer]
			// Ignore attempts to remove a non-existant actor
			if (!theLayer) continue
			if (this.level.extendedMode) {
				if (theLayer instanceof Actor) {
					if (theLayer === actor) delete this.optimizedState[actor.layer]
				} else {
					const index = theLayer.indexOf(actor)
					if (index === -1) continue
					theLayer.splice(index, 1)
				}
			} else {
				if (theLayer !== actor) {
					console.warn("A despawn has happened.")
					if (theLayer instanceof Actor) {
						theLayer.despawned = true
						crossLevelData.despawnedActors.push(theLayer)
					} else
						theLayer.forEach(val => {
							if (val !== actor) {
								val.despawned = true
								crossLevelData.despawnedActors.push(val)
							}
						})
				}
				delete this.optimizedState[actor.layer]
			}
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
	// TODO Speed boots
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
	wires: number = 0
	poweredWires: number = 0
	wireTunnels: number = 0
	circuits?: CircuitCity[]
	wireOverlapMode: WireOverlapMode = WireOverlapMode.CROSS
	poweringWires: number = 0
	listensWires = false
}

export default Tile
