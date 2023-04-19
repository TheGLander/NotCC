import {
	LevelData,
	LevelSet,
	LevelSetLoaderFunction,
	findScriptName,
	parseC2M,
} from "@notcc/logic"
import { Pager } from "../pager"
import stubLevel from "../data/NotCC.c2m"
import { levelPlayerPage } from "./levelPlayer"
import {
	buildFileListIndex,
	buildZipIndex,
	makeFileListFileLoader,
	makeLoaderWithPrefix,
	makeZipFileLoader,
} from "../fileLoaders"
import { basename, dirname } from "path-browserify"
import { loadSetInfo } from "../saveData"

interface DirEntry {
	path: string
	data: string
}

async function findEntryFilePath(
	loaderFunction: LevelSetLoaderFunction,
	fileIndex: string[]
): Promise<string> {
	// Use `loaderFunction` and `rootIndex` to figure out which files are entry
	// scripts (have the header closed string)
	const c2gFileNames = fileIndex.filter(path => path.endsWith(".c2g"))
	const c2gDirEntPromises = c2gFileNames.map<Promise<DirEntry>>(async path => {
		const scriptData = (await loaderFunction(path, false)) as string
		return { path, data: scriptData }
	})
	const maybeC2gFiles = await Promise.all(c2gDirEntPromises)
	const c2gFiles = maybeC2gFiles.filter(
		ent => findScriptName(ent.data) !== null
	)

	if (c2gFiles.length > 1)
		throw new Error(
			"There are too many entry C2G files. Only one script may have a closed string on it's first line."
		)
	if (c2gFiles.length < 1)
		throw new Error(
			"This ZIP archive doesn't contain a script. Are you sure this is the correct file?"
		)
	return c2gFiles[0].path
}

export const setSelectorPage = {
	pageId: "setSelectorPage",
	openLevel(pager: Pager, level: LevelData): void {
		pager.loadedLevel = level
		pager.loadedSet = null
		pager.updateShownLevelNumber()
		pager.openPage(levelPlayerPage)
	},
	async loadStubLevel(pager: Pager): Promise<void> {
		const levelBin = await (await fetch(stubLevel)).arrayBuffer()
		const level = parseC2M(levelBin, "NotCC.c2m")
		this.openLevel(pager, level)
	},
	async loadSet(
		pager: Pager,
		loaderFunction: LevelSetLoaderFunction,
		fileIndex: string[]
	): Promise<void> {
		let filePath = await findEntryFilePath(loaderFunction, fileIndex)
		const filePrefix = dirname(filePath)
		// If the zip file has the entry script in a subdirectory instead of the zip
		// root, prefix all file paths with the entry file
		if (filePrefix !== "") {
			loaderFunction = makeLoaderWithPrefix(filePrefix, loaderFunction)
			filePath = basename(filePath)
		}

		const fileData = (await loaderFunction(filePath, false)) as string
		const scriptTitle = findScriptName(fileData)!

		const setInfo = await loadSetInfo(scriptTitle).catch(() => null)

		let set: LevelSet

		if (setInfo !== null) {
			set = await LevelSet.constructAsync(setInfo, loaderFunction)
		} else {
			set = await LevelSet.constructAsync(filePath, loaderFunction)
		}

		pager.loadedSet = set
		// Open the first level
		pager.loadedLevel = null
		await pager.loadNextLevel({ type: "skip" })
		// Oh, this set doesn't have levels...
		if (pager.loadedLevel === null)
			throw new Error(
				"This set doesn't have levels, or the saved set info is broken."
			)

		pager.openPage(levelPlayerPage)
	},

	loadZip(pager: Pager, data: Uint8Array): Promise<void> {
		const filePaths = buildZipIndex(data)
		return this.loadSet(pager, makeZipFileLoader(data), filePaths)
	},
	async loadFile(
		pager: Pager,
		fileData: ArrayBuffer,
		fileName: string
	): Promise<void> {
		const magicString = Array.from(new Uint8Array(fileData).slice(0, 4), num =>
			String.fromCharCode(num)
		).join("")
		// File types which aren't accepted by the file input (DATs, raw C2Ms) are
		// here so that the Drag 'n Drop loader can use this.
		if (magicString === "CC2M") {
			const level = parseC2M(fileData, fileName)
			this.openLevel(pager, level)
			return
		} else if (
			// ZIP
			magicString === "PK\u{3}\u{4}"
		) {
			await this.loadZip(pager, new Uint8Array(fileData))
			return
		} else if (
			// DAT
			magicString === "\xAC\xAA\x02\x00" ||
			magicString === "\xAC\xAA\x02\x01" ||
			magicString === "\xAC\xAA\x03\x00" ||
			magicString === "\xAC\xAA\x03\x01"
		) {
			// TODO Proper prompts
			alert("DAT files aren't supported, for now.")
			return
		} else {
			const decoder = new TextDecoder("iso-8859-1")
			const fileText: string = decoder.decode(fileData)

			if (
				// Explain how to use C2Gs
				findScriptName(fileText) !== null
			) {
				alert("You need to load the whole set, not just the C2G file.")
				return
			}
		}
	},
	setupPage(pager: Pager, page: HTMLElement): void {
		const loadDefaultLevelButton =
			page.querySelector<HTMLButtonElement>("#loadDefaultLevel")!
		loadDefaultLevelButton.addEventListener("click", () => {
			this.loadStubLevel(pager)
		})
		const loadFileButton = page.querySelector<HTMLButtonElement>("#loadFile")!
		const fileLoader = page.querySelector<HTMLInputElement>("#fileLoader")!
		fileLoader.value = ""
		fileLoader.addEventListener("change", async () => {
			// There should ever be one file here
			const file = fileLoader.files?.[0]
			if (!file) return
			const arrayBuffer = await file.arrayBuffer()
			this.loadFile(pager, arrayBuffer, file.name)
			fileLoader.value = ""
		})
		loadFileButton.addEventListener("click", () => {
			fileLoader.click()
		})
		const loadDirectoryButton =
			page.querySelector<HTMLButtonElement>("#loadDirectory")!
		const directoryLoader =
			page.querySelector<HTMLInputElement>("#directoryLoader")!
		directoryLoader.value = ""
		directoryLoader.addEventListener("change", async () => {
			if (!directoryLoader.files) return
			const fileLoader = makeFileListFileLoader(directoryLoader.files)
			this.loadSet(pager, fileLoader, buildFileListIndex(directoryLoader.files))
			directoryLoader.value = ""
		})
		loadDirectoryButton.addEventListener("click", () => {
			directoryLoader.click()
		})
	},
}
