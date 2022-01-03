import { parseC2M } from "../logic/parsers/c2m"
import { parseDAT } from "../logic/parsers/dat"
import { levelAsSet, LevelSetData } from "../logic/encoder"
import { levelList } from "./levelList"
import { setPlayer } from "./setPlayer"
import { unzip, Unzipped, UnzipOptions } from "fflate"

function decompresssActuallyAsync(
	buffer: ArrayBuffer,
	options: UnzipOptions = {}
): Promise<Unzipped> {
	return new Promise((res, rej) =>
		unzip(new Uint8Array(buffer), options, (err, data) => {
			if (err) rej(err)
			else res(data)
		})
	)
}

export async function startNewLevelSet(
	buffer: ArrayBuffer,
	filename: string
): Promise<void> {
	await setPlayer.ready
	// TIL Emojis (eg. ✨) aren't legal JS variable names
	const magicValue = new DataView(buffer).getUint32(0)
	let levelData: LevelSetData
	switch (magicValue) {
		case 0x4343324d:
			levelData = levelAsSet(parseC2M(buffer, filename))
			break
		case 0xacaa0200:
		case 0xacaa0201:
		case 0xacaa0300:
			levelData = parseDAT(buffer, filename)
			break
		case 0x504b0304:
			// TODO Handle C2Gs in this thing
			const unzipValue = await decompresssActuallyAsync(buffer, {
				filter(file) {
					return file.name.endsWith(".c2m")
				},
			})
			levelData = { name: filename, levels: {} }
			let n = 1
			for (const fileName of Object.keys(unzipValue)) {
				const level = parseC2M(unzipValue[fileName].buffer, fileName)
				levelData.levels[n] = level
				n++
			}
			break
		default:
			throw new Error("Pls give good file format")
	}
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
levelInput.accept = ".c2m,.dat,.ccl,.zip"
levelInput.addEventListener("input", async () => {
	const files = levelInput.files
	if (!files) return console.log("Didn't find file list")
	const file = files.item(0)
	if (!file) return console.log("Didn't find file")
	startNewLevelSet(await file.arrayBuffer(), file.name)
})

levelInputButton?.addEventListener("click", () => levelInput.click())
