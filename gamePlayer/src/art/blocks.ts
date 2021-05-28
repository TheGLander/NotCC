import { artDB } from "../const"

artDB["dirtBlock"] = actor => ({
	actorName: "dirtBlock",
	animation:
		actor.level.selectedPlayable
			?.getCompleteTags("tags")
			.includes("can-see-secrets") && actor.tile.allActors.length > 1
			? "seeThrough"
			: "default",
})

artDB["iceBlock"] = actor => ({
	actorName: "iceBlock",
	animation:
		actor.level.selectedPlayable
			?.getCompleteTags("tags")
			.includes("can-see-secrets") && actor.tile.allActors.length > 1
			? "seeThrough"
			: "default",
})
