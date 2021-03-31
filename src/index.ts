import { LevelState } from "./level"
import { Direction } from "./helpers"
import "./base.css"
import { initPulse } from "./pulse"
import "./visuals"
import "./parsers/c2m"
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

const level = new LevelState(15, 15)

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

initPulse(level)
