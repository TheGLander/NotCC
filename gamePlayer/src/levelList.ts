import { findBestMetrics } from "@notcc/logic"
import { Pager } from "./pager"
import { formatSubticks, makeTd } from "./utils"

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
		const metrics = findBestMetrics(levelRecord)
		row.appendChild(makeTd(levelN.toString(), "levelN"))
		row.appendChild(makeTd(levelRecord.title ?? "[An untitled level]"))
		row.appendChild(
			makeTd(
				metrics.timeLeft === undefined ? "-" : Math.ceil(metrics.timeLeft) + "s"
			)
		)
		row.appendChild(
			makeTd(metrics.points === undefined ? "-" : metrics.points.toString())
		)
		row.addEventListener("click", async () => {
			await pager.goToLevel(levelN)
			await pager.reloadLevel()
			levelListDialog.close()
		})
		row.tabIndex = 0
		tableBody.appendChild(row)
	}
	const closeButton =
		levelListDialog.querySelector<HTMLButtonElement>(".closeButton")!
	closeButton.addEventListener("click", () => {
		levelListDialog.close()
	})
	levelListDialog.showModal()
}
