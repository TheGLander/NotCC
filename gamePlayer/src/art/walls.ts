import { artDB, setArtForActor } from "../const"
import { Direction } from "../logic/helpers"
import { InvisibleWall } from "../logic/actors/walls"
import { Layer } from "../logic/tile"

artDB["wall"] = { actorName: "wall" }

artDB["steelWall"] = { actorName: "steelWall" }

artDB["customWall"] = actor => ({
	actorName: "customWall",
	animation: actor.customData,
})

for (const color of ["blue", "red", "yellow", "green"])
	artDB[color[0].toUpperCase() + color.substr(1).toLowerCase()] = {
		actorName: "door",
		animation: color,
	}

const shortDirNames = ["u", "r", "d", "l"]

artDB["thinWall"] = actor =>
	actor.customData.split("").map(val => {
		const direction = shortDirNames.indexOf(val)
		return {
			actorName: "thinWall",
			animation: ["up", "right", "down", "left"][direction],
			cropSize: [(((direction + 1) % 2) + 1) / 2, ((direction % 2) + 1) / 2],
			imageOffset: [
				direction === Direction.RIGHT ? 0.5 : 0,
				direction === Direction.DOWN ? 0.5 : 0,
			],
		}
	})

setArtForActor<InvisibleWall>("invisibleWall", actor => ({
	actorName: actor.level.selectedPlayable
		?.getCompleteTags("tags")
		.includes("can-see-secrets")
		? "invisibleWall"
		: actor.animationLeft
		? "wall"
		: null,
}))

artDB["blueWall"] = actor => ({
	actorName: "blueWall",
	animation:
		actor.customData === "fake" &&
		actor.level.selectedPlayable
			?.getCompleteTags("tags")
			.includes("can-see-secrets")
			? "revealed"
			: "default",
})

artDB["appearingWall"] = actor => ({
	actorName: actor.level.selectedPlayable
		?.getCompleteTags("tags")
		.includes("can-see-secrets")
		? "appearingWall"
		: null,
})

artDB["toggleWall"] = actor => [
	{
		actorName: "outline",
		animation: "green",
	},
	actor.customData === "on" && { actorName: "outlineWall" },
]

artDB["swivelRotatingPart"] = actor => ({
	actorName: "swivel",
	animation: ["ur", "dr", "dl", "ul"][actor.direction],
})

artDB["swivel"] = { actorName: "swivel", animation: "floor" }

artDB["greenWall"] = actor => ({
	actorName: "greenWall",
	animation:
		actor.customData === "fake" &&
		(actor.tile.hasLayer(Layer.MOVABLE) ||
			actor.level.selectedPlayable
				?.getCompleteTags("tags")
				.includes("can-see-secrets"))
			? "fake"
			: "real",
})

artDB["noChipSign"] = { actorName: "noChipSign" }

artDB["noMelindaSign"] = { actorName: "noMelindaSign" }
