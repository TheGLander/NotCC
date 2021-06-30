import { artDB, setArtForActor } from "../const"
import { DirectionalBlock } from "../logic/actors/blocks"
import { ActorArt } from "../visuals"
import { Direction } from "../logic/helpers"

artDB["dirtBlock"] = actor => ({
	actorName: "dirtBlock",
	animation:
		actor.level.selectedPlayable
			?.getCompleteTags("tags")
			.includes("can-see-secrets") && !actor.tile.allActors.next().done
			? "seeThrough"
			: "default",
})

artDB["iceBlock"] = actor => ({
	actorName: "iceBlock",
	animation:
		actor.level.selectedPlayable
			?.getCompleteTags("tags")
			.includes("can-see-secrets") && !actor.tile.allActors.next().done
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
