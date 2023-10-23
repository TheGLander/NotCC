import {
	LevelData,
	LevelSet,
	LevelSetLoaderFunction,
	findScriptName,
} from "@notcc/logic"
import { levelPlayerPage } from "./pages/levelPlayer"
import { Pager } from "./pager"
import { basename, dirname } from "path-browserify"
import {
	buildFileListIndex,
	makeFileListFileLoader,
	makeLoaderWithPrefix,
} from "./fileLoaders"
import { loadSetInfo, showDirectotyPrompt } from "./saveData"
import { getNonFreeSetId } from "./pages/loading"
interface DirEntry {
	path: string
	data: string
}

export async function findEntryFilePath(
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

	if (c2gFiles.length > 1) {
		c2gFiles.sort((a, b) => a.path.length - b.path.length)

		console.warn(
			"There appear to be multiple entry script files. Picking the one with the shortest path..."
		)
	}
	if (c2gFiles.length < 1)
		throw new Error(
			"This ZIP archive doesn't contain a script. Are you sure this is the correct file?"
		)
	return c2gFiles[0].path
}

export function openLevel(pager: Pager, level: LevelData): void {
	pager.loadedLevel = level
	pager.loadedSet = null
	pager.loadedSetIdent = null
	pager.updateShownLevelNumber()
	pager.openPage(levelPlayerPage)
}
export async function loadSet(
	pager: Pager,
	loaderFunction: LevelSetLoaderFunction,
	scriptFile: string,
	noOpenPage: boolean = false
): Promise<void> {
	const filePrefix = dirname(scriptFile)
	// If the zip file has the entry script in a subdirectory instead of the zip
	// root, prefix all file paths with the entry file
	if (filePrefix !== ".") {
		loaderFunction = makeLoaderWithPrefix(filePrefix, loaderFunction)
		scriptFile = basename(scriptFile)
	}

	const scriptData = (await loaderFunction(scriptFile, false)) as string
	const scriptTitle = findScriptName(scriptData)!

	const setInfo = await loadSetInfo(scriptTitle).catch(() => null)

	let set: LevelSet

	if (setInfo !== null) {
		set = await LevelSet.constructAsync(setInfo, loaderFunction)
	} else {
		set = await LevelSet.constructAsync(scriptFile, loaderFunction)
	}

	const nonFreeSetId = getNonFreeSetId(set.scriptRunner.state.scriptTitle!)
	if (nonFreeSetId !== null) {
		pager.loadedSetIdent = nonFreeSetId
	}

	pager.loadedSet = set
	const record = await set.getCurrentRecord()
	pager.loadedLevel = record.levelData!

	// Oh, this set doesn't have levels...
	if (pager.loadedLevel === null)
		throw new Error(
			"This set doesn't have levels, or the saved set info is broken."
		)

	if (!noOpenPage) {
		pager.openPage(levelPlayerPage)
		pager.updateShownLevelNumber()
	}
}

export async function loadDirSet(): Promise<[LevelSetLoaderFunction, string]> {
	const files = await showDirectotyPrompt("Load levelset directory")
	const fileLoader = makeFileListFileLoader(files)
	const scriptPath = await findEntryFilePath(
		fileLoader,
		buildFileListIndex(files)
	)
	return [fileLoader, scriptPath]
}
