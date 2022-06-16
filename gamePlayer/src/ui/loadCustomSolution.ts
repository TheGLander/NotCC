import { parseNCCS } from "@notcc/logic"
import { setPlayer } from "./setPlayer"

const customSolutionButton = document.querySelector<HTMLButtonElement>(
	"#customSolutionButton"
)
const solutionInput = document.createElement("input")

solutionInput.type = "file"
solutionInput.accept = ".nccs"
solutionInput.addEventListener("input", async () => {
	const files = solutionInput.files
	if (!files) return console.log("Didn't find file list")
	const file = files.item(0)
	if (!file) return console.log("Didn't find file")
	const solution = parseNCCS(await file.arrayBuffer())
	await setPlayer.restartLevel()
	setPlayer.pulseManager.level.playbackSolution(solution[0])
})

customSolutionButton?.addEventListener("click", () => solutionInput.click())
