import { Direction } from "./helpers"
import { Actor } from "./actor"
import { LevelState } from "./level"
import { Layer } from "./tile"

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

// TODO Is there anything to it other than the population?
export interface CircuitCity {
	population: [Actor, Wires][]
}

function traceCircuit(base: Actor): [Actor, Wires][] {
	// TypeScript: Allows 123 as Wires. Also TypeScript: Wires and 123 have no overlap
	const TODOstack: [Actor, Wires][] = [
		[base, Wires.UP],
		[base, Wires.RIGHT],
		[base, Wires.DOWN],
		[base, Wires.LEFT],
	]
	const seen: [Actor, Wires][] = []
	while (TODOstack.length > 0) {
		const [actor, direction] = TODOstack.shift() as [Actor, Wires]
		const registeredActor = seen.find(val => val[0] === actor)
		if (
			!(actor.wires & direction) ||
			(registeredActor && registeredActor[1] & direction)
		)
			continue
		if (registeredActor) registeredActor[1] |= direction
		else seen.push([actor, direction])
		const newActor: Actor | undefined = actor.tile
			.getNeighbor(wireToDir(direction))
			?.[Layer.STATIONARY].next().value
		const entraceWire = dirToWire((wireToDir(direction) + 2) % 4)
		if (!newActor || !(newActor.wires & entraceWire)) continue
		for (let i = Wires.UP; i < Wires.LEFT; i **= 2)
			if (newActor.wires & i && !(registeredActor && registeredActor[1] & i))
				TODOstack.push([newActor, i])
	}
	return seen
}

export function buildCircuits(level: LevelState): void {
	for (const actor of level.actors) {
		if (!actor.wires) continue
	}
}
