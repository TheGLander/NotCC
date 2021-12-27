import { Direction } from "./helpers"
import { Actor } from "./actor"
import { LevelState } from "./level"
import Tile, { Layer } from "./tile"

export interface Wirable {
	wires: Wires
	poweredWires: Wires
	wireTunnels: Wires
	circuits?: CircuitCity[]
	wireOverlapMode: WireOverlapMode
}

export enum Wires {
	UP = 1,
	RIGHT = 2,
	DOWN = 4,
	LEFT = 8,
}

export enum WireOverlapMode {
	OVERLAP,
	CROSS,
	NONE,
}

export const wireToDir: (wire: Wires) => Direction = Math.log2
export const dirToWire = (wire: Direction): Wires => 2 ** wire
export function getWireMask(wirable: Wirable, dir: Wires): Wires {
	switch (wirable.wireOverlapMode) {
		case WireOverlapMode.NONE:
			return dir
		case WireOverlapMode.CROSS:
			//@ts-expect-error Typescript dumb
			if (wirable.wires === 0b1111)
				return dir >= 0b0100 ? dir | (dir >> 2) : dir | (dir << 2)

		/* fallthrough */
		case WireOverlapMode.OVERLAP:
			return 0b1111
	}
}

// TODO Is there anything to it other than the population?
export type CircuitCity = [Wirable, Wires][]

function getTileWirable(tile: Tile): Wirable {
	for (const actor of tile.allActors) if (actor.wires) return actor
	return tile
}

function traceCircuit(base: Wirable, direction: Direction): CircuitCity {
	// TypeScript: Allows 123 as Wires. Also TypeScript: Wires and 123 have no overlap
	const TODOstack: CircuitCity = []
	const baseWireMask = getWireMask(base, dirToWire(direction))
	for (let i = Wires.UP; i <= Wires.LEFT; i *= 2)
		if (baseWireMask & i) TODOstack.push([base, i])
	if (
		base.wireOverlapMode === WireOverlapMode.CROSS ||
		base.wireOverlapMode === WireOverlapMode.OVERLAP
	)
		TODOstack.push([base, dirToWire((direction + 2) % 4)])
	if (
		base.wireOverlapMode === WireOverlapMode.OVERLAP ||
		// @ts-expect-error Typescript dumb
		(base.wires !== 0b111 && base.wireOverlapMode === WireOverlapMode.CROSS)
	)
		TODOstack.push(
			[base, dirToWire((direction + 1) % 4)],
			[base, dirToWire((direction + 3) % 4)]
		)
	const seen: CircuitCity = []
	while (TODOstack.length > 0) {
		const [wirable, direction] = TODOstack.shift() as [Wirable, Wires]
		const registeredActor = seen.find(val => val[0] === wirable)
		if (
			!(wirable.wires & direction) ||
			(registeredActor && registeredActor[1] & direction)
		)
			continue
		if (registeredActor) registeredActor[1] |= direction
		else seen.push([wirable, direction])
		let newWirable: Wirable | null
		if (wirable instanceof Actor) {
			const neigh = wirable.tile.getNeighbor(wireToDir(direction))
			if (neigh) newWirable = getTileWirable(neigh)
			else newWirable = null
		} else if (wirable instanceof Tile) {
			const neigh = wirable.getNeighbor(wireToDir(direction))
			if (neigh) newWirable = getTileWirable(neigh)
			else newWirable = null
		} else throw new Error("Um, this shouldn't happen")

		const entraceWire = dirToWire((wireToDir(direction) + 2) % 4)
		if (!newWirable || !(newWirable.wires & entraceWire)) continue
		const newWireMask = getWireMask(newWirable, entraceWire)
		for (let i = Wires.UP; i <= Wires.LEFT; i *= 2)
			if (newWirable.wires & i && newWireMask & i)
				TODOstack.push([newWirable, i])
	}
	return seen
}

export function buildCircuits(level: LevelState): void {
	for (const tile of level.tiles()) {
		const wirable = getTileWirable(tile)
		if (!wirable.wires) continue
		tileLoop: for (let i = Wires.UP; i <= Wires.LEFT; i *= 2) {
			if (
				!(wirable.wires & i) ||
				level.circuits.some(val =>
					val.some(
						val => val[0] === wirable && val[1] & getWireMask(wirable, i)
					)
				)
			)
				continue tileLoop
			const circuit: CircuitCity = traceCircuit(wirable, wireToDir(i))
			level.circuits.push(circuit)
			for (const wirable of circuit) {
				if (!wirable[0].circuits) wirable[0].circuits = [circuit]
				else wirable[0].circuits.push(circuit)
			}
		}
	}
}
