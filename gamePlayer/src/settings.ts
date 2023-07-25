import { Pager } from "./pager"
import clone from "clone"
import { ThemeColors, applyTheme, openThemeSelectorDialog } from "./themes"
import { resetListeners } from "./utils"
import {
	getTilesetMetadataFromIdentifier,
	openTilesetSelectortDialog,
} from "./tilesets"
import { getPlayerSummary } from "./scoresApi"

export type SetListPreviewLevel = "title" | "level preview"

export interface Settings {
	mainTheme: ThemeColors
	tileset: string
	preventNonLegalGlitches: boolean
	preventSimultaneousMovement: boolean
	optimizerId?: number
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
		event: string,
		call: (el: T) => void | Promise<void>,
		apply: (el: T) => void
	): void {
		const el = settingsDialog.querySelector<T>(`#${id}`)!
		el.addEventListener(event, async () => {
			await call(el)
			apply(el)
		})
		apply(el)
	}

	makeSettingsPreference(
		"mainTheme",
		"click",
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
		"click",
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
		"change",
		el => {
			newSettings.preventNonLegalGlitches = el.checked
		},
		el => {
			el.checked = newSettings.preventNonLegalGlitches
		}
	)

	makeSettingsPreference<HTMLInputElement>(
		"preventSimulMovement",
		"change",
		el => {
			newSettings.preventSimultaneousMovement = el.checked
		},
		el => {
			el.checked = newSettings.preventSimultaneousMovement
		}
	)
	const currentUsername = settingsDialog.querySelector("#currentUsername")!
	makeSettingsPreference<HTMLInputElement>(
		"optimizerId",
		"change",
		el => {
			if (el.value !== "") {
				newSettings.optimizerId = parseInt(el.value)
			} else {
				delete newSettings.optimizerId
			}
		},
		el => {
			if (newSettings.optimizerId === undefined) {
				el.value = ""
				currentUsername.textContent = ""
			} else {
				el.value = newSettings.optimizerId.toString()
				currentUsername.textContent = "..."
				getPlayerSummary(newSettings.optimizerId)
					.then(info => {
						currentUsername.textContent = info.player
					})
					.catch(() => {
						currentUsername.textContent = "???"
					})
			}
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
