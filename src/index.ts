import { LevelState } from "./level"
import { Direction } from "./helpers"
import "./base.css"
import { initPulse } from "./pulse"
import "./visuals"
import "./parsers/c2m"
import { Centipede } from "./actors/monsters"
import { Wall } from "./actors/walls"
import { Playable } from "./actors/playables"
// Enable crash handling
window.addEventListener("error", ev =>
	alert(`Yikes! Something went wrong...
Error info:
${ev.message}
at ${ev.lineno}:${ev.colno}
in ${ev.filename}
`)
)

const level = new LevelState(5, 5)

new Centipede(level, Direction.UP, [1, 1])
new Wall(level, Direction.UP, [2, 1])
new Wall(level, Direction.UP, [2, 2])
new Playable(level, Direction.UP, [0, 0])
export { level, Direction }

initPulse(level)
