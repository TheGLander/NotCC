import { artDB } from "../const"
import { genericAnimatedArt, genericWiredTerrainArt } from "../visuals"

artDB["teleportBlue"] = genericWiredTerrainArt("teleportBlue", "default", 4)
const redTPAnimation = genericWiredTerrainArt("teleportRed", "default", 4)
const redTPIdle = genericWiredTerrainArt("teleportRed")
artDB["teleportRed"] = actor =>
	actor.wired && !actor.poweredWires ? redTPIdle(actor) : redTPAnimation(actor)

artDB["teleportGreen"] = genericAnimatedArt("teleportGreen", 4)
artDB["teleportYellow"] = genericAnimatedArt("teleportYellow", 4)
