import { ActorArt } from "./visuals"
import { Actor } from "./logic/actor"

export type Falsy = false | undefined | 0 | null | ""

export const artDB: Record<
	string,
	| ActorArt
	| (ActorArt | Falsy)[]
	| ((actor: Actor) => ActorArt | (ActorArt | Falsy)[])
> = {}

export function setArtForActor<T extends Actor>(
	id: string,
	art:
		| ActorArt
		| (ActorArt | Falsy)[]
		| ((actor: T) => ActorArt | (ActorArt | Falsy)[])
): void {
	//@ts-expect-error TS is dumb
	artDB[id] = art
}
