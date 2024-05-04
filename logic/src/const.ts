import { Actor, tagProperties } from "./actor.js"
import { Direction } from "./helpers.js"
import { LevelState } from "./level.js"

/**
 * An object which matched IDs and and actor classes, is used for loading level actors
 */
export const actorDB: Record<
	string,
	new (
		level: LevelState,
		position: [number, number],
		customData?: string,
		direction?: Direction
	) => Actor
> = {}

export const tagFlags: Map<string, bigint> = new Map()

export function makeTagFlagField(tags: string[]): bigint {
	if (typeof tags === "bigint") return tags
	return tags.reduce((acc, tag) => {
		if (tagFlags.has(tag)) return acc | tagFlags.get(tag)!
		const flag = BigInt(1) << BigInt(tagFlags.size)
		tagFlags.set(tag, flag)
		return acc | flag
	}, BigInt(0))
}
export function registerTaggedType(actorType: any): void {
	for (const prop of tagProperties.concat(actorType.extraTagProperties ?? [])) {
		if (!actorType[prop]) continue
		actorType[prop] = makeTagFlagField(actorType[prop])
	}
	if (actorType.carrierTags) {
		for (const prop in actorType.carrierTags) {
			actorType.carrierTags[prop] = makeTagFlagField(
				actorType.carrierTags[prop]
			)
		}
	}
}
export function getTagFlag(tag: string) {
	return tagFlags.get(tag) ?? BigInt(0)
}
export function hasTag(actor: Actor, tag: string) {
	return !!(actor.tags & getTagFlag(tag))
}
export function hasTagOverlap(tags1: bigint, tags2: bigint): boolean {
	return !!(tags1 & tags2)
}

/**
 * The position of keys to show in the inventory preview
 */
export const keyNameList: string[] = []
export const cc1BootNameList: string[] = []

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
