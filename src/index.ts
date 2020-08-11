import { LevelState } from "./level"
import { Direction } from "./helpers"
import "./base.css"
import { initPulse } from "./pulse"
import { centipede, spider } from "./actors/enemies"
import { chip } from "./actors/playables"
import "./visuals"
import { wall } from "./actors/walls"
import { forceFloor } from "./actors/miscStatic"

// Enable crash handling
window.addEventListener("error", ev => {
	alert(`Yikes! Something went wrong...
Error info:
${ev.message}
at ${ev.lineno}:${ev.colno}
in ${ev.filename}
`)
})

const level = new LevelState(5, 5)
centipede.create([1, 1], Direction.UP, level)
forceFloor.create([0, 0], Direction.LEFT, level)
centipede.create([3, 0], Direction.LEFT, level)
spider.create([4, 1], Direction.DOWN, level)
chip.create([4, 3], Direction.DOWN, level)
wall.create([4, 4], Direction.LEFT, level)
export { level, Direction }

initPulse(level, {
	tickPulseModulo: 3,
	framePulseModulo: 1,
	pulsesPerSecond: 60,
	debugMode: location.href.includes("localhost"),
})
