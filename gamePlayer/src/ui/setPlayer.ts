import { LevelState } from "@notcc/logic"
import { PulseManager } from "../pulse"
import { SetPlayer } from "../setPlayer"

const renderSpace = document.querySelector<HTMLCanvasElement>(
	"#viewportCanvas"
) as HTMLCanvasElement
const itemSpace =
	document.querySelector<HTMLCanvasElement>("#itemCanvas") ?? undefined
const textStats =
	document.querySelector<HTMLTextAreaElement>("#textStats") ?? undefined

renderSpace.style.display = "unset"

export const setPlayer = new SetPlayer(
	new PulseManager(new LevelState(1, 1), renderSpace, itemSpace, textStats),
	{ name: "LOADING", levels: {} }
)
