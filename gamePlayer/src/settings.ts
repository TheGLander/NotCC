import { Pager } from "./pager"
import rfdc from "rfdc"
import { ThemeColors, applyTheme, openThemeSelectorDialog } from "./themes"
import { resetListeners } from "./utils"

const clone = rfdc()

export interface Settings {
	mainTheme: ThemeColors
}

export const defaultSettings: Settings = {
	mainTheme: { hue: 212, saturation: 80 },
}

const settingsDialog =
	document.querySelector<HTMLDialogElement>("#settingsDialog")!

export function openSettingsDialog(pager: Pager): void {
	resetListeners(settingsDialog)
	const newSettings = clone(pager.settings)

	const mainThemeButton =
		document.querySelector<HTMLButtonElement>("#mainTheme")!
	mainThemeButton.addEventListener("click", () => {
		openThemeSelectorDialog(newSettings.mainTheme, pager).then(color => {
			if (color !== null) {
				newSettings.mainTheme = color
			}
			applyTheme(mainThemeButton, newSettings.mainTheme)
		})
	})
	applyTheme(mainThemeButton, newSettings.mainTheme)

	const closeListener = () => {
		if (settingsDialog.returnValue === "ok") {
			pager.saveSettings(newSettings)
		}
		settingsDialog.removeEventListener("close", closeListener)
	}

	settingsDialog.addEventListener("close", closeListener)

	settingsDialog.showModal()
}
