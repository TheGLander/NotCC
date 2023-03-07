import {
	LevelState,
	onLevelDecisionTick,
	crossLevelData,
	createLevelFromData,
	onLevelAfterTick,
	onLevelStart,
} from "@notcc/logic"
import { Direction } from "@notcc/logic"
import "./base.css"
import { parseC2M } from "@notcc/logic"
import { actorDB, keyNameList } from "@notcc/logic"
import { parseDAT } from "@notcc/logic"
import { artDB } from "./const"
import { parseNCCS, writeNCCS } from "@notcc/logic"
import { tokenizeC2G, C2GRunner } from "@notcc/logic"
import { Actor } from "@notcc/logic"
import { Item } from "@notcc/logic"
import { setPlayer } from "./ui/setPlayer"

import "@notcc/logic"

import "./visuals"
import "./art"
import { setColorScheme } from "./ui"

import "./base.css"

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
