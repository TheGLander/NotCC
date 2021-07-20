import { LevelState } from "../logic"
import { PulseManager } from "../pulse"
import { SetPlayer } from "../setPlayer"

const renderSpace = document.querySelector<HTMLElement>("#renderSpace")
const itemSpace = document.querySelector<HTMLElement>("#itemSpace")
const textStats = document.querySelector<HTMLTextAreaElement>("#textStats")

export const setPlayer = new SetPlayer(
	new PulseManager(new LevelState(0, 0), renderSpace, itemSpace, textStats),
	{ name: "LOADING", levels: {} }
)
