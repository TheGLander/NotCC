import { Getter, Setter, atom, useAtomValue, useSetAtom } from "jotai"
import {
	Level,
	LevelSet,
	LevelSetData,
	constructSimplestLevelSet,
	findScriptName,
	parseC2M,
	parseNCCS,
	parseScriptMetadata,
	writeNCCS,
	protobuf,
	getC2GGameModifiers,
	C2GGameModifiers,
	MapInterruptWinResponse,
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
import { useCallback, useRef } from "preact/hooks"
import {
	PromptComponent,
	hidePrompt,
	showAlertGs,
	showPromptGs,
} from "./prompts"
import { decodeBase64, formatBytes, unzlibAsync, useJotaiFn } from "./helpers"
import {
	IMPORTANT_SETS,
	ImportantSetInfo,
	buildFileListIndex,
	findEntryFilePath,
	makeBufferMapFileLoader,
	makeBufferMapFromFileList,
	makeFileListFileLoader,
	makeLoaderWithPrefix,
} from "./setLoading"
import { basename, dirname } from "path-browserify"
import { readFile, writeFile, showLoadPrompt, showDirectoryPrompt } from "./fs"
import { atomEffect } from "jotai-effect"
import { preferenceAtom, preloadFinishedAtom } from "./preferences"
import { parse } from "path"
import {
	ItemLevelSet,
	downloadBBClubSetGs,
	fetchBBClubSets,
	findLocalSet,
	saveFilesLocallyGs,
} from "./setManagement"
import { BB_CLUB_SETS_URL } from "./setsApi"
import { Toast, addToastGs, adjustToastGs, removeToastGs } from "./toast"

export class LevelData {
	constructor(private level: Level) {}
	initLevel() {
		return this.level.clone()
	}
	// XXX: Kind of a hack, maybe remove this somehow??
	get replay() {
		return this.level.builtinReplay
	}
}

export const levelAtom = atom<LevelData | Promise<LevelData> | null>(null)

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
// HACK: This is updated each time `levelSetAtom` is modified and the result of which should be saved (eg. after navigating to or beating a level).
export const levelSetChangedAtom = atom(Symbol())

export async function borrowLevelSetGs(
	get: Getter,
	set: Setter,
	func: (set: LevelSet) => void | Promise<void>
) {
	const lset = get(levelSetAtom)
	if (!lset) return
	await func(lset)
	set(levelSetAtom, lset)
	set(levelNAtom, lset.currentLevel)
	set(levelSetChangedAtom, Symbol())
}

export async function goToLevelNGs(get: Getter, set: Setter, levelN: number) {
	set(levelNAtom, levelN)
	set(setIntermissionAtom, null)
	await borrowLevelSetGs(get, set, async lSet => {
		const rec = await lSet.goToLevel(levelN)
		set(levelWinInterruptResponseAtom, null)
		set(
			levelAtom,
			rec && new LevelData((await lSet.loadLevelData(rec)).levelData)
		)
	})
}

export const levelWinInterruptResponseAtom = atom<Omit<
	MapInterruptWinResponse,
	"totalScore"
> | null>(null)

export type ShowEpilogueMode = "never" | "unseen" | "always"

export const showEpilogueAtom = preferenceAtom<ShowEpilogueMode>(
	"showEpilogue",
	"unseen"
)
export function shouldShowEpilogueGs(
	get: Getter,
	_set: Setter,
	level: protobuf.ILevelInfo
) {
	const mode = get(showEpilogueAtom)
	if (mode === "never") return false
	if (mode === "always") return true
	return !level.sawEpilogue
}

export interface SetIntermission {
	type: "prologue" | "epilogue"
	text: string[]
}

export const setIntermissionAtom = atom<SetIntermission | null>(null)

export const setIntermissionRemoveAtom = atomEffect((get, set) => {
	const page = get(pageAtom)
	if (!page?.showsIntermissions) {
		set(setIntermissionAtom, null)
	}
})

export function showSetIntermissionGs(
	get: Getter,
	set: Setter,
	intermission: SetIntermission
) {
	const page = get(pageAtom)
	if (page?.showsIntermissions) {
		set(setIntermissionAtom, intermission)
	}
}

export async function goToNextLevelGs(get: Getter, set: Setter) {
	const intermission = get(setIntermissionAtom)
	if (intermission) {
		set(setIntermissionAtom, null)
		return
	}
	await borrowLevelSetGs(get, set, async lSet => {
		const currentRec = lSet.currentLevelRecord()
		const modifiers = getC2GGameModifiers(
			currentRec.levelInfo.scriptState ?? {}
		)
		if (
			!modifiers.autoPlayReplay &&
			currentRec.levelInfo.epilogueText &&
			shouldShowEpilogueGs(get, set, currentRec.levelInfo)
		) {
			showSetIntermissionGs(get, set, {
				type: "epilogue",
				text: currentRec.levelInfo.epilogueText,
			})
			currentRec.levelInfo.sawEpilogue = true
		}
		const winResponse = get(levelWinInterruptResponseAtom)
		const rec = await lSet.nextLevel(
			winResponse
				? { ...winResponse, totalScore: lSet.totalMetrics().score }
				: { type: "skip" }
		)
		set(levelWinInterruptResponseAtom, null)
		if (lSet.inPostGame) {
			// TODO display this somehow, like in classic NotCC or LL
			await lSet.previousLevel()
			return
		}
		if (!rec) return
		set(
			levelAtom,
			rec && new LevelData((await lSet.loadLevelData(rec)).levelData)
		)
	})
}

export async function goToPreviousLevelGs(get: Getter, set: Setter) {
	await borrowLevelSetGs(get, set, async lSet => {
		const rec = await lSet.previousLevel()
		if (!rec) return
		set(setIntermissionAtom, null)
		set(levelWinInterruptResponseAtom, null)
		set(
			levelAtom,
			rec && new LevelData((await lSet.loadLevelData(rec)).levelData)
		)
	})
}

export async function loadSetSave(
	setData: LevelSetData
): Promise<{ set: LevelSet; firstLoad: boolean }> {
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

	return {
		set: await constructSimplestLevelSet(
			{
				scriptFile,
				loaderFunction,
			},
			setInfo ?? undefined
		),
		firstLoad: setInfo === null,
	}
}

export const levelSetAutosaveAtom = atomEffect((get, _set) => {
	const lSet = get(levelSetAtom)
	get(levelSetChangedAtom)
	if (!lSet) return
	void writeFile(
		`./solutions/default/${lSet.scriptTitle()}.nccs`,
		writeNCCS(lSet.toSetInfo()).buffer
	)
})

export async function setLevelSetGs(
	get: Getter,
	set: Setter,
	setData: LevelSetData,
	ident?: string
) {
	const { set: lset, firstLoad } = await loadSetSave(setData)
	const record = await lset.loadLevelData(await lset.initialLevel())
	set(levelAtom, new LevelData(record.levelData))
	set(levelSetAtom, lset)
	set(levelNAtom, lset.currentLevel)
	const importantIdent = IMPORTANT_SETS.find(
		iset => iset.setName === lset.gameTitle()
	)?.setIdent
	set(levelSetIdentAtom, ident ?? importantIdent ?? CUSTOM_SET_SET_IDENT)
	if (!get(pageAtom)?.isLevelPlayer) {
		set(pageAtom, "play")
	}
	if (get(pageAtom)?.showsIntermissions ?? false) {
		if (
			record.levelInfo.prologueText &&
			get(showEpilogueAtom) !== "never" &&
			firstLoad
		) {
			showSetIntermissionGs(get, set, {
				type: "prologue",
				text: record.levelInfo.prologueText,
			})
		}
	}
}

export function setIndividualLevelGs(
	get: Getter,
	set: Setter,
	level: Promise<LevelData>
) {
	set(levelSetAtom, null)
	set(levelSetIdentAtom, CUSTOM_LEVEL_SET_IDENT)
	set(levelAtom, level)
	set(levelNAtom, 1)
	if (!get(pageAtom)?.isLevelPlayer) {
		set(pageAtom, "play")
	}
}

export async function showFileLevelPrompt(): Promise<LevelData | null> {
	const files = await showLoadPrompt("Load level file", {
		filters: [{ name: "CC2 level file", extensions: ["c2m"] }],
	})

	return (
		files?.[0]?.arrayBuffer().then(buf => new LevelData(parseC2M(buf))) ?? null
	)
}

export async function promptFile(): Promise<{
	level: LevelData
	buffer: ArrayBuffer
} | null> {
	const files = await showLoadPrompt("Load set or level file", {
		filters: [
			{ name: "CC2 level file", extensions: ["c2m"] },
			// TODO: { name: "Set ZIP", extensions: ["zip"] },
		],
	})
	const file = files?.[0]
	if (!file) return null
	const levelBuffer = await file.arrayBuffer()
	const level = parseC2M(levelBuffer)
	return { level: new LevelData(level), buffer: levelBuffer }
}

export interface LevelSetDir {
	setData: LevelSetData
	setFiles: File[]
	setIdent: string
}

export const preloadFilesFromDirectoryPromptAtom = preferenceAtom(
	"preloadFilesFromDirectoryPrompt",
	false
)

export async function promptDir(
	preloadFiles: boolean
): Promise<LevelSetDir | null> {
	const files = await showDirectoryPrompt("Load set directory")
	if (!files) return null
	let setData: LevelSetData
	try {
		const fileIndex = buildFileListIndex(files)
		const loader = preloadFiles
			? makeBufferMapFileLoader(await makeBufferMapFromFileList(files))
			: makeFileListFileLoader(files)
		setData = await findEntryFilePath(loader, fileIndex)
	} catch {
		return null
	}
	const filePath = parse(files[0].webkitRelativePath)
	const fileBase = filePath.base.split("/")[0]
	return { setData, setFiles: files, setIdent: fileBase }
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

const DownloadSetPrompt =
	(set: ItemLevelSet): PromptComponent<"download" | "cancel"> =>
	pProps => {
		return (
			<Dialog
				header={`Download bb.club set "${set.setName}"?`}
				buttons={[
					["Download", () => pProps.onResolve("download")],
					["Back to set selector", () => pProps.onResolve("cancel")],
				]}
			>
				You're attempting to open a link to the set "{set.setName}", which was
				not found locally, but is available on the bb.club online set
				repository. Do you want to download the set? It will take{" "}
				{formatBytes(set.bbClubSet!.set.file_size)} in storage space.
			</Dialog>
		)
	}

const LoadNonfreeSetPrompt =
	(importantSet: ImportantSetInfo): PromptComponent<LevelSetDir | null> =>
	pProps => {
		const setPage = useSetAtom(pageAtom)
		const showAlert = useJotaiFn(showAlertGs)
		const preloadFilesFromDirectoryPrompt = useAtomValue(
			preloadFilesFromDirectoryPromptAtom
		)
		const askForNonfreeSet = useCallback(async () => {
			const setStuff = await promptDir(preloadFilesFromDirectoryPrompt)
			if (!setStuff) return
			const setTitle = parseScriptMetadata(
				(await setStuff.setData.loaderFunction(
					setStuff.setData.scriptFile,
					false
				)) as string
			).title
			if (setTitle !== importantSet.setName) {
				await showAlert(
					`Invalid set name for non-free set. Expected "${importantSet.setName}", got "${setTitle}".`,
					"Invalid set name"
				)
				return
			}
			pProps.onResolve(setStuff)
		}, [])
		return (
			<Dialog
				header="Nonfree set"
				buttons={[
					["Load set directory", askForNonfreeSet],
					[
						"Back to set selector",
						() => {
							setPage("")
							pProps.onResolve(null)
						},
					],
				]}
			>
				You're attempting to open a link to the set "{importantSet.setName}",
				which is non-free, and thus cannot be downloaded from bb.club or
				included as part of NotCC. You can{" "}
				<a href={importantSet.acquireInfo!.url} target="_blank">
					{importantSet.acquireInfo!.term} Steam here
				</a>{" "}
				and load the set into NotCC.
			</Dialog>
		)
	}

const UnnamedCustomSetPrompt: PromptComponent<void> = pProps => {
	const setPage = useSetAtom(pageAtom)
	return (
		<Dialog
			header="Unnamed set"
			buttons={[["Back to set selector", () => setPage("")]]}
			onResolve={pProps.onResolve}
		>
			The link you're attempting to open specifies an unnamed custom set, and
			cannot be resolved.
		</Dialog>
	)
}

const resolveHashLevelPromptIdent = Symbol()

export async function resolveHashLevelGs(get: Getter, set: Setter) {
	if (!get(preloadFinishedAtom)) return
	const levelSetIdent = get(levelSetIdentAtom)
	const levelN = get(levelNAtom)
	const searchParams = get(searchParamsAtom)
	hidePrompt(get, set, resolveHashLevelPromptIdent)
	// Open the level encoded in ?level if we're given one
	if (searchParams.level) {
		let buf = decodeBase64(searchParams.level)
		// Detect if we're given zlib-compressed data, since raw C2M can be kinda large sometimes
		if (buf[0] == 0x78) {
			buf = await unzlibAsync(buf)
		}
		if (get(pageNameAtom) === "") {
			set(pageAtom, "play")
		}
		set(levelAtom, Promise.resolve(new LevelData(parseC2M(buf.buffer))))
		set(levelSetIdentAtom, CUSTOM_LEVEL_SET_IDENT)
		if (levelN === null) {
			set(levelNAtom, 1)
		}
		set(preventImmediateHashUpdateAtom, false)
	} else if (levelSetIdent === null || levelN === null) {
		set(levelSetIdentAtom, null)
		set(levelNAtom, null)
	} else if (levelSetIdent === CUSTOM_LEVEL_SET_IDENT) {
		const newLevel = await showPromptGs(
			get,
			set,
			LoadLevelPrompt,
			resolveHashLevelPromptIdent
		)
		if (!newLevel) return
		set(levelAtom, Promise.resolve(newLevel))
	} else if (levelSetIdent === CUSTOM_SET_SET_IDENT) {
		await showPromptGs(
			get,
			set,
			UnnamedCustomSetPrompt,
			resolveHashLevelPromptIdent
		)
	} else {
		async function openSet(setData: LevelSetData, newSetIdent?: string) {
			await setLevelSetGs(get, set, setData, newSetIdent ?? levelSetIdent!)
			const lset = get(levelSetAtom)!
			if (!lset.canGoToLevel(levelN!)) {
				await showAlertGs(
					get,
					set,
					<>
						The level URL provides a level number, but this set could not be
						reduced to a simple level list, and could not be automatically
						navigated to the specified level. This might mean this set uses
						advanced scripting and the level numbers might be non-linear.
					</>,
					"Couldn't load level from level number"
				)
			} else {
				await goToLevelNGs(get, set, levelN!)
			}
		}

		// Local set
		const localSet = await findLocalSet(levelSetIdent)
		if (localSet) {
			await openSet(await localSet.localSet!.loadData())
			return
		}
		// bb.club set
		const sets = await fetchBBClubSets(BB_CLUB_SETS_URL)
		const bbClubSet = sets.find(set => set.setIdent === levelSetIdent)
		if (bbClubSet) {
			const promptRes = await showPromptGs(
				get,
				set,
				DownloadSetPrompt(bbClubSet)
			)
			if (promptRes === "cancel") {
				set(pageAtom, "")
				return
			}
			const downloadProgressToast: Toast = { title: "Downloading set (0%)" }
			addToastGs(get, set, downloadProgressToast)
			const setDownloaded = await downloadBBClubSetGs(
				get,
				set,
				bbClubSet,
				progress => {
					downloadProgressToast.title = `Downloading set (${Math.round(progress * 100)}%)`
					adjustToastGs(get, set)
				}
			)
			removeToastGs(get, set, downloadProgressToast)
			if (!setDownloaded) return
			const localSet = await findLocalSet(levelSetIdent)
			if (!localSet)
				throw new Error("Failed to find set right after downloading it")
			await openSet(await localSet.localSet!.loadData())
			return
		}
		// Non-free set
		const importantSet = IMPORTANT_SETS.find(
			set => set.setIdent === levelSetIdent
		)

		if (importantSet?.acquireInfo) {
			const promptRes = await showPromptGs(
				get,
				set,
				LoadNonfreeSetPrompt(importantSet)
			)
			if (promptRes === null) return
			const saveRes = await saveFilesLocallyGs(
				get,
				set,
				promptRes.setFiles,
				importantSet.setName
			)
			if (!saveRes) {
				set(pageAtom, "")
				return
			}
			const localSetItem = await findLocalSet(importantSet.setIdent)
			if (!localSetItem)
				throw new Error("Failed to load set right after saving it")
			// The set ident might have changed, since loading an important set always forces the "correct" set ident regardless of the dir name
			await openSet(
				await localSetItem.localSet!.loadData(),
				localSetItem.setIdent
			)
			return
		}
		// TODO: Built-in set

		// Give up
		await showAlertGs(
			get,
			set,
			`Set ident "${levelSetIdent}" is unrecognized and thus cannot be loaded. This may happen if there's a typo in the set ident, a bb.club set was removed, or your internet connection is down.`,
			"Unrecognized set ident"
		)
		set(pageAtom, "")
	}
}

export function getGlobalLevelModifiersGs(
	get: Getter,
	_set?: Setter
): C2GGameModifiers {
	get(levelSetChangedAtom)
	const levelSet = get(levelSetAtom)
	const levelScriptState = levelSet?.currentLevelRecord().levelInfo.scriptState
	return {
		autoPlayReplay: false,
		autoNext: false,
		noPopups: false,
		noBonusCollection: false,
		...(levelScriptState ? getC2GGameModifiers(levelScriptState) : {}),
	}
}

export const globalC2GGameModifiersAtom = atom(
	(get: Getter) => getGlobalLevelModifiersGs(get),
	() => {}
)

export const importantSetAtom = atom((get, _set) => {
	const lSet = get(levelSetAtom)
	if (!lSet) return null
	return IMPORTANT_SETS.find(iSet => iSet.setName === lSet.gameTitle()) ?? null
})
