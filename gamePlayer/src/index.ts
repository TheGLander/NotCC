import {
	LevelState,
	onLevelDecisionTick,
	crossLevelData,
	createLevelFromData,
	onLevelAfterTick,
	onLevelStart,
} from "./logic/level"
import { Direction } from "./logic/helpers"
import "./base.css"
import { parseC2M } from "./logic/parsers/c2m"
import { actorDB, keyNameList } from "./logic/const"
import { parseDAT } from "./logic/parsers/dat"
import { artDB } from "./const"
import { parseNCCS, writeNCCS } from "./logic/parsers/nccs"
import { tokenizeC2G, C2GRunner } from "./logic/parsers/c2g"
import { Actor } from "./logic/actor"
import { Item } from "./logic/actors/items"
import { setPlayer } from "./ui/setPlayer"

import "./logic/actors"

import "./visuals"
import "./art"
import { setColorScheme } from "./ui"

// Enable crash handling
window.addEventListener("error", ev =>
	alert(`Yikes! Something went wrong...
Error info:
${ev.message}
at ${ev.lineno}:${ev.colno}
in ${ev.filename}
`)
)

// We export it like this so the global values are always updated
const exportObject = {
	get level(): LevelState {
		return setPlayer.pulseManager.level
	},
	parseC2M,
	parseDAT,
	parseNCCS,
	writeNCCS,
	tokenizeC2G,
	C2GRunner,
	Direction,
	actorDB,
	setPlayer,
	keyNameList,
	onLevelDecisionTick,
	onLevelAfterTick,
	onLevelStart,
	crossLevelData,
	artDB,
	createLevelFromData,
	Actor,
	Item,
	setColorScheme,
}

export default exportObject
