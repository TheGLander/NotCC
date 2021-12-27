import { artDB, setArtForActor } from "../const"
import { ActorArt, genericAnimatedArt, wiredTerrainArt } from "../visuals"
import { Railroad, Trap } from "../logic/actors/terrain"

artDB["floor"] = wiredTerrainArt("floor")

artDB["letterTile"] = actor => [
	{
		actorName: "floor",
		animation: "framed",
	},
	{
		actorName: "letter",
		animation: actor.customData,
		cropSize: [0.5, 0.5],
		imageOffset: [0.25, 0.25],
	},
]
artDB["customFloor"] = actor => ({
	actorName: "customFloor",
	animation: actor.customData,
})

artDB["ice"] = { actorName: "ice" }

artDB["iceCorner"] = actor => ({
	actorName: "ice",
	animation: ["ur", "dr", "dl", "ul"][actor.direction],
})

artDB["forceFloor"] = actor => ({
	actorName: "forceFloor",
	animation: ["up", "right", "down", "left"][actor.direction],
	sourceOffset:
		actor.direction % 2 === 0
			? [0, ((1 - actor.direction) * (actor.level.currentTick / 16)) % 1]
			: [((actor.direction - 2) * (actor.level.currentTick / 16)) % 1, 0],
	frame: 1.5 - Math.abs(actor.direction - 1.5),
})

artDB["forceFloorRandom"] = genericAnimatedArt("forceFloor", 8, "random")

artDB["popupWall"] = { actorName: "popupWall" }

artDB["void"] = { actorName: "exit" }

artDB["water"] = genericAnimatedArt("water", 4)

artDB["dirt"] = { actorName: "dirt" }

artDB["gravel"] = { actorName: "gravel" }

artDB["exit"] = genericAnimatedArt("exit", 4)

artDB["echipGate"] = { actorName: "echipGate" }

artDB["fire"] = genericAnimatedArt("fire", 4)

artDB["thiefTool"] = { actorName: "thief", animation: "tool" }

artDB["thiefKey"] = { actorName: "thief", animation: "key" }

setArtForActor<Trap>("trap", actor => ({
	actorName: "trap",
	animation: actor.openRequests > 0 ? "open" : "closed",
}))

artDB["cloneMachine"] = { actorName: "cloneMachine" }

artDB["bomb"] = actor => [
	{
		actorName: "bomb",
	},
	{
		actorName: "bombFuse",
		cropSize: [0.5, 0.5],
		animation: (actor.level.currentTick % 4).toString(),
		imageOffset: [0.5, 0],
	},
]

artDB["turtle"] = actor => [
	{
		actorName: "water",
		frame: actor.level.currentTick % 4,
	},
	{
		actorName: "turtle",
		frame: Math.floor(actor.level.currentTick / 3) % 3,
	},
]

artDB["greenBomb"] = actor =>
	actor.customData === "bomb"
		? [
				{
					actorName: "bombGreen",
				},
				{
					actorName: "bombFuse",
					cropSize: [0.5, 0.5],
					animation: (actor.level.currentTick % 4).toString(),
					imageOffset: [0.5, 0],
				},
		  ]
		: { actorName: "echipGreen" }

artDB["slime"] = genericAnimatedArt("slime", 8)

artDB["flameJet"] = actor => ({
	actorName: "flameJet",
	frame: actor.customData === "on" ? (actor.level.currentTick % 3) + 1 : 0,
})

artDB["hint"] = { actorName: "hint" }

artDB["transmogrifier"] = genericAnimatedArt("transmogrifier", 4)

setArtForActor<Railroad>("railroad", actor => {
	let railArt: ActorArt[] = []
	if (actor.isSwitch)
		// Add non-active tracks
		railArt = actor.baseRedirects.map(val => ({
			actorName: "railroad",
			animation: `toggleRail${val}`,
		}))
	// Add all active tracks
	railArt = actor.legalRedirects.reduce<ActorArt[]>(
		(acc, val) =>
			new Array<ActorArt>({
				actorName: "railroad",
				animation: `wood${val}`,
			}).concat(acc, [{ actorName: "railroad", animation: `rail${val}` }]),
		railArt
	)
	if (actor.isSwitch)
		railArt.push({ actorName: "railroad", animation: "toggleMark" })
	return [{ actorName: "gravel" }, ...railArt]
})
