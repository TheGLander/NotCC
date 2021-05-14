import { setArtForActor } from "../const"
import { Animation as Anim } from "../logic/actors/animation"

setArtForActor("splashAnim", (actor: Anim) => ({
	actorName: "splash",
	animation: "default",
	frame: Math.floor(4 - actor.animationCooldown / 4),
}))

setArtForActor("explosionAnim", (actor: Anim) => ({
	actorName: "boom",
	animation: "default",
	frame: Math.floor(4 - actor.animationCooldown / 4),
}))
