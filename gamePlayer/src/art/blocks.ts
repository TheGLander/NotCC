import { artDB, setArtForActor } from "../const"
import { DirectionalBlock } from "@notcc/logic"
import { ActorArt } from "../visuals"
import { Direction } from "@notcc/logic"
import { Layer } from "@notcc/logic"

const layersToSearch = [
	Layer.ITEM,
	Layer.ITEM_SUFFIX,
	Layer.SPECIAL,
	Layer.STATIONARY,
]

artDB["dirtBlock"] = actor => ({
	actorName: "dirtBlock",
	animation:
		actor.level.selectedPlayable
			?.getCompleteTags("tags")
			.includes("can-see-secrets") &&
		(!!actor.tile.wires || layersToSearch.some(val => actor.tile.hasLayer(val)))
			? "seeThrough"
			: "default",
})

artDB["iceBlock"] = actor => ({
	actorName: "iceBlock",
	animation:
		actor.level.selectedPlayable
			?.getCompleteTags("tags")
			.includes("can-see-secrets") &&
		(!!actor.tile.wires || layersToSearch.some(val => actor.tile.hasLayer(val)))
			? "seeThrough"
			: "default",
})

setArtForActor<DirectionalBlock>("directionalBlock", actor => [
	{ actorName: "directionalBlock" },
	...actor.legalDirections.map<ActorArt>(val => ({
		actorName: "directionalBlock",
		animation: "arrow" + ["Up", "Right", "Down", "Left"][val],
		cropSize: [((val + 1) % 2) * 0.75 + 0.25, (val % 2) * 0.75 + 0.25],
		imageOffset: [
			val === Direction.RIGHT ? 0.75 : 0,
			val === Direction.DOWN ? 0.75 : 0,
		],
	})),
])
