import { artDB } from "../const"

artDB["echip"] = artDB["echipPlus"] = { actorName: "echip" }

for (const color of ["red", "blue", "yellow", "green"]) {
	artDB[`key${color[0].toUpperCase()}${color.substr(1).toLowerCase()}`] = {
		actorName: "key",
		animation: color,
	}
	artDB[`door${color[0].toUpperCase()}${color.substr(1).toLowerCase()}`] = {
		actorName: "door",
		animation: color,
	}
}

for (const element of ["water", "fire", "ice", "forceFloor", "dirt"])
	artDB[`boot${element[0].toUpperCase()}${element.substr(1)}`] = {
		actorName: "boot",
		animation: element,
	}

artDB["goronBraslet"] = { actorName: "chip", animation: "bumpRight" }

artDB["tnt"] = { actorName: "tnt" }

artDB["bonusFlag"] = actor => ({
	actorName: "bonusFlag",
	animation: actor.customData,
})

artDB["secretEye"] = { actorName: "secretEye" }

artDB["railroadSign"] = { actorName: "railroadSign" }

artDB["bowlingBall"] = { actorName: "bowlingBall" }

artDB["helmet"] = { actorName: "helmet" }

artDB["timeBonus"] = { actorName: "timeBonus" }

artDB["timePenalty"] = { actorName: "timePenalty" }

artDB["timeToggle"] = { actorName: "timeToggle" }

artDB["bootSpeed"] = { actorName: "boot", animation: "speed" }
