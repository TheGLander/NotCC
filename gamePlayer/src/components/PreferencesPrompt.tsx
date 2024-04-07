import { PromptComponent } from "@/prompts"
import { Dialog } from "./Dialog"
import { ThemeColor, colorSchemeAtom, listThemeColors } from "@/themeHelper"
import { useId, useMemo } from "preact/hooks"
import {
	PrimitiveAtom,
	WritableAtom,
	atom,
	useAtom,
	useAtomValue,
	useStore,
} from "jotai"
import { FC } from "preact/compat"
import { DEFAULT_VALUE, getTruePreferenceAtom } from "@/preferences"

interface PrefDisplayProps<T> {
	set: (val: T) => void
	value: T
}

function ColorSchemePrefDisplay({ set, value }: PrefDisplayProps<ThemeColor>) {
	const themeColorsId = useId()
	return (
		<>
			<label for={themeColorsId}>Color scheme:</label>
			<select
				id={themeColorsId}
				value={value}
				onInput={ev => {
					const newColorScheme = (ev.target as HTMLSelectElement)
						.value as ThemeColor
					set(newColorScheme)
					// if (dialogRef.current) {
					// 	const cssVars = makeThemeCssVars(newColorScheme)
					// 	for (const [key, val] of Object.entries(cssVars)) {
					// 		dialogRef.current.style.setProperty(key, val)
					// 	}
					// }
				}}
			>
				{listThemeColors().map(color => (
					<option value={color}>{color}</option>
				))}
			</select>
		</>
	)
}

interface PrefProps<T> {
	Display: FC<PrefDisplayProps<T>>
	atom: WritableAtom<T, [T], void>
}

export const PreferencesPrompt: PromptComponent<void> = ({ onResolve }) => {
	const { get, set } = useStore()
	const prefAtoms: [PrimitiveAtom<any>, PrimitiveAtom<any>][] = []
	function Pref<T>(props: PrefProps<T>) {
		const trueAtom = useMemo(
			() => getTruePreferenceAtom(props.atom),
			[props.atom]
		)
		const defaultValue = useAtomValue(trueAtom!) as T
		const defaultedDefaultValue = useAtomValue(props.atom)
		const fauxAtom = useMemo(() => atom(defaultValue), [defaultValue])
		prefAtoms.push([trueAtom!, fauxAtom])
		const [val, setVal] = useAtom(fauxAtom)
		return (
			<props.Display
				value={val === DEFAULT_VALUE ? defaultedDefaultValue : val}
				set={setVal}
			/>
		)
	}
	const savePrefs = () => {
		for (const [trueAtom, fauxAtom] of prefAtoms) {
			set(trueAtom, get(fauxAtom))
		}
	}

	return (
		<Dialog
			header="Preferences"
			buttons={[
				["Ok", () => savePrefs()],
				["Discard", () => {}],
			]}
			onResolve={onResolve}
		>
			<div class="grid grid-cols-2">
				<h3 class="col-span-2 text-xl">Colors</h3>
				<Pref atom={colorSchemeAtom} Display={ColorSchemePrefDisplay} />
			</div>
		</Dialog>
	)
}
