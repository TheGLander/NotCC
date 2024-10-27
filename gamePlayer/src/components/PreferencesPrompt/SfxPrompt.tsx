import { isPreloading, preferenceAtom } from "@/preferences"
import { makeHttpFileLoader, makeZipFileLoader } from "@/setLoading"
import { AudioSfxManager } from "@/sfx"
import { atom, useAtom } from "jotai"
import { atomEffect } from "jotai-effect"
import { Gallery, GalleryItem } from "./Gallery"
import {
	readFile,
	remove,
	writeFile,
	showLoadPrompt,
	showDirectoryPrompt,
} from "@/fs"
import { suspend } from "suspend-react"
import { useCallback, useState } from "preact/hooks"
import { PromptComponent, showPromptGs } from "@/prompts"
import { useJotaiFn, zipAsync } from "@/helpers"
import { Dialog } from "../Dialog"
import { PrefDisplayProps } from "."

export const sfxAtom = atom<AudioSfxManager | null>(null)
export const sfxIdAtom = preferenceAtom("sfxset", "defo")
export const sfxSyncAtom = atomEffect((get, set) => {
	void get(sfxIdAtom)
	if (isPreloading(get)) return
	getSfxSet(get(sfxIdAtom)).then(val => set(sfxAtom, val))
})

export async function getSfxSet(id: string) {
	const sfxMan = new AudioSfxManager()
	if (id === "silence") {
	} else if (id === "defo" || id === "tworld") {
		await sfxMan.loadSfx(makeHttpFileLoader(`./sfx/${id}/`))
	} else {
		const sfxZip = await readFile(`/sfx/${id}.zip`)
		await sfxMan.loadSfx(makeZipFileLoader(sfxZip))
	}
	return sfxMan
}

const DEFAULT_SFXS: GalleryItem[] = [
	{
		id: "silence",
	},
	{ id: "defo", desc: "Bleepy-bloopy SFX. Made with jfxr" },
	{ id: "tworld", desc: "The sound effects from Tile World! Wow!" },
]

function SfxPreview(props: { id: string }) {
	const sfxSet = suspend(() => getSfxSet(props.id), ["sfx preview" + props.id])
	const playRandomSfx = useCallback(
		(ev: MouseEvent) => {
			ev.stopPropagation()
			const availSfx = Object.keys(sfxSet.audioBuffers)
			const chosenSfx = availSfx[Math.floor(Math.random() * availSfx.length)]
			sfxSet.playOnce(chosenSfx)
		},
		[sfxSet]
	)
	return (
		<div>
			<span class="text-lg">
				{props.id.startsWith("custom") ? "custom" : props.id}
			</span>
			<button onClick={playRandomSfx} class="block">
				Play random
			</button>
		</div>
	)
}

export const customSfxAtom = atom<string[]>([])

export const SfxPrompt =
	(currentSfx: string): PromptComponent<string> =>
	pProps => {
		const [chosenSfx, setChosenSfx] = useState(currentSfx)
		const [customSfx, setCustomSfx] = useAtom(customSfxAtom)
		async function addSfx(sfxZip: ArrayBuffer) {
			const id = `custom-${Date.now()}`
			await writeFile(`/sfx/${id}.zip`, sfxZip)
			setCustomSfx(arr => arr.concat(id))
		}
		async function addSfxZip() {
			const sfxZip = await showLoadPrompt("Load SFX zip", {
				filters: [{ name: "SFX Zip", extensions: ["zip"] }],
			})
			if (!sfxZip?.[0]) return
			addSfx(await sfxZip[0].arrayBuffer())
		}
		async function addSfxDir() {
			const sfxDir = await showDirectoryPrompt("Load SFX directory")
			if (!sfxDir) return
			const files: Record<string, Uint8Array> = {}
			for (const file of sfxDir) {
				if (file.webkitRelativePath.split("/").length > 2) {
					throw new Error("Loaded directory must only contain (audio) files")
				}
				files[file.name] = new Uint8Array(await file.arrayBuffer())
			}

			const sfxZip = (await zipAsync(files)).buffer
			addSfx(sfxZip)
		}
		const removeSfx = useCallback(
			async (id: string) => {
				if (chosenSfx === id) {
					setChosenSfx("defo")
				}
				await remove(`/sfx/${id}.zip`)
				setCustomSfx(arr => {
					arr.splice(arr.indexOf(id), 1)
					return Array.from(arr)
				})
			},
			[chosenSfx, customSfx]
		)
		return (
			<Dialog
				header="Sound effects"
				buttons={[
					["Ok", () => pProps.onResolve(chosenSfx)],
					["Cancel", () => pProps.onResolve(currentSfx)],
				]}
				onClose={() => pProps.onResolve(currentSfx)}
			>
				<Gallery
					chosenItem={chosenSfx}
					defaultItems={DEFAULT_SFXS}
					customItems={customSfx.map(id => ({ id }))}
					Preview={SfxPreview}
					onRemoveItem={removeSfx}
					onChooseItem={id => setChosenSfx(id)}
				/>
				<span class="mt-2 flex flex-row gap-2">
					<button onClick={addSfxZip}>Add sound effects (ZIP)</button>
					<button onClick={addSfxDir}>Add sound effects (directory)</button>
				</span>
			</Dialog>
		)
	}

export function SfxPrefDisplay({
	set,
	value,
	inputId,
}: PrefDisplayProps<string>) {
	const showPrompt = useJotaiFn(showPromptGs)
	return (
		<span id={inputId}>
			{value.startsWith("custom") ? "custom" : value}{" "}
			<button
				onClick={async () => {
					const sfx = showPrompt(SfxPrompt(value))
					set(await sfx)
				}}
			>
				Change
			</button>
		</span>
	)
}
