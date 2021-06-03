import {
	LevelState,
	onLevelDecisionTick,
	crossLevelData,
	createLevelFromData,
	onLevelAfterTick,
	onLevelStart,
} from "./logic/level"
import { Direction } from "./logic/helpers"
import "./base.css"
import { PulseManager } from "./pulse"
import "./visuals"
import { parseC2M } from "./logic/parsers/c2m"
import "./logic/actors"
import "./art"
import { actorDB, keyNameList } from "./logic/const"
import { parseDAT } from "./logic/parsers/dat"
import { levelAsSet, SolutionData } from "./logic/encoder"
import { SetPlayer } from "./setPlayer"
import { artDB } from "./const"
import { parseNCCS, writeNCCS } from "./logic/parsers/nccs"
import { tokenizeC2G, C2GRunner } from "./logic/parsers/c2g"

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

// Enable crash handling
window.addEventListener("error", ev =>
	alert(`Yikes! Something went wrong...
Error info:
${ev.message}
at ${ev.lineno}:${ev.colno}
in ${ev.filename}
`)
)

const renderSpace = document.querySelector<HTMLElement>("#renderSpace")
const itemSpace = document.querySelector<HTMLElement>("#itemSpace")
const textStats = document.querySelector<HTMLTextAreaElement>("#textStats")
const levelInputButton =
	document.querySelector<HTMLElement>("#levelInputButton")
const levelList = document.querySelector<HTMLSelectElement>("#levelList")
const levelReplayButton = document.querySelector<HTMLButtonElement>(
	"#levelSolutionButton"
)
const levelInput = document.createElement("input")
const downloadSolutionButton = document.querySelector<HTMLButtonElement>(
	"#downloadSolutionButton"
)
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

const setPlayer = new SetPlayer(
	new PulseManager(new LevelState(0, 0), renderSpace, itemSpace, textStats),
	{ name: "LOADING", levels: {} }
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

downloadSolutionButton?.addEventListener("click", () => {
	if (lastWinningSolution) downloadFile(writeNCCS([lastWinningSolution]))
})

levelList?.addEventListener("change", () => {
	setPlayer.currentLevelIndex = parseInt(levelList.value)
	setPlayer.restartLevel()
})

// We export it like this so the global values are always updated
const exportObject = {
	get level(): LevelState {
		return setPlayer.pulseManager.level
	},
	parseC2M,
	parseDAT,
	parseNCCS,
	writeNCCS,
	tokenizeC2G,
	C2GRunner,
	Direction,
	actorDB,
	setPlayer,
	keyNameList,
	onLevelDecisionTick,
	onLevelAfterTick,
	onLevelStart,
	crossLevelData,
	artDB,
	createLevelFromData,
}

export default exportObject

async function startNewLevelSet(
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

// Kinda like new TextEncoder().encode, but without UTF-8 in mind
// BTW, I didn't know that ArrayConstructor.from could be used like this, thanks eevee!
function decodeRawStringToArrayBuffer(str: string): ArrayBuffer {
	return Uint8Array.from(str, char => char.codePointAt(0) ?? 0).buffer
}

;(async () => {
	let customLevelLoaded = false
	try {
		const params = new URLSearchParams(location.search)
		const levelData = params.get("level")

		if (levelData) {
			await startNewLevelSet(
				decodeRawStringToArrayBuffer(
					// This is some weird "bae64 url safe" data
					atob(levelData.replace(/_/g, "/").replace(/-/g, "+"))
				),
				"unknown.c2m"
			)
			customLevelLoaded = true
		}
	} catch (err) {
		console.error("Encountered an error while loading the level")
		console.error(err)
	}
	if (!customLevelLoaded)
		(async () => {
			const levelData = (
				await (await fetch("./data/NotCC.c2m")).body?.getReader()?.read()
			)?.value?.buffer
			if (!levelData) console.log("Couldn't fetch default level")
			else startNewLevelSet(levelData, "NotCC.c2m")
		})()
})()

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
