import { LevelState } from "./level"
import { Direction } from "./helpers"
import config from "./config"
import "./base.css"
import { initPulse } from "./pulse"
import { centipede } from "./actors/enemies"
import { chip } from "./actors/playables"
import "./visuals"
import { wall } from "./actors/walls"

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
centipede.create([4, 2], Direction.UP, level)
chip.create([4, 3], Direction.DOWN, level)
wall.create([4, 4], Direction.LEFT, level)
export { level, Direction, config }

initPulse(level)
