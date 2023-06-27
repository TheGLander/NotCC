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
	preventNonLegalGlitches: boolean
	preventSimultaneousMovement: boolean
}

export const defaultSettings: Settings = {
	mainTheme: { hue: 212, saturation: 80 },
	tileset: "cga16",
	preventNonLegalGlitches: true,
	preventSimultaneousMovement: true,
}

const settingsDialog =
	document.querySelector<HTMLDialogElement>("#settingsDialog")!

export function openSettingsDialog(pager: Pager): void {
	resetListeners(settingsDialog)
	const newSettings = clone(pager.settings)
	function makeSettingsPreference<T extends HTMLElement = HTMLElement>(
		id: string,
		call: (el: T) => void | Promise<void>,
		apply: (el: T) => void
	): void {
		const el = settingsDialog.querySelector<T>(`#${id}`)!
		el.addEventListener("click", async () => {
			await call(el)
			apply(el)
		})
		apply(el)
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

	makeSettingsPreference<HTMLInputElement>(
		"preventNonLegalGlitches",
		el => {
			newSettings.preventNonLegalGlitches = el.checked
		},
		el => {
			el.checked = newSettings.preventNonLegalGlitches
		}
	)

	makeSettingsPreference<HTMLInputElement>(
		"preventSimulMovement",
		el => {
			newSettings.preventSimultaneousMovement = el.checked
		},
		el => {
			el.checked = newSettings.preventSimultaneousMovement
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
