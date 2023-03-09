import { ActorArt, Tileset } from "./visuals"
import { Actor, Wirable } from "@notcc/logic"

export type Falsy = false | undefined | 0 | null | ""

type ArtFunc<T = Actor> =
	| ActorArt
	| (ActorArt | Falsy)[]
	| ((actor: T, tileset: Tileset) => ActorArt | (ActorArt | Falsy)[])

export const artDB: Record<string, ArtFunc> & {
	floor?: ArtFunc<Wirable | undefined>
} = {}

export function setArtForActor<T extends Actor>(
	id: string,
	art: ArtFunc<T>
): void {
	artDB[id] = art as ArtFunc<Actor>
}
