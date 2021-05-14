import { artDB } from "../const"

artDB["chip"] = actor => [
	actor.level.playablesLeft > 1 &&
		actor.level.selectedPlayable === actor && { actorName: "playerAura" },
	{
		actorName: "chip",
		animation: ["up", "right", "down", "left"][actor.direction],
		frame: actor.cooldown
			? Math.floor((1 - actor.cooldown / (actor.currentMoveSpeed ?? 1)) * 8)
			: 0,
	},
]

artDB["melinda"] = actor => [
	actor.level.playablesLeft > 1 &&
		actor.level.selectedPlayable === actor && { actorName: "playerAura" },
	{
		actorName: "melinda",
		animation: ["up", "right", "down", "left"][actor.direction],
		frame: actor.cooldown
			? Math.floor((1 - actor.cooldown / (actor.currentMoveSpeed ?? 1)) * 8)
			: 0,
	},
]
