import { Pager } from "./pager"
import { makeTd } from "./utils"

const levelListDialog =
	document.querySelector<HTMLDialogElement>("#levelListDialog")!
export function openLevelListDialog(pager: Pager): void {
	const set = pager.loadedSet
	if (set === null) return
	const sortedLevels = Object.values(set.seenLevels)
		.map(record => record.levelInfo)
		.sort((a, b) => (a.levelNumber ?? 0) - (b.levelNumber ?? 0))
	const tableBody = levelListDialog.querySelector("tbody")!
	// Nuke all current data
	tableBody.textContent = ""
	for (const levelRecord of sortedLevels) {
		const row = document.createElement("tr")
		const levelN = levelRecord.levelNumber ?? 0
		row.appendChild(makeTd(levelN.toString(), "levelN"))
		row.appendChild(makeTd(levelRecord.title ?? "[An untitled level]"))
		row.addEventListener("click", async () => {
			await pager.goToLevel(levelN)
			await pager.reloadLevel()
			levelListDialog.close()
		})
		tableBody.appendChild(row)
	}
	const closeButton =
		levelListDialog.querySelector<HTMLButtonElement>(".closeButton")!
	closeButton.addEventListener("click", () => {
		levelListDialog.close()
	})
	levelListDialog.showModal()
}
