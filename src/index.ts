import { LevelState, createLevelFromData } from "./level"
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
import { actorDB, keyNameList } from "./const"
import { parseDAT } from "./parsers/dat"
// Enable crash handling
window.addEventListener("error", ev =>
	alert(`Yikes! Something went wrong...
Error info:
${ev.message}
at ${ev.lineno}:${ev.colno}
in ${ev.filename}
`)
)

let level = new LevelState(0, 0)

const renderSpace = document.querySelector<HTMLElement>("#renderSpace")
const itemSpace = document.querySelector<HTMLElement>("#renderSpace")
const textStats = document.querySelector<HTMLElement>("#textStats")

const pulseManager = new PulseManager(level, renderSpace, itemSpace, textStats)

pulseManager.eventsRegistered.stateChange.push(() => {
	if (level.levelData)
		pulseManager.setNewLevel(
			(exportObject.level = level = createLevelFromData(level.levelData))
		)
})

// We export it like this so the global values are always updated
// TODO Have the level code be unrelated to the game instance
const exportObject = { level, Direction, actorDB, pulseManager, keyNameList }

export default exportObject

async function startNewLevel(
	buffer: ArrayBuffer,
	filename: string
): Promise<void> {
	await pulseManager.ready
	const levelData = filename.endsWith(".c2m")
		? parseC2M(buffer)
		: parseDAT(buffer, filename).levels[1]
	level = createLevelFromData(levelData)
	exportObject.level = level
	pulseManager.setNewLevel(level)
}

;(async () => {
	const levelData = (
		await (await fetch("./data/NotCC.c2m")).body?.getReader()?.read()
	)?.value?.buffer
	if (!levelData) console.log("Couldn't fetch default level")
	else startNewLevel(levelData, "NotCC.c2m")
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
	startNewLevel(buffer, file.name)
})
