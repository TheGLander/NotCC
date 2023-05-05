import tworldTileset from "./tworld.png"
import cga16Tileset from "./cga16.png"
import previewLevel from "../levels/tilesetPreview.c2m"
import { instanciateTemplate, makeTd, resetListeners } from "../utils"

import Renderer, {
	HTMLImage,
	Tileset,
	fetchImage,
	generateActorFrames,
	removeBackground,
} from "../visuals"
import { loadImage } from "../saveData"
import cc2ImageFormat from "../cc2ImageFormat"
import { createLevelFromData, parseC2M } from "@notcc/logic"
import { Pager } from "../pager"
import { defaultSettings } from "../settings"

export interface SourcelessTilesetMetadata {
	identifier: string
	title: string
	description: string
	credits: string
	wireWidth: number
	tileSize: number
}

export interface BuiltinTilesetMetadata extends SourcelessTilesetMetadata {
	type: "built-in"
	link: string
}

export interface ExternalTilesetMetadata extends SourcelessTilesetMetadata {
	type: "external"
}

export type TilesetMetadata = BuiltinTilesetMetadata | ExternalTilesetMetadata

const builtInTilesets: BuiltinTilesetMetadata[] = [
	{
		type: "built-in",
		identifier: "tworld",
		title: "Tile World",
		description:
			"The tileset from Tile World, with CC2 tiles! (Note: some CC2 tiles have devart)",
		credits:
			"Anders Kaseorg (Original tileset), Kawaiiprincess (CC2 Adaptation), G lander (Additonal art and renders)",
		tileSize: 32,
		wireWidth: 2 / 32,
		link: tworldTileset,
	},
	{
		type: "built-in",
		identifier: "cga16",
		title: "CGA (16 colors)",
		description: `How this game might've looked like if it were released in the 1980s.
		Not to be confused with the 4-color CC1 CGA tileset.`,
		credits: "G lander",
		tileSize: 8,
		wireWidth: 2 / 8,
		link: cga16Tileset,
	},
]

export async function fetchTileset(tset: TilesetMetadata): Promise<HTMLImage> {
	if (tset.type === "built-in") {
		return await fetchImage(tset.link)
	} else {
		return await loadImage(tset.identifier)
	}
}

export async function makeTilesetFromMetadata(
	tset: TilesetMetadata
): Promise<Tileset> {
	let tsetImage = await fetchTileset(tset)
	tsetImage = removeBackground(tsetImage)
	return {
		// TODO Add custom framemaps
		frameMap: generateActorFrames(cc2ImageFormat),
		image: tsetImage,
		tileSize: tset.tileSize,
		wireWidth: tset.wireWidth,
	}
}

export function getTilesetMetadataFromIdentifier(
	identifier: string
): TilesetMetadata | null {
	return builtInTilesets.find(meta => meta.identifier === identifier) ?? null
}

export async function updatePagerTileset(pager: Pager): Promise<void> {
	let tilesetMeta = getTilesetMetadataFromIdentifier(pager.settings.tileset)
	if (tilesetMeta === null) {
		// Uh oh, the current tileset doesn't exist
		// Try again with the default one
		tilesetMeta = getTilesetMetadataFromIdentifier(defaultSettings.tileset)
		if (tilesetMeta === null) {
			// Welp. I guess something is really wrong.
			throw new Error("Can't find any tileset metadata")
		}
	}

	const tileset = await makeTilesetFromMetadata(tilesetMeta)
	pager.tileset = tileset
}

const tilesetSelectDialog = document.querySelector<HTMLDialogElement>(
	"#tilesetSelectorDialog"
)!

const tsetInfoTemplate = document.querySelector<HTMLTemplateElement>(
	"#tilesetInfoTemplate"
)!

function makeTsetInfo(tset: TilesetMetadata): HTMLSpanElement {
	const tsetInfo = instanciateTemplate<HTMLSpanElement>(tsetInfoTemplate)

	// eslint-disable-next-line no-inner-declarations
	function assingTsetInfo(key: string, val: string): void {
		tsetInfo.querySelector(`#tset${key}`)!.textContent = val
	}
	assingTsetInfo("Title", tset.title)
	assingTsetInfo("Description", tset.description)
	assingTsetInfo("Credits", tset.credits)
	assingTsetInfo("TileSize", `${tset.tileSize}px`)
	assingTsetInfo("WireWidth", `${tset.wireWidth * tset.tileSize}px`)
	return tsetInfo
}

async function makeTsetPreview(tsetMeta: TilesetMetadata) {
	const tset = await makeTilesetFromMetadata(tsetMeta)
	const canvas = document.createElement("canvas")
	canvas.classList.add("pixelCanvas")
	canvas.classList.add("tsetPreviewCanvas")
	const renderer = new Renderer(tset, canvas)
	const levelBuffer = await (await fetch(previewLevel)).arrayBuffer()
	const levelData = parseC2M(levelBuffer, "previewLevel.c2m")
	const level = createLevelFromData(levelData)
	renderer.level = level
	renderer.cameraSize = { width: 5, height: 5, screens: 1 }
	renderer.updateTileSize()
	renderer.frame()
	return canvas
}

export async function openTilesetSelectortDialog(
	currentTileset: string
): Promise<string | null> {
	resetListeners(tilesetSelectDialog)
	const tableBody = tilesetSelectDialog.querySelector("tbody")!
	// Nuke all current data
	tableBody.textContent = ""
	for (const tset of builtInTilesets) {
		const row = document.createElement("tr")
		row.tabIndex = -1
		const radioButton = document.createElement("input")
		radioButton.tabIndex = 0
		radioButton.type = "radio"
		radioButton.name = "tileset"
		radioButton.value = tset.identifier
		if (currentTileset === radioButton.value) {
			radioButton.checked = true
		}
		row.appendChild(makeTd(radioButton))
		row.appendChild(makeTd(await makeTsetPreview(tset)))
		row.appendChild(makeTd(makeTsetInfo(tset)))
		tableBody.appendChild(row)
		row.addEventListener("click", () => {
			radioButton.click()
		})
	}
	return new Promise(res => {
		const closeListener = () => {
			const dialogForm = tilesetSelectDialog.querySelector("form")!
			const tilesetSelection = dialogForm.elements.namedItem(
				"tileset"
			) as RadioNodeList
			res(tilesetSelection.value === "" ? null : tilesetSelection.value)
			tilesetSelectDialog.removeEventListener("close", closeListener)
		}

		tilesetSelectDialog.addEventListener("close", closeListener)
		tilesetSelectDialog.showModal()
	})
}
