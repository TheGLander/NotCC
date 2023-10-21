import {
	onLevelDecisionTick,
	createLevelFromData,
	onLevelAfterTick,
	onLevelStart,
} from "@notcc/logic"
import { Direction } from "@notcc/logic"
import { parseC2M } from "@notcc/logic"
import { actorDB, keyNameList } from "@notcc/logic"
import { parseNCCS, writeNCCS } from "@notcc/logic"
import { ScriptRunner } from "@notcc/logic"
import { Actor } from "@notcc/logic"
import { Item } from "@notcc/logic"

import "@notcc/logic"

import { Pager } from "./pager"
import { generateShortcutListener, generateTabButtons } from "./sidebar"

import { loadSetInfo, saveSetInfo } from "./saveData"
import { KeyListener } from "./utils"
import { openTilesetSelectortDialog } from "./tilesets"
import { showAlert } from "./simpleDialogs"
import { openNotccUrl } from "./pages/loading"

import "dialog-polyfill/dialog-polyfill.css"
import dialogPolyfill from "dialog-polyfill"

for (const dialog of Array.from(document.querySelectorAll("dialog"))) {
	dialogPolyfill.registerDialog(dialog)
}

import "./NCCTK.less"

const pager = new Pager()

window.addEventListener("popstate", () => {
	openNotccUrl(pager)
})

generateTabButtons(pager)
new KeyListener(generateShortcutListener(pager))

function errorHandler(ev: ErrorEvent | PromiseRejectionEvent) {
	let errorInfoText: string
	if (ev instanceof ErrorEvent) {
		errorInfoText = `${ev.message}
at ${ev.lineno}:${ev.colno}
in ${ev.filename}`
	} else {
		errorInfoText = `Promise rejected! Reason: ${ev.reason}`
	}

	showAlert(`Yikes! Something went wrong...
Error info: ${errorInfoText}`)
}

window.addEventListener("error", errorHandler)
window.addEventListener("unhandledrejection", errorHandler)

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
	createLevelFromData,
	Actor,
	Item,
	//setColorScheme,
	pager,
	loadSolution: loadSetInfo,
	saveSolution: saveSetInfo,
	openTilesetSelectortDialog,
}

;(globalThis as any).NotCC = exportObject
