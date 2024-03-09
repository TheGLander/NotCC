import colors from "tailwindcss/colors"
import { preferenceAtom } from "./preferences"

export const colorSchemeAtom = preferenceAtom<ThemeColor>("colorScheme", "blue")

const badColors = [
	"inherit",
	"transparent",
	"black",
	"white",
	"current",
	"lightBlue",
	"warmGray",
	"coolGray",
	"trueGray",
	"blueGray",
] as const

export type ThemeColor = keyof Omit<typeof colors, (typeof badColors)[number]>
function hexToChannels(hex: string): string {
	return hex
		.slice(1)
		.split(/(?<=^(?:.{2}|.{4}))/g)
		.map(channel => parseInt(channel, 16))
		.join(" ")
}

export function listThemeColors(): ThemeColor[] {
	return Object.keys(colors).filter(
		(color): color is ThemeColor =>
			!(badColors as readonly string[]).includes(color)
	)
}

export function makeThemeCssVars(
	colorName: ThemeColor
): Record<string, string> {
	return Object.fromEntries(
		Object.entries(colors[colorName]).map(([colorShade, color]) => [
			`--theme-${colorShade}`,
			hexToChannels(color),
		])
	)
}
