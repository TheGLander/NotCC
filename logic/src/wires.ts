import { Direction } from "./helpers"
import { Actor } from "./actor"
import { LevelState } from "./level"
import Tile, { Layer } from "./tile"
import { iterableFindIndex, iterableIncludes } from "./iterableHelpers"

export interface Wirable {
	wires: number
	poweredWires: number
	wireTunnels: number
	circuits?: [CircuitCity?, CircuitCity?, CircuitCity?, CircuitCity?]
	wireOverlapMode: WireOverlapMode
	poweringWires: number
	pulse?(): void
	unpulse?(): void
	processOutput?(): void
	listensWires?: boolean
	providesPower?: boolean
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
			if (wirable.wires === 0b1111)
				return dir >= 0b0100 ? dir | (dir >> 2) : dir | (dir << 2)

		/* fallthrough */
		case WireOverlapMode.OVERLAP:
			return 0b1111
	}
}

export interface CircuitCity {
	/**
	 * All wirables, including neighbours which don't have wires
	 */
	population: Map<Wirable, Wires>
	outputs: Wirable[]
}

function getTileWirable(tile: Tile): Wirable {
	for (const actor of tile.allActors)
		if (actor.wires || (actor.layer === Layer.STATIONARY && tile.wires === 0))
			return actor
	return tile
}

function traceCircuit(base: Wirable, direction: Direction): CircuitCity {
	// TypeScript: Allows 123 as Wires. Also TypeScript: Wires and 123 have no overlap
	// Not a map since we need to queue up multiple directions with the same wirable
	const TODOstack: [Wirable, Wires][] = []
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
		(base.wires !== 0b111 && base.wireOverlapMode === WireOverlapMode.CROSS)
	) {
		TODOstack.push([base, dirToWire((direction + 1) % 4)])
		TODOstack.push([base, dirToWire((direction + 3) % 4)])
	}

	const circuit: CircuitCity = {
		outputs: [],
		population: new Map(),
	}
	if (base.pulse || base.unpulse || base.listensWires || base.processOutput)
		circuit.outputs.push(base)
	while (TODOstack.length > 0) {
		const [wirable, direction] = TODOstack.shift() as [Wirable, Wires]
		const registeredWires = circuit.population.get(wirable)
		if (registeredWires && registeredWires & direction) continue
		if (registeredWires)
			circuit.population.set(wirable, registeredWires | direction)
		else circuit.population.set(wirable, direction)
		if (!(wirable.wires & direction)) continue
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
		if (!newWirable) continue
		if (
			newWirable.pulse ||
			newWirable.unpulse ||
			newWirable.listensWires ||
			newWirable.processOutput
		)
			circuit.outputs.push(newWirable)
		if (!(newWirable.wires & entraceWire)) {
			const newRegisteredWires = circuit.population.get(newWirable)
			// Welp, the journey of this no-wire wirable ends here,
			// but we still record it because clone machines
			// and stuff use wires as input even when they
			// don't have the wires themselves
			if (newRegisteredWires)
				circuit.population.set(newWirable, newRegisteredWires | entraceWire)
			else circuit.population.set(newWirable, entraceWire)
			continue
		}
		const newWireMask = getWireMask(newWirable, entraceWire)
		for (let i = Wires.UP; i <= Wires.LEFT; i *= 2)
			if (newWirable.wires & i && newWireMask & i)
				TODOstack.push([newWirable, i])
	}
	return circuit
}

export function buildCircuits(this: LevelState): void {
	for (const tile of this.tiles()) {
		const wirable = getTileWirable(tile)
		if (!wirable.wires) continue
		tileLoop: for (let i = Wires.UP; i <= Wires.LEFT; i *= 2) {
			if (
				!(wirable.wires & i) ||
				this.circuits.some(
					val =>
						iterableFindIndex(
							val.population.entries(),
							val =>
								val[0] === wirable && (val[1] & getWireMask(wirable, i)) > 0
						) >= 0
				)
			)
				continue tileLoop
			const circuit: CircuitCity = traceCircuit(wirable, wireToDir(i))
			this.circuits.push(circuit)
			for (const wirable of circuit.population) {
				if (!wirable[0].circuits) wirable[0].circuits = []
				wirable[0].circuits[wireToDir(i)] = circuit
			}
		}
	}
	this.circuitOutputs = this.circuits
		.reduce<Wirable[]>((acc, val) => acc.concat(val.outputs), [])
		.filter((val, i, arr) => arr.indexOf(val) === i)
}

// TODO Optimize this
export function wireTick(this: LevelState) {
	if (!this.circuits.length) return
	// Step 1. Let all inputs calcuate output
	for (const actor of this.actors) actor.updateWires?.()
	// Also, save all wire states, for pulse detection
	const wasPowered = new Map<Wirable, boolean>()
	for (const output of this.circuitOutputs)
		wasPowered.set(output, !!output.poweredWires)
	// Step 2. Update circuits to be powered, based on the powering population
	for (const circuit of this.circuits) {
		let circuitPowered = false
		for (const actor of circuit.population)
			if (actor[0].poweringWires & actor[1]) {
				circuitPowered = true
				break
			}

		for (const actor of circuit.population)
			if (circuitPowered) actor[0].poweredWires |= actor[1]
			else actor[0].poweredWires &= ~actor[1]
	}
	// Step 3. Notify outputs for pulses/unpulses
	for (const output of this.circuitOutputs) {
		output.processOutput?.()
		if (wasPowered.get(output) && !output.poweredWires && output.unpulse)
			output.unpulse()
		else if (!wasPowered.get(output) && output.poweredWires && output.pulse)
			output.pulse()
	}
}

export function isWired(actor: Actor): boolean {
	for (let i = 0; i < 4; i++) {
		const neigh = actor.tile.getNeighbor(i)
		if (!neigh) continue
		const wirable = getTileWirable(neigh)
		if (
			!wirable ||
			// A wirable which doesn't provide power and can't share the power via neighbours is useless for this tile
			(wirable.wireOverlapMode === WireOverlapMode.NONE &&
				!wirable.providesPower)
		)
			continue
		if (wirable.wires & dirToWire((i + 2) % 4)) return true
	}
	return false
}
