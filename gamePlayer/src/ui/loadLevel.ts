import { levelAsSet, parseC2M, parseDAT } from "../logic"
import { levelList } from "./levelList"
import { setPlayer } from "./setPlayer"

export async function startNewLevelSet(
	buffer: ArrayBuffer,
	filename: string
): Promise<void> {
	await setPlayer.ready
	const levelData = filename.toLowerCase().endsWith(".c2m")
		? levelAsSet(parseC2M(buffer, filename))
		: parseDAT(buffer, filename)
	setPlayer.setNewLevelSet(levelData)
	setPlayer.restartLevel()
	if (levelList) {
		levelList.innerText = ""
		for (const levelId in setPlayer.sortedLevels) {
			const level = setPlayer.sortedLevels[levelId]
			const option = document.createElement("option")
			option.value = levelId
			option.innerText = `${level[0]}: ${level[1].name ?? "UNNAMED"}`
			levelList.appendChild(option)
		}
	}
}

document.addEventListener("dragover", e => {
	e.stopPropagation()
	e.preventDefault()
	if (e.dataTransfer) e.dataTransfer.dropEffect = "copy"
})

// Get file data on drop
document.addEventListener("drop", async e => {
	e.stopPropagation()
	e.preventDefault()
	if (!e.dataTransfer) return console.log("Did not get a dataTransfer option")
	const transferable = e.dataTransfer?.items[0]
	if (!transferable) return console.log("Did not get a transferable")
	const file = transferable.getAsFile()
	if (!file) return console.log("Did not get a file")
	const buffer = await file.arrayBuffer()
	if (!buffer) return console.log("Did not get file contents")
	startNewLevelSet(buffer, file.name)
})

const levelInput = document.createElement("input")
const levelInputButton =
	document.querySelector<HTMLElement>("#levelInputButton")

levelInput.type = "file"
levelInput.accept = ".c2m,.dat,.ccl"
levelInput.addEventListener("input", async () => {
	const files = levelInput.files
	if (!files) return console.log("Didn't find file list")
	const file = files.item(0)
	if (!file) return console.log("Didn't find file")
	startNewLevelSet(await file.arrayBuffer(), file.name)
})

levelInputButton?.addEventListener("click", () => levelInput.click())
