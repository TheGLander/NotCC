import { LevelSet } from "@notcc/logic"

const levelListDialog =
	document.querySelector<HTMLDialogElement>("#levelListDialog")!

function makeTd(contents: string, className?: string): HTMLTableCellElement {
	const td = document.createElement("td")
	td.textContent = contents
	if (className !== undefined) {
		td.className = className
	}
	return td
}

export function openLevelListDialog(set: LevelSet): void {
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
		tableBody.appendChild(row)
	}
	const closeButton =
		levelListDialog.querySelector<HTMLButtonElement>(".closeButton")!
	closeButton.addEventListener("click", () => {
		levelListDialog.close()
	})
	levelListDialog.showModal()
}
