import { Pager } from "./pager"
import { resetListeners } from "./utils"

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
