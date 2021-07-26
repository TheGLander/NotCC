import { artDB, setArtForActor } from "../const"
import { LitTNT, Rover } from "../logic/actors/monsters"
import {
	genericAnimatedArt,
	genericStretchyArt,
	genericDirectionableArt,
} from "../visuals"

artDB["centipede"] = genericDirectionableArt("centipede", 3)
artDB["ant"] = genericDirectionableArt("ant", 4)
artDB["glider"] = genericDirectionableArt("glider", 2)
artDB["fireball"] = genericAnimatedArt("fireball", 4)
artDB["ball"] = genericAnimatedArt("ball", 4)
artDB["teethRed"] = actor => ({
	actorName: "teethRed",
	animation:
		actor.direction % 2 === 0
			? "vertical"
			: ["right", "left"][(actor.direction - 1) / 2],
	frame: actor.cooldown ? Math.floor(actor.level.currentTick / 3) % 3 : 0,
})
artDB["teethBlue"] = actor => ({
	actorName: "teethBlue",
	animation:
		actor.direction % 2 === 0
			? "vertical"
			: ["right", "left"][(actor.direction - 1) / 2],
	frame: actor.cooldown ? Math.floor(actor.level.currentTick / 3) % 2 : 0,
})
artDB["tankBlue"] = genericDirectionableArt("tankBlue", 2)
artDB["tankYellow"] = genericDirectionableArt("tankYellow", 2)
artDB["blob"] = genericStretchyArt("blob", 8)
artDB["walker"] = genericStretchyArt("walker", 8)
setArtForActor<LitTNT>("tntLit", actor => ({
	actorName: "tnt",
	frame: Math.floor(actor.lifeLeft / 60),
}))
artDB["floorMimic"] = actor => ({
	actorName: actor.level.selectedPlayable
		?.getCompleteTags("tags")
		.includes("can-see-secrets")
		? "floorMimic"
		: "floor",
})

artDB["bowlingBallRolling"] = genericAnimatedArt("bowlingBall", 2)

setArtForActor<Rover>("rover", actor => [
	{
		actorName: "rover",
		animation: actor.emulatedMonster,
		frame: Math.floor(actor.level.currentTick / 3) % 8,
	},
	{
		actorName: "rover",
		animation: "antenna" + ["Up", "Right", "Down", "Left"][actor.direction],
		cropSize: [0.5, 0.5],
		imageOffset: [0.25, 0.25],
	},
])

artDB["ghost"] = actor => ({
	actorName: "ghost",
	animation: ["up", "right", "down", "left"][actor.direction],
})
