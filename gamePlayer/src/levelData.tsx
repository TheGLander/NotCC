import { Getter, Setter, atom, useAtomValue, useSetAtom } from "jotai"
import {
	LevelData,
	LevelSet,
	findScriptName,
	parseC2M,
	parseNCCS,
	writeNCCS,
} from "@notcc/logic"
import {
	CUSTOM_LEVEL_SET_IDENT,
	CUSTOM_SET_SET_IDENT,
	levelNAtom,
	levelSetIdentAtom,
	pageAtom,
	pageNameAtom,
	preventImmediateHashUpdateAtom,
	searchParamsAtom,
} from "./routing"
import { loadable, unwrap } from "jotai/utils"
import { Dialog } from "./components/Dialog"
import { useRef } from "preact/hooks"
import { PromptComponent, hidePrompt, showPrompt } from "./prompts"
import { decodeBase64, showLoadPrompt, unzlibAsync } from "./helpers"
import {
	IMPORTANT_SETS,
	LevelSetData,
	makeLoaderWithPrefix,
	makeSetDataFromFiles,
} from "./setLoading"
import { basename, dirname } from "path-browserify"
import { readFile, writeFile } from "./fs"
import { atomEffect } from "jotai-effect"

export const levelAtom = atom<LevelData | Promise<LevelData> | null>(null)
export const levelUnwrappedAtom = unwrap(levelAtom)

const levelLoadableAtom = loadable(levelAtom)
export function useSwrLevel(): LevelData | null {
	const levelState = useAtomValue(levelLoadableAtom)
	const lastLevel = useRef<LevelData | null>(null)
	if (levelState.state === "hasError") return null
	if (levelState.state === "hasData") {
		lastLevel.current = levelState.data
	}
	return lastLevel.current
}

const levelSetAtomWrapped = atom<LevelSet | Promise<LevelSet> | null>(null)
export const levelSetAtom = unwrap(levelSetAtomWrapped)

export async function borrowLevelSetGs(
	get: Getter,
	set: Setter,
	func: (set: LevelSet) => void | Promise<void>
) {
	const lset = get(levelSetAtom)!
	await func(lset)
	set(levelSetAtom, lset)
}

export async function goToLevelN(get: Getter, set: Setter) {
	const levelN = get(levelNAtom)
	if (levelN === null) return
	await borrowLevelSetGs(get, set, async lSet => {
		const rec = await lSet.goToLevel(levelN)
		await lSet.verifyLevelDataAvailability(levelN)
		set(levelAtom, rec.levelData!)
	})
}

export async function goToNextLevel(get: Getter, set: Setter) {
	await borrowLevelSetGs(get, set, async lSet => {
		lSet.lastLevelResult = { type: "skip" }
		const rec = await lSet.getNextRecord()
		if (lSet.inPostGame) {
			// TODO display this somehow, like in classic NotCC or LL
			await lSet.getPreviousRecord()
			return
		}
		if (!rec) return
		set(levelAtom, rec?.levelData!)
		set(levelNAtom, rec?.levelInfo.levelNumber!)
	})
}

export async function goToPreviousLevel(get: Getter, set: Setter) {
	await borrowLevelSetGs(get, set, async lSet => {
		const rec = await lSet.getPreviousRecord()
		if (!rec) return
		set(levelAtom, rec?.levelData!)
		set(levelNAtom, rec?.levelInfo.levelNumber!)
	})
}

async function loadSetSave(setData: LevelSetData): Promise<LevelSet> {
	let { loaderFunction, scriptFile } = setData
	const filePrefix = dirname(scriptFile)
	// If the zip file has the entry script in a subdirectory instead of the zip
	// root, prefix all file paths with the entry file
	if (filePrefix !== ".") {
		loaderFunction = makeLoaderWithPrefix(filePrefix, loaderFunction)
		scriptFile = basename(scriptFile)
	}

	const scriptData = (await loaderFunction(scriptFile, false)) as string
	const scriptTitle = findScriptName(scriptData)!

	const setInfo = await readFile(`./solutions/default/${scriptTitle}.nccs`)
		.then(buf => parseNCCS(buf))
		.catch(() => null)

	if (setInfo !== null) {
		return await LevelSet.constructAsync(setInfo, loaderFunction)
	} else {
		return await LevelSet.constructAsync(scriptFile, loaderFunction)
	}
}

export const levelSetAutosaveAtom = atomEffect((get, _set) => {
	const lSet = get(levelSetAtom)
	if (!lSet) return
	void writeFile(
		`./solutions/default/${lSet.scriptRunner.state.scriptTitle!}.nccs`,
		writeNCCS(lSet.toSetInfo())
	)
})

