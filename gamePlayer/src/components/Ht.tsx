import { preferenceAtom } from "@/preferences"
import { atom, useAtomValue } from "jotai"
import { ComponentChildren } from "preact"

export type HaikuMode = "on" | "auto" | "off"

export const haikuModePreferenceAtom = preferenceAtom<"on" | "auto" | "off">(
	"haikuMode",
	"auto"
)
export const haikuModeAtom = atom((get, _set) => {
	const haikuMode = get(haikuModePreferenceAtom)
	if (haikuMode === "auto") {
		const date = new Date()
		return date.getMonth() == 3 && date.getDate() === 1
	}
	return haikuMode === "on"
})

export function Ht(props: { haiku: string; children: ComponentChildren }) {
	const haikuMode = useAtomValue(haikuModeAtom)
	if (haikuMode) {
		return (
			<>
				{props.haiku.split("/").map((str, idx) => (
					<>
						{idx === 0 || <br />}
						{str}
					</>
				))}
			</>
		)
	}
	return <>{haikuMode ? props.haiku : props.children}</>
}
