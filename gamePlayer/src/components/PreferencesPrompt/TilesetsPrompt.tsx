import { PromptComponent, showPrompt as showPromptGs } from "@/prompts"
import { Dialog } from "../Dialog"
import { useCallback, useId, useMemo, useState } from "preact/hooks"
import { Tileset, removeBackground } from "../GameRenderer/renderer"
import { GameRenderer } from "../GameRenderer"
import tilesetLevelPath from "./tilesetPreview.c2m"
import { CameraType, createLevelFromData, parseC2M } from "@notcc/logic"
import { Suspense } from "preact/compat"
import { cc2ArtSet } from "../GameRenderer/cc2ArtSet"
import cga16Image from "@/tilesets/cga16.png"
import tworldImage from "@/tilesets/tworld.png"
import {
	canvasToBin,
	fetchImage,
	makeImagefromBlob,
	readImage,
	reencodeImage,
	showLoadPrompt,
	useJotaiFn,
} from "@/helpers"
import { atom, useAtom, useAtomValue } from "jotai"
import { preferenceAtom } from "@/preferences"
import { readFile, remove, writeFile } from "@/fs"
import { suspend } from "suspend-react"
import { PrefDisplayProps } from "."
import { twJoin } from "tailwind-merge"
import { atomEffect } from "jotai-effect"

const PRIMARY_TILE_SIZE = 32
export const tilesetAtom = atom<Tileset | null>(null)
export const tilesetIdAtom = preferenceAtom("tileset", "cga16")
export const tilesetSyncAtom = atomEffect((get, set) => {
	getTileset(get(tilesetIdAtom)).then(val => set(tilesetAtom, val))
})

const tilesetLevelAtom = atom(async () =>
	parseC2M(await (await fetch(tilesetLevelPath)).arrayBuffer())
)
const tilesetLevelCameraType: CameraType = { width: 5, height: 5, screens: 1 }

export async function getTileset(id: string): Promise<Tileset> {
	if (id === "cga16")
		return {
			image: await fetchImage(cga16Image),
			art: cc2ArtSet,
			tileSize: 8,
			wireWidth: 2 / 8,
		}
	if (id === "tworld")
		return {
			image: await fetchImage(tworldImage),
			art: cc2ArtSet,
			tileSize: 32,
			wireWidth: 2 / 32,
		}

	const img = removeBackground(
		await readImage(await readFile(`./tilesets/${id}.png`))
	)
	const tileSize = img.width / 16
	return {
		image: img,
		wireWidth: 2 / 32,
		tileSize,
		art: cc2ArtSet,
	}
}

function TilesetEntry(props: {
	selected: boolean
	onClick?: () => void
	id: string
	desc?: string
	onRemove?: () => void
}) {
	const levelData = useAtomValue(tilesetLevelAtom)
	const level = useMemo(() => {
		const lvl = createLevelFromData(levelData)
		lvl.forcedPerspective = true
		return lvl
	}, [levelData])
	const tileset = suspend(() => getTileset(props.id), [props.id])
	return (
		<div
			class={twJoin(
				"box hover:bg-theme-950  flex w-60 cursor-pointer flex-col",
				props.selected && "bg-theme-950"
			)}
			onClick={props.onClick}
		>
			<GameRenderer
				class="self-center"
				level={level}
				tileset={tileset}
				cameraType={tilesetLevelCameraType}
				tileScale={PRIMARY_TILE_SIZE / tileset.tileSize}
			/>
			<span class="text-lg">
				{props.id.startsWith("custom") ? "custom" : props.id}
			</span>
			{props.desc && <span class="text-sm">{props.desc}</span>}
			{props.onRemove && (
				<button
					class="ml-auto mt-auto text-sm"
					onClick={
						props.onRemove &&
						(ev => {
							ev.stopPropagation()
							props.onRemove!()
						})
					}
				>
					Remove
				</button>
			)}
		</div>
	)
}

export const customTsetsAtom = atom<string[]>([])

export const TilesetsPrompt =
	(currentTset: string): PromptComponent<string> =>
	pProps => {
		const [chosenTset, setChosenTset] = useState(currentTset)
		const [customTsets, setCustomTsets] = useAtom(customTsetsAtom)
		async function addTset() {
			let img = await makeImagefromBlob((await showLoadPrompt(["*.png"]))[0])
			if (img.width % 8 !== 0 || img.height !== img.width * 2) {
				throw new Error(
					"Invalid tileset image proportions. Are you sure this a CC2 tileset?"
				)
			}
			const id = `custom-${Date.now()}`
			await writeFile(
				`/tilesets/${id}.png`,
				await canvasToBin(reencodeImage(img))
			)
			setCustomTsets(arr => arr.concat(id))
		}
		const removeTset = useCallback(
			async (id: string) => {
				if (chosenTset === id) {
					setChosenTset("cga16")
				}
				await remove(`/tilesets/${id}.png`)
				setCustomTsets(arr => {
					arr.splice(arr.indexOf(id), 1)
					return Array.from(arr)
				})
			},
			[chosenTset, customTsets]
		)
		return (
			<Dialog
				header="Tilesets"
				buttons={[
					["Ok", () => pProps.onResolve(chosenTset)],
					["Cancel", () => pProps.onResolve(currentTset)],
				]}
				onClose={() => pProps.onResolve(currentTset)}
			>
				<Suspense fallback="Loading tilesets...">
					<div class="mb-2 flex flex-wrap justify-center gap-2">
						<TilesetEntry
							selected={chosenTset === "cga16"}
							onClick={() => setChosenTset("cga16")}
							id="cga16"
							desc="This is how this game might have looked like if it were released in the 1980s.
		Not to be confused with the 4-color CC1 tileset also named CGA."
						/>
						<TilesetEntry
							selected={chosenTset === "tworld"}
							onClick={() => setChosenTset("tworld")}
							id="tworld"
							desc="The Tile World tileset, with CC2 additions! Incomplete."
						/>
						{customTsets.map(id => (
							<TilesetEntry
								selected={chosenTset === id}
								onClick={() => setChosenTset(id)}
								id={id}
								onRemove={() => removeTset(id)}
							/>
						))}
					</div>
				</Suspense>
				<span class="mt-2">
					<button onClick={addTset}>Add tileset</button> More tilesets can be
					found on{" "}
					<a href="https://forum.bitbusters.club/forum-40.html" target="_blank">
						the forums
					</a>
				</span>
			</Dialog>
		)
	}
export function TilesetPrefDisplay({ set, value }: PrefDisplayProps<string>) {
	const showPrompt = useJotaiFn(showPromptGs)
	const inputId = useId()
	return (
		<>
			<label for={inputId}>Tileset:</label>
			<span id={inputId}>
				{value.startsWith("custom") ? "custom" : value}{" "}
				<button
					onClick={async () => {
						const tset = showPrompt(TilesetsPrompt(value))
						set(await tset)
					}}
				>
					Change
				</button>
			</span>
		</>
	)
}
