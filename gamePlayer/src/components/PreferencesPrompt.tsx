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
import { getTruePreferenceAtom } from "@/preferences"

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
		const fauxAtom = useMemo(() => atom(defaultValue), [defaultValue])
		prefAtoms.push([trueAtom!, fauxAtom])
		const [val, setVal] = useAtom(fauxAtom)
		return <props.Display value={val} set={setVal} />
	}
	const savePrefs = () => {
		for (const [trueAtom, fauxAtom] of prefAtoms) {
			set(trueAtom, get(fauxAtom))
		}
	}

	return (
		<Dialog
			header="Preferences"
			section={
				<div class="grid grid-cols-2">
					<h3 class="col-span-2 text-xl">Colors</h3>
					<Pref atom={colorSchemeAtom} Display={ColorSchemePrefDisplay} />
				</div>
			}
			buttons={[
				["Ok", () => savePrefs()],
				["Discard", () => {}],
			]}
			onResolve={onResolve}
		/>
	)
}
