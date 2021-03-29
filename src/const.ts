import { Actor } from "./actor"
import { Direction } from "./helpers"

export const actorDB: Record<string, Actor> = {}

/**
 * A decision an actor can take
 */
export enum Decision {
	NONE,
	UP,
	RIGHT,
	DOWN,
	LEFT,
}
