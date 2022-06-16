import { artDB, setArtForActor } from "../const"
import { CombinationTile, VoodooTile } from "@notcc/logic"

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
