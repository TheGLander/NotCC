import tworldTileset from "./tworld.png"
import cga16Tileset from "./cga16.png"
import previewLevel from "../levels/tilesetPreview.c2m"
import {
	instanciateTemplate,
	makeImagefromBlob,
	fetchImage,
	makeTd,
	reencodeImage,
	resetListeners,
} from "../utils"

import { HTMLImage, Renderer, Tileset, removeBackground } from "../renderer"
import { loadAllTilesets, removeTileset, saveTileset } from "../saveData"
import { cc2ArtSet } from "../cc2ArtSet"
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
	image: HTMLCanvasElement
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
		description: `This is how this game might have looked like if it were released in the 1980s.
		Not to be confused with the 4-color CC1 tileset also named CGA.`,
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
		return tset.image
	}
}

async function getAllTilesets(): Promise<TilesetMetadata[]> {
	return (builtInTilesets as TilesetMetadata[]).concat(await loadAllTilesets())
}

export async function makeTilesetFromMetadata(
	tset: TilesetMetadata
): Promise<Tileset> {
	let tsetImage = await fetchTileset(tset)
	tsetImage = removeBackground(tsetImage)
	return {
		// TODO Add custom framemaps
		art: cc2ArtSet,
		image: tsetImage,
		tileSize: tset.tileSize,
		wireWidth: tset.wireWidth,
	}
}

export async function getTilesetMetadataFromIdentifier(
	identifier: string
): Promise<TilesetMetadata | null> {
	return (
		(builtInTilesets as TilesetMetadata[])
			.concat(await loadAllTilesets())
			.find(meta => meta.identifier === identifier) ?? null
	)
}

export async function updatePagerTileset(pager: Pager): Promise<void> {
	let tilesetMeta = await getTilesetMetadataFromIdentifier(
		pager.settings.tileset
	)
	if (tilesetMeta === null) {
		// Uh oh, the current tileset doesn't exist
		// Try again with the default one
		tilesetMeta = await getTilesetMetadataFromIdentifier(
			defaultSettings.tileset
		)
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

const customTilesetLoader = document.querySelector<HTMLInputElement>(
	"#customTilesetLoader"
)!

function promptCustomTilesetImage(): Promise<HTMLImageElement> {
	return new Promise((res, rej) => {
		customTilesetLoader.value = ""
		const tilesetListener = async () => {
			customTilesetLoader.removeEventListener("change", tilesetListener)
			const file = customTilesetLoader.files?.[0]
			customTilesetLoader.value = ""
			if (!file) return
			const image = await makeImagefromBlob(file)
			if (image.naturalHeight !== image.naturalWidth * 2) {
				alert("This doesn't seem like a CC2 tileset.")
				return rej()
			}
			res(image)
		}
		customTilesetLoader.addEventListener("change", tilesetListener)
		customTilesetLoader.click()
	})
}

async function saveImageAsTileset(image: HTMLImageElement): Promise<void> {
	const tileSize = image.naturalWidth / 16
	const nowTime = Date.now()
	// TODO Somehow determine the wire width??
	const tset: ExternalTilesetMetadata = {
		type: "external",
		identifier: `custom ${nowTime}`,
		title: "A custom tileset",
		description: "This is a custom tileset",
		credits: "Unknown",
		tileSize,
		wireWidth: 2 / 32,
		image: reencodeImage(image),
	}
	await saveTileset(tset)
}

export async function openTilesetSelectortDialog(
	currentTileset: string
): Promise<string | null> {
	resetListeners(tilesetSelectDialog)
	const tableBody = tilesetSelectDialog.querySelector("tbody")!

	async function makeTilesetList(): Promise<void> {
		const allTilesets = await getAllTilesets()
		// Nuke all current data
		tableBody.textContent = ""
		for (const tset of allTilesets) {
			const row = document.createElement("tr")
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
			if (tset.type === "external") {
				const removeButton = document.createElement("button")
				removeButton.classList.add("removeTilesetButton")
				removeButton.textContent = "❌"
				removeButton.type = "button"
				removeButton.addEventListener("click", () => {
					removeTileset(tset.identifier).then(makeTilesetList)
				})
				row.appendChild(makeTd(removeButton))
			}
			tableBody.appendChild(row)
			row.addEventListener("click", () => {
				radioButton.click()
			})
		}
	}

	await makeTilesetList()

	const addButton =
		tilesetSelectDialog.querySelector<HTMLButtonElement>("#addTilesetButton")!
	addButton.addEventListener("click", () => {
		promptCustomTilesetImage()
			.then(image => saveImageAsTileset(image))
			.then(makeTilesetList)
	})

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
