import {
	LevelState,
	createLevelFromData,
	onLevelDecisionTick,
	crossLevelData,
} from "./level"
import { Direction } from "./helpers"
import "./base.css"
import { PulseManager } from "./pulse"
import "./visuals"
import { parseC2M } from "./parsers/c2m"
import "./actors/monsters"
import "./actors/walls"
import "./actors/playables"
import "./actors/blocks"
import "./actors/terrain"
import "./actors/animation"
import "./actors/teleport"
import "./actors/items"
import "./actors/buttons"
import "./actors/itemMods"
import { actorDB, keyNameList } from "./const"
import { parseDAT } from "./parsers/dat"
import { levelAsSet } from "./encoder"
import { SetPlayer } from "./setPlayer"
// Enable crash handling
window.addEventListener("error", ev =>
	alert(`Yikes! Something went wrong...
Error info:
${ev.message}
at ${ev.lineno}:${ev.colno}
in ${ev.filename}
`)
)

const renderSpace = document.querySelector<HTMLElement>("#renderSpace")
const itemSpace = document.querySelector<HTMLElement>("#renderSpace")
const textStats = document.querySelector<HTMLElement>("#textStats")
const levelInputButton = document.querySelector<HTMLElement>(
	"#levelInputButton"
)
const levelList = document.querySelector<HTMLSelectElement>("#levelList")
const levelInput = document.createElement("input")
levelInput.type = "file"
levelInput.accept = ".c2m,.dat,.ccl"
levelInput.addEventListener("input", async () => {
	const files = levelInput.files
	if (!files) return console.log("Didn't find file list")
	const file = files.item(0)
	if (!file) return console.log("Didn't find file")
	startNewLevelSet(await file.arrayBuffer(), file.name)
})

levelInputButton?.addEventListener("click", () => levelInput.click())

const setPlayer = new SetPlayer(
	new PulseManager(new LevelState(0, 0), renderSpace, itemSpace, textStats),
	{ name: "LOADING", levels: {} }
)

levelList?.addEventListener("change", () => {
	setPlayer.currentLevelIndex = parseInt(levelList.value)
	setPlayer.restartLevel()
})

// We export it like this so the global values are always updated
// TODO Have the level code be unrelated to the game instance
const exportObject = {
	get level(): LevelState {
		return setPlayer.pulseManager.level
	},
	Direction,
	actorDB,
	setPlayer,
	keyNameList,
	onLevelDecisionTick,
	crossLevelData,
}

export default exportObject

async function startNewLevelSet(
	buffer: ArrayBuffer,
	filename: string
): Promise<void> {
	await setPlayer.ready
	const levelData = filename.endsWith(".c2m")
		? levelAsSet(parseC2M(buffer))
		: parseDAT(buffer, filename)
	setPlayer.setNewLevelSet(levelData)
	setPlayer.restartLevel()
	if (levelList) {
		levelList.innerText = ""
		for (const levelId in setPlayer.sortedLevels) {
			const level = setPlayer.sortedLevels[levelId]
			const option = document.createElement("option")
			option.value = levelId
			option.innerText = `${level[0]}: ${level[1].name ?? "UNNAMED"}`
			levelList.appendChild(option)
		}
	}
}

;(async () => {
	const levelData = (
		await (await fetch("./data/NotCC.c2m")).body?.getReader()?.read()
	)?.value?.buffer
	if (!levelData) console.log("Couldn't fetch default level")
	else startNewLevelSet(levelData, "NotCC.c2m")
})()

document.addEventListener("dragover", e => {
	e.stopPropagation()
	e.preventDefault()
	if (e.dataTransfer) e.dataTransfer.dropEffect = "copy"
})

// Get file data on drop
document.addEventListener("drop", async e => {
	e.stopPropagation()
	e.preventDefault()
	if (!e.dataTransfer) return console.log("Did not get a dataTransfer option")
	const transferable = e.dataTransfer?.items[0]
	if (!transferable) return console.log("Did not get a transferable")
	const file = transferable.getAsFile()
	if (!file) return console.log("Did not get a file")
	const buffer = await file.arrayBuffer()
	if (!buffer) return console.log("Did not get file contents")
	startNewLevelSet(buffer, file.name)
})
