import {
	onLevelDecisionTick,
	crossLevelData,
	createLevelFromData,
	onLevelAfterTick,
	onLevelStart,
} from "@notcc/logic"
import { Direction } from "@notcc/logic"
import "./NCCTK.less"
import { parseC2M } from "@notcc/logic"
import { actorDB, keyNameList } from "@notcc/logic"
import { artDB } from "./const"
import { parseNCCS, writeNCCS } from "@notcc/logic"
import { ScriptRunner } from "@notcc/logic"
import { Actor } from "@notcc/logic"
import { Item } from "@notcc/logic"

import "@notcc/logic"

import "./visuals"
import "./art"
import { Pager } from "./pager"
import { generateShortcutListener, generateTabButtons } from "./sidebar"

import { loadSetInfo, saveSetInfo } from "./saveData"
import { KeyListener } from "./utils"

const pager = new Pager()

generateTabButtons(pager)
new KeyListener(generateShortcutListener(pager))

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
	/* get level(): LevelState {
		return setPlayer.pulseManager.level
	}, */
	parseC2M,
	parseNCCS,
	writeNCCS,
	ScriptRunner,
	Direction,
	actorDB,
	//setPlayer,
	keyNameList,
	onLevelDecisionTick,
	onLevelAfterTick,
	onLevelStart,
	crossLevelData,
	artDB,
	createLevelFromData,
	Actor,
	Item,
	//setColorScheme,
	pager,
	loadSolution: loadSetInfo,
	saveSolution: saveSetInfo,
}

;(globalThis as any).NotCC = exportObject
