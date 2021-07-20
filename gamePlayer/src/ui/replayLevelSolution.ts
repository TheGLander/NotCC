import { setPlayer } from "./setPlayer"

const levelReplayButton = document.querySelector<HTMLButtonElement>(
	"#levelSolutionButton"
)

setPlayer.pulseManager.eventsRegistered.newLevel.push(() => {
	if (levelReplayButton)
		levelReplayButton.style.display = setPlayer.sortedLevels[
			setPlayer.currentLevelIndex
		]?.[1].associatedSolution
			? "unset"
			: "none"
})

levelReplayButton?.addEventListener("click", () => {
	setPlayer.playLevelSolution()
})