export function useSetLoaded(): {
	setSet(set: Promise<LevelSetData>, ident?: string): void
	setLevel(level: Promise<LevelData>): void
} {
	const setLevelSet = useSetAtom(levelSetAtomWrapped)
	const setLevelSetIdent = useSetAtom(levelSetIdentAtom)
	const setLevel = useSetAtom(levelAtom)
	const setLevelN = useSetAtom(levelNAtom)
	const setPageName = useSetAtom(pageAtom)
	const page = useAtomValue(pageAtom)
	return {
		setSet(setData, ident) {
			const set = setData.then(data => loadSetSave(data))
			setLevelSet(set)
			setLevel(
				set.then(set => set.getCurrentRecord()).then(rec => rec.levelData!)
			)
			set.then(set => {
				setLevelN(set.currentLevel)
				const importantIdent = IMPORTANT_SETS.find(
					iset => iset.setName === set.scriptRunner.state.scriptTitle!
				)?.setIdent
				setLevelSetIdent(ident ?? importantIdent ?? CUSTOM_SET_SET_IDENT)
			})
			if (!page?.isLevelPlayer) {
				setPageName("play")
			}
		},
		setLevel(level) {
			setLevelSet(null)
			setLevelSetIdent(CUSTOM_LEVEL_SET_IDENT)
			setLevel(level)
			setLevelN(1)
			if (!page?.isLevelPlayer) {
				setPageName("play")
			}
		},
	}
}

export async function showFileLevelPrompt(): Promise<LevelData | null> {
	const file: File | undefined = (await showLoadPrompt(["c2m"]))[0]
	return file?.arrayBuffer().then(buf => parseC2M(buf))
}

export function useOpenFile(): () => Promise<{
	level: LevelData
	buffer: ArrayBuffer
} | null> {
	const { setLevel } = useSetLoaded()
	return async () => {
		const files = await showLoadPrompt([
			"c2m",
			// TODO Set loading
			// "zip"
		])
		const file = files[0]
		if (!file) return null
		const levelPromise = file.arrayBuffer().then(buf => parseC2M(buf))
		setLevel(levelPromise)
		return { level: await levelPromise, buffer: await file.arrayBuffer() }
	}
}

export async function showSetDirectoryPrompt(): Promise<LevelSetData> {
	const files = await showLoadPrompt([], false, true)
	return await makeSetDataFromFiles(files)
}

export function useOpenDir(): () => Promise<{
	setData: LevelSetData
}> {
	const { setSet } = useSetLoaded()
	return async () => {
		const setData = showSetDirectoryPrompt()
		setSet(setData)
		return { setData: await setData }
	}
}

export const LoadLevelPrompt: PromptComponent<LevelData | null> = function ({
	onResolve,
}) {
	const setPage = useSetAtom(pageAtom)
	return (
		<Dialog
			header="Level file needed"
			buttons={[
				[
					"Back to set selector",
					() => {
						setPage("")
						onResolve(null)
					},
				],
				[
					"Load file",
					async () => {
						const level = await showFileLevelPrompt()
						if (!level) return
						onResolve(level)
					},
				],
			]}
		>
			The URL doesn't provide the level data required to load the level. Please
			provide the level file or go back to the set selector.
		</Dialog>
	)
}

export const LoadSetPrompt: PromptComponent<void> = function ({ onResolve }) {
	const setPage = useSetAtom(pageAtom)
	return (
		<Dialog
			header="Level file needed"
			buttons={[
				[
					"Back to set selector",
					() => {
						setPage("")
					},
				],
			]}
			onResolve={onResolve}
		>
			The URL given does not specify a set name and thus cannot be loaded
			automatically.
		</Dialog>
	)
}

const resolveHashLevelPromptIdent = Symbol()

export async function resolveHashLevel(get: Getter, set: Setter) {
	const levelSetIdent = get(levelSetIdentAtom)
	const levelN = get(levelNAtom)
	const searchParams = get(searchParamsAtom)
	hidePrompt(get, set, resolveHashLevelPromptIdent)
	if (searchParams.level) {
		let buf = decodeBase64(searchParams.level)
		if (buf[0] == 0x78) {
			buf = await unzlibAsync(buf)
		}
		if (get(pageNameAtom) === "") {
			set(pageAtom, "play")
		}
		set(levelAtom, Promise.resolve(parseC2M(buf.buffer)))
		set(levelSetIdentAtom, CUSTOM_LEVEL_SET_IDENT)
		if (levelN === null) {
			set(levelNAtom, 1)
		}
		set(preventImmediateHashUpdateAtom, false)
	} else if (levelSetIdent === null || levelN === null) {
	} else if (levelSetIdent === CUSTOM_LEVEL_SET_IDENT) {
		showPrompt(get, set, LoadLevelPrompt, resolveHashLevelPromptIdent).then(
			newLevel => {
				if (!newLevel) return
				set(levelAtom, Promise.resolve(newLevel))
			}
		)
	} else if (levelSetIdent === CUSTOM_SET_SET_IDENT) {
		showPrompt(get, set, LoadSetPrompt, resolveHashLevelPromptIdent)
	} else {
		showPrompt<void>(
			get,
			set,
			({ onResolve }) => (
				<Dialog
					header="TODO"
					buttons={[["Back to set selector", () => set(pageAtom, "")]]}
					onResolve={onResolve}
				>
					Sorry, this type of set isn't supported yet!
				</Dialog>
			),
			resolveHashLevelPromptIdent
		)
	}
}
