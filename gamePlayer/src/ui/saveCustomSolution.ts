import { crossLevelData, Direction, SolutionData, writeNCCS } from "../logic"
import { setPlayer } from "./setPlayer"

const downloadSolutionButton = document.querySelector<HTMLButtonElement>(
	"#downloadSolutionButton"
)

let lastWinningSolution: SolutionData | undefined,
	lastSolutionRFF: Direction | undefined,
	lastSolutionBlobMod: number | undefined

setPlayer.pulseManager.eventsRegistered.win.push(() => {
	lastWinningSolution = {
		steps: [setPlayer.pulseManager.recordedSteps],
		rffDirection: lastSolutionRFF,
		blobModSeed: lastSolutionBlobMod,
		expectedOutcome: { timeLeft: setPlayer.pulseManager.level.timeLeft },
	}
	if (downloadSolutionButton) downloadSolutionButton.style.display = "unset"
})

setPlayer.pulseManager.eventsRegistered.newLevel.push(() => {
	lastSolutionBlobMod = setPlayer.pulseManager.level.blobPrngValue
	lastSolutionRFF = crossLevelData.RFFDirection
})

function downloadFile(buff: ArrayBuffer): void {
	const blob = new Blob([buff], { type: "application/octet-stream" })
	const url = URL.createObjectURL(blob)
	const a = document.createElement("a")
	a.style.display = "none"
	a.download = "solution.nccs"
	a.href = url
	a.click()
	URL.revokeObjectURL(url)
	a.remove()
}

downloadSolutionButton?.addEventListener("click", () => {
	if (lastWinningSolution) downloadFile(writeNCCS([lastWinningSolution]))
})
