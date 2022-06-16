import { artDB } from "../const"
import { Actor } from "@notcc/logic"
import { genericWiredTerrainArt, wireBaseArt } from "../visuals"

for (const color of ["green", "blue", "brown", "red", "orange", "gray"])
	artDB[`button${color[0].toUpperCase()}${color.substr(1).toLowerCase()}`] = {
		actorName: "button",
		animation: color,
	}

artDB["buttonPurple"] = genericWiredTerrainArt("button", "purple")
artDB["buttonBlack"] = genericWiredTerrainArt("button", "black")

artDB["complexButtonYellow"] = {
	actorName: "button",
	animation: "yellow",
}

artDB["toggleSwitch"] = (actor: Actor) => [
	{ actorName: "toggleSwitch", animation: "wireBase" },
	...wireBaseArt(actor.wires, actor.poweredWires),
	{
		actorName: "toggleSwitch",
		animation: actor.customData,
	},
]
