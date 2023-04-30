import { Pager } from "./pager"
import rfdc from "rfdc"

const clone = rfdc()

function resetListeners(el: HTMLElement) {
	// eslint-disable-next-line no-self-assign
	el.innerHTML = el.innerHTML
}

export const defaultSettings: Settings = {
	mainTheme: { hue: 212, saturation: 80 },
}

export interface ThemeColors {
	hue: number
	saturation: number
}

export function applyTheme(el: HTMLElement, theme: ThemeColors): void {
	el.style.setProperty(
		"--theme-color-huesat",
		`${theme.hue}deg ${theme.saturation}%`
	)
}

export interface Settings {
	mainTheme: ThemeColors
}

const themeSelectorDialog = document.querySelector<HTMLDialogElement>(
	"#themeSelectorDialog"
)!

export function openThemeSelectorDialog(
	defaultTheme: ThemeColors,
	pager?: Pager
): Promise<ThemeColors | null> {
	return new Promise(res => {
		resetListeners(themeSelectorDialog)
		const hueSlider =
			themeSelectorDialog.querySelector<HTMLInputElement>("#themeHue")!
		const saturationSlider =
			themeSelectorDialog.querySelector<HTMLInputElement>("#themeSaturation")!
		hueSlider.value = defaultTheme.hue.toString()
		saturationSlider.value = defaultTheme.saturation.toString()

		function makeTheme(): ThemeColors {
			return {
				hue: parseInt(hueSlider.value, 10),
				saturation: parseInt(saturationSlider.value, 10),
			}
		}
		function updateTheme(): void {
			const theme = makeTheme()
			pager?.setTheme(theme)
		}
		updateTheme()

		hueSlider.addEventListener("change", updateTheme)
		saturationSlider.addEventListener("change", updateTheme)

		const closeListener = () => {
			res(themeSelectorDialog.returnValue === "ok" ? makeTheme() : null)
			pager?.updateTheme()
			themeSelectorDialog.removeEventListener("close", closeListener)
		}

		themeSelectorDialog.addEventListener("close", closeListener)

		themeSelectorDialog.showModal()
	})
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
