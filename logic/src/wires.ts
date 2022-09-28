import { Direction } from "./helpers"
import { Actor } from "./actor"
import { LevelState } from "./level"
import { Tile, Layer } from "./tile"
import { iterableFindIndex } from "./iterableHelpers"

export interface Wirable {
	wires: number
	poweredWires: number
	wireTunnels: number
	circuits?: [CircuitCity?, CircuitCity?, CircuitCity?, CircuitCity?]
	wireOverlapMode: WireOverlapMode
	poweringWires: number
	pulse?(actual: boolean): void
	unpulse?(): void
	processOutput?(): void
	listensWires?: boolean
	providesPower?: boolean
	requiresFullConnect?: boolean
}

function getWireableTile(wirable: Wirable) {
	if (wirable instanceof Actor) return wirable.tile
	else if (wirable instanceof Tile) return wirable
	throw new Error("")
}

const sortRRO = (level: LevelState) => (a: Wirable, b: Wirable) =>
	-(
		getWireableTile(a).x +
		getWireableTile(a).y * level.width -
		getWireableTile(b).x -
		getWireableTile(b).y * level.width
	)

export enum Wires {
	UP = 1,
	RIGHT = 2,
	DOWN = 4,
	LEFT = 8,
}

export enum WireOverlapMode {
	OVERLAP,
	CROSS,
	ALWAYS_CROSS,
	NONE,
}

export const wireToDir: (wire: Wires) => Direction = Math.log2
export const dirToWire = (wire: Direction): Wires => 2 ** wire
export function getWireMask(wirable: Wirable, dir: Wires): Wires {
	switch (wirable.wireOverlapMode) {
		case WireOverlapMode.NONE:
			return dir
		case WireOverlapMode.CROSS:
		case WireOverlapMode.ALWAYS_CROSS:
			if (
				wirable.wires === 0b1111 ||
				wirable.wireOverlapMode === WireOverlapMode.ALWAYS_CROSS
			)
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

export function getTileWirable(tile: Tile): Wirable {
	for (const actor of tile.allActors)
		if (
			actor.wires ||
			(actor.layer === Layer.STATIONARY &&
				tile.wires === 0 &&
				tile.wireTunnels === 0)
		)
			return actor
	return tile
}

function getMatchingTunnel(tile: Tile, direction: Direction): Wirable | null {
	let depth = 0
	const wires = dirToWire(direction)
	const oppositeWires = dirToWire((direction + 2) % 4)
	for (
		let newTile = tile.getNeighbor(direction, false);
		newTile !== null;
		newTile = newTile.getNeighbor(direction, false)
	) {
		const tileWirable = getTileWirable(newTile)
		if (tileWirable.wireTunnels & oppositeWires) {
			if (depth === 0) return tileWirable
			else depth--
		}
		if (tileWirable.wireTunnels & wires) depth++
	}
	return null
}

function traceCircuit(base: Wirable, direction: Direction): CircuitCity {
	// TypeScript: Allows 123 as Wires. Also TypeScript: Wires and 123 have no overlap
	// Not a map since we need to queue up multiple directions with the same wirable
	const TODOstack: [Wirable, Wires][] = []
	const baseWireMask = getWireMask(base, dirToWire(direction))
	for (let i = Wires.UP; i <= Wires.LEFT; i *= 2)
		if (baseWireMask & i) TODOstack.push([base, i])

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
		let thisTile: Tile
		if (wirable instanceof Actor) thisTile = wirable.tile
		else if (wirable instanceof Tile) thisTile = wirable
		else throw new Error("Um, this shouldn't happen")
		let newWirable: Wirable | null
		if (wirable.wireTunnels & direction)
			newWirable = getMatchingTunnel(thisTile, wireToDir(direction))
		else {
			const neigh = thisTile.getNeighbor(wireToDir(direction))
			if (neigh) newWirable = getTileWirable(neigh)
			else continue
			const entraceWire = dirToWire((wireToDir(direction) + 2) % 4)
			if (newWirable.wireTunnels & entraceWire) continue
		}
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
			if (newWirable.requiresFullConnect) continue
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
				for (let i = Direction.UP; i <= Wires.LEFT; i++) {
					if (dirToWire(i) & wirable[1]) {
						wirable[0].circuits[i] = circuit
					}
				}
			}
		}
	}
	this.circuitInputs = this.actors.filter(val => val.providesPower)
	this.circuitOutputs = this.circuits
		.reduce<Wirable[]>((acc, val) => acc.concat(val.outputs), [])
		.filter((val, i, arr) => arr.indexOf(val) === i)
		.sort(sortRRO(this))
	this.circuitOutputStates = new Map()

	for (const actor of this.actors) actor.wired = isWired(actor)
}

export function wirePretick(this: LevelState): void {
	if (!this.circuits.length) return
	// Step 3 (of last wire tick). Notify outputs for pulses/unpulses
	for (const [output, wasPowered] of this.circuitOutputStates) {
		if (wasPowered && !output.poweredWires && output.unpulse) output.unpulse()
		else if (!wasPowered && output.poweredWires && output.pulse)
			output.pulse(true)
	}
}

// TODO Optimize this
export function wireTick(this: LevelState): void {
	if (!this.circuits.length) return
	// Step 1. Let all inputs calcuate output
	for (const actor of Array.from(this.circuitInputs)) {
		if (!actor.exists) {
			this.circuitInputs.splice(this.circuitInputs.indexOf(actor), 1)
		}
		actor.updateWires?.()
	}
	// Also, save all wire states, for pulse detection
	for (const output of this.circuitOutputs)
		this.circuitOutputStates.set(output, !!output.poweredWires)
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
	for (const output of this.circuitOutputs) output.processOutput?.()
}

export function isWired(actor: Actor): boolean {
	for (let i = 0; i < 4; i++) {
		if (actor.wireTunnels & dirToWire(i)) continue
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
		if (
			wirable.wires & dirToWire((i + 2) % 4) &&
			!(wirable.wireTunnels & dirToWire((i + 2) % 4))
		)
			return true
	}
	return false
}
