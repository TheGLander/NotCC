import { Getter, Setter, atom, useAtomValue, useSetAtom } from "jotai"
import { LevelData, LevelSet, parseC2M } from "@notcc/logic"
import {
	CUSTOM_LEVEL_SET_IDENT,
	CUSTOM_SET_SET_IDENT,
	levelNAtom,
	levelSetIdentAtom,
	pageAtom,
	searchParamsAtom,
} from "./routing"
import { atomEffect } from "jotai-effect"
import { loadable, unwrap } from "jotai/utils"
import { type os } from "@neutralinojs/lib"
import { Dialog } from "./components/Dialog"
import { useRef } from "preact/hooks"
import { PromptComponent, showPrompt } from "./prompts"
import { decodeBase64, unzlibAsync } from "./helpers"

export const levelAtom = atom<Promise<LevelData> | null>(null)
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

export const levelSetAtom = atom<Promise<LevelSet> | null>(null)
export const levelSetUnwrappedAtom = unwrap(levelSetAtom)

export const autoLevelfromLevelNAtom = atomEffect((get, set) => {
	const levelN = get(levelNAtom)
	const levelSet = get(levelSetUnwrappedAtom)
	if (levelSet && levelN !== null) {
		set(
			levelAtom,
			levelSet.goToLevel(levelN).then(rec => rec.levelData!)
		)
	}
})

export function useSetLoaded(): {
	setSet(set: Promise<LevelSet>, ident?: string): void
	setLevel(level: Promise<LevelData>): void
} {
	const setLevelSet = useSetAtom(levelSetAtom)
	const setLevelSetIdent = useSetAtom(levelSetIdentAtom)
	const setLevel = useSetAtom(levelAtom)
	const setLevelN = useSetAtom(levelNAtom)
	const setPageName = useSetAtom(pageAtom)
	const page = useAtomValue(pageAtom)
	return {
		setSet(set, ident) {
			setLevelSet(set)
			setLevelSetIdent(ident ?? CUSTOM_SET_SET_IDENT)
			setLevel(
				set.then(set => set.getCurrentRecord()).then(rec => rec.levelData!)
			)
			set.then(set => setLevelN(set.currentLevel))
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

// TODO Neutralino prompts
async function showLoadPrompt(
	_title?: string,
	options?: os.OpenDialogOptions
): Promise<File[]> {
	const fileLoader = document.createElement("input")
	fileLoader.type = "file"
	if (options?.filters !== undefined) {
		fileLoader.accept = options.filters
			.map(filter => filter.extensions.map(ext => `.${ext}`).join(","))
			.join(",")
	}
	fileLoader.multiple = !!options?.multiSelections
	return new Promise((res, rej) => {
		fileLoader.addEventListener("change", () => {
			if (fileLoader.files === null || fileLoader.files.length === 0) {
				rej(new Error("No files specified"))
			} else {
				res(Array.from(fileLoader.files))
			}
			fileLoader.remove()
		})
		fileLoader.click()
	})
}

export async function showFileLevelPrompt(): Promise<LevelData | null> {
	const file: File | undefined = (
		await showLoadPrompt("Load level file", {
			filters: [{ name: "C2M level file", extensions: ["c2m"] }],
		})
	)[0]
	return file?.arrayBuffer().then(buf => parseC2M(buf))
}

export function useOpenFile(): () => Promise<boolean> {
	const { setLevel } = useSetLoaded()
	return async () => {
		const files = await showLoadPrompt("Load level file", {
			filters: [
				{ name: "C2M level file", extensions: ["c2m"] },
				// TODO Set loading
				// { name: "ZIP levelset archive", extensions: ["zip"] },
			],
		})
		const file = files[0]
		if (!file) return false
		const levelPromise = file.arrayBuffer().then(buf => parseC2M(buf))
		setLevel(levelPromise)
		await levelPromise
		return true
	}
}

export const LoadLevelPrompt: PromptComponent<LevelData | null> = function ({
	onResolve,
}) {
	const setPage = useSetAtom(pageAtom)
	return (
		<Dialog
			header={"Level file needed"}
			section={
				<>
					The URL doesn't provide the level data required to load the level.
					Please provide the level file or go back to the set selector.
				</>
			}
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
		/>
	)
}

const resolveHashLevelPromptIdent = Symbol()

export async function resolveHashLevel(get: Getter, set: Setter) {
	const levelSetIdent = get(levelSetIdentAtom)
	const levelN = get(levelNAtom)
	const searchParams = get(searchParamsAtom)
	if (searchParams.level) {
		let buf = decodeBase64(searchParams.level)
		if (buf[0] == 0x78) {
			buf = await unzlibAsync(buf)
		}
		set(pageAtom, "play")
		set(levelAtom, Promise.resolve(parseC2M(buf.buffer)))
		set(levelSetIdentAtom, CUSTOM_LEVEL_SET_IDENT)
		if (levelN === null) {
			set(levelNAtom, 1)
		}
	} else if (levelSetIdent === null || levelN === null) {
	} else if (levelSetIdent === CUSTOM_LEVEL_SET_IDENT) {
		showPrompt(get, set, LoadLevelPrompt, resolveHashLevelPromptIdent).then(
			newLevel => {
				if (!newLevel) return
				set(levelAtom, Promise.resolve(newLevel))
			}
		)
	} else {
		showPrompt<void>(
			get,
			set,
			({ onResolve }) => (
				<Dialog
					header="TODO"
					section="Sorry, this type of set isn't supported yet!"
					buttons={[["Back to set selector", () => set(pageAtom, "")]]}
					onResolve={onResolve}
				/>
			),
			resolveHashLevelPromptIdent
		)
	}
}
