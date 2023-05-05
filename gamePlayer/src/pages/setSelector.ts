import { findScriptName, parseC2M } from "@notcc/logic"
import { Pager } from "../pager"
import stubLevel from "../levels/NotCC.c2m"
import {
	buildFileListIndex,
	buildZipIndex,
	makeFileListFileLoader,
	makeZipFileLoader,
} from "../fileLoaders"
import { loadSet, openLevel } from "../levelLoading"

export const setSelectorPage = {
	pageId: "setSelectorPage",

	async loadStubLevel(pager: Pager): Promise<void> {
		const levelBin = await (await fetch(stubLevel)).arrayBuffer()
		const level = parseC2M(levelBin, "NotCC.c2m")
		openLevel(pager, level)
	},

	loadZip(pager: Pager, data: Uint8Array): Promise<void> {
		const filePaths = buildZipIndex(data)
		return loadSet(pager, makeZipFileLoader(data), filePaths)
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
			openLevel(pager, level)
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
			loadSet(pager, fileLoader, buildFileListIndex(directoryLoader.files))
			directoryLoader.value = ""
		})
		loadDirectoryButton.addEventListener("click", () => {
			directoryLoader.click()
		})
	},
	open(pager: Pager): void {
		pager.loadedLevel = null
		pager.loadedSet = null
		pager.updateShownLevelNumber()
	},
}
