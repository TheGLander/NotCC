import { artDB, setArtForActor } from "../const"
import { CombinationTile, VoodooTile } from "../logic/actors/weird"

// TODO The current way renders are done makes the combination tile really hard to draw
setArtForActor<CombinationTile>("combinationTile", actor => [
	{
		actorName: "floor",
	},
	actor.drawOnTop && {
		actorName: "placeholder",
		sourceOffset: actor.drawOnTop,
	},
])

setArtForActor<VoodooTile>("voodooTile", actor => ({
	actorName: "voodooTileStart",
	sourceOffset: actor.tileOffset,
}))
