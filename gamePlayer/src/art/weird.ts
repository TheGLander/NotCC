import { artDB, setArtForActor } from "../const"
import { CombinationTile, VoodooTile } from "../logic/actors/weird"

setArtForActor<CombinationTile>("combinationTile", actor => [
	actor.drawOnTop && {
		actorName: "placeholder",
		sourceOffset: actor.drawOnTop,
	},
])

setArtForActor<VoodooTile>("voodooTile", actor => ({
	actorName: "voodooTileStart",
	sourceOffset: actor.tileOffset,
}))
