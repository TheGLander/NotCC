import { setPlayer } from "./setPlayer"

export const levelList = document.querySelector<HTMLSelectElement>("#levelList")

levelList?.addEventListener("change", () => {
	setPlayer.currentLevelIndex = parseInt(levelList.value)
	setPlayer.restartLevel()
})
