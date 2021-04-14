import { Actor } from "./actor"

/**
 * An object which matched IDs and and actor classes, is used for loading level actors
 */
export const actorDB: Record<string, typeof Actor> = {}

/**
 * The position of keys to show in the inventory preview
 */
export const keyNameList: string[] = []

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
