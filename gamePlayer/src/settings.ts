import { Pager } from "./pager"
import clone from "clone"
import { ThemeColors, applyTheme, openThemeSelectorDialog } from "./themes"
import { resetListeners } from "./utils"
import {
	getTilesetMetadataFromIdentifier,
	openTilesetSelectortDialog,
} from "./tilesets"

export type SetListPreviewLevel = "title" | "level preview"

export interface Settings {
	mainTheme: ThemeColors
	tileset: string
}

export const defaultSettings: Settings = {
	mainTheme: { hue: 212, saturation: 80 },
	tileset: "cga16",
}

const settingsDialog =
	document.querySelector<HTMLDialogElement>("#settingsDialog")!

export function openSettingsDialog(pager: Pager): void {
	resetListeners(settingsDialog)
	const newSettings = clone(pager.settings)
	function makeSettingsPreference(
		id: string,
		call: () => Promise<void>,
		apply: (el: HTMLButtonElement) => void
	): void {
		const button = settingsDialog.querySelector<HTMLButtonElement>(`#${id}`)!
		button.addEventListener("click", async () => {
			await call()
			apply(button)
		})
		apply(button)
	}
	makeSettingsPreference(
		"mainTheme",
		() =>
			openThemeSelectorDialog(newSettings.mainTheme, pager).then(color => {
				if (color !== null) {
					newSettings.mainTheme = color
				}
			}),
		el => applyTheme(el, newSettings.mainTheme)
	)

	const currentTilesetText = settingsDialog.querySelector<HTMLSpanElement>(
		"#currentTilesetText"
	)!
	makeSettingsPreference(
		"currentTileset",
		() =>
			openTilesetSelectortDialog(newSettings.tileset).then(tset => {
				if (tset !== null) {
					newSettings.tileset = tset
				}
			}),
		async () => {
			const tsetMeta = await getTilesetMetadataFromIdentifier(
				newSettings.tileset
			)
			currentTilesetText.textContent = tsetMeta?.title ?? "Unknown tileset"
		}
	)

	const closeListener = () => {
		if (settingsDialog.returnValue === "ok") {
			pager.saveSettings(newSettings)
		}
		settingsDialog.removeEventListener("close", closeListener)
	}

	settingsDialog.addEventListener("close", closeListener)

	settingsDialog.showModal()
}
