import { artDB, setArtForActor } from "../const"
import { LitTNT } from "../logic/actors/monsters"
import {
	genericAnimatedArt,
	genericStretchyArt,
	genericDirectionableArt,
} from "../visuals"

artDB["centipede"] = genericDirectionableArt("centipede", 3)
artDB["ant"] = genericDirectionableArt("ant", 4)
artDB["glider"] = genericDirectionableArt("glider", 2)
artDB["fireball"] = genericAnimatedArt("fireball", 4)
artDB["ball"] = genericDirectionableArt("ball", 4)
artDB["teethRed"] = actor => ({
	actorName: "teethRed",
	animation:
		actor.direction % 2 === 0
			? "vertical"
			: ["right", "left"][(actor.direction - 1) / 2],
	frame: actor.cooldown ? Math.floor(actor.level.currentTick / 3) : 0,
})
artDB["tankBlue"] = genericDirectionableArt("tankBlue", 2)
artDB["blob"] = genericStretchyArt("blob", 8)
artDB["walker"] = genericStretchyArt("walker", 8)
setArtForActor<LitTNT>("tntLit", actor => ({
	actorName: "tnt",
	frame: Math.floor(actor.lifeLeft / 60),
}))
