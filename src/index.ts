import { LevelState, createLevelFromData } from "./level"
import { Direction } from "./helpers"
import "./base.css"
import { initPulse } from "./pulse"
import "./visuals"
import { parseC2M } from "./parsers/c2m"
import "./actors/monsters"
import "./actors/walls"
import "./actors/playables"
import "./actors/blocks"
import "./actors/terrain"
// Enable crash handling
window.addEventListener("error", ev =>
	alert(`Yikes! Something went wrong...
Error info:
${ev.message}
at ${ev.lineno}:${ev.colno}
in ${ev.filename}
`)
)

let level: LevelState

export { level, Direction }

let pulseHelpers: ReturnType<typeof initPulse>

async function startNewLevel(buffer: ArrayBuffer): Promise<void> {
	const levelData = parseC2M(buffer)
	level = createLevelFromData(levelData)
	if (pulseHelpers) (await pulseHelpers).stopPulsing()
	pulseHelpers = initPulse(level)
}

;(async () => {
	const levelData = (
		await (await fetch("./data/NotCC.c2m")).body?.getReader()?.read()
	)?.value?.buffer
	if (!levelData) console.log("Couldn't fetch default level")
	else startNewLevel(levelData)
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
	const file = e.dataTransfer?.items[0]
	if (!e.dataTransfer) return console.log("Did not get a dataTransfer option")
	if (!file) return console.log("Did not get a file")
	const buffer = await file?.getAsFile()?.arrayBuffer()
	if (!buffer) return console.log("Did not get file contents")
	startNewLevel(buffer)
})
