import { LevelState, createLevelFromData } from "./level"
import { Direction } from "./helpers"
import "./base.css"
import { initPulse } from "./pulse"
import "./visuals"
import { parseC2M } from "./parsers/c2m"
import { Centipede } from "./actors/monsters"
import { Wall } from "./actors/walls"
import { Playable } from "./actors/playables"
import { DirtBlock } from "./actors/blocks"
import { Ice, ForceFloor } from "./actors/terrain"
// Enable crash handling
window.addEventListener("error", ev =>
	alert(`Yikes! Something went wrong...
Error info:
${ev.message}
at ${ev.lineno}:${ev.colno}
in ${ev.filename}
`)
)

let level = new LevelState(15, 15)

new Centipede(level, Direction.UP, [1, 1])
new Wall(level, Direction.UP, [2, 1])
new Wall(level, Direction.UP, [2, 2])
new DirtBlock(level, Direction.UP, [2, 3])
new Playable(level, Direction.UP, [0, 0])

new Ice(level, Direction.UP, [5, 5])
new Ice(level, Direction.UP, [5, 6])
new Ice(level, Direction.UP, [6, 5])
new Ice(level, Direction.UP, [6, 6])
new Wall(level, Direction.UP, [5, 4])

new ForceFloor(level, Direction.RIGHT, [7, 7])
new ForceFloor(level, Direction.DOWN, [8, 7])
new ForceFloor(level, Direction.DOWN, [8, 8])
new Wall(level, Direction.DOWN, [8, 9])
new ForceFloor(level, Direction.UP, [7, 8])

export { level, Direction }

let pulseHelpers = initPulse(level)

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
	const levelData = parseC2M(buffer)
	level = createLevelFromData(levelData)
	;(await pulseHelpers).stopPulsing()
	pulseHelpers = initPulse(level)
})
