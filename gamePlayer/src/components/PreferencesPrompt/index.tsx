import { PromptComponent } from "@/prompts"
import { Dialog } from "../Dialog"
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
import { TilesetPrefDisplay, tilesetIdAtom } from "./TilesetsPrompt"
import { SfxPrefDisplay, sfxIdAtom } from "./SfxPrompt"
import { Expl } from "../Expl"
import { exaComplainAboutNonlegalGlitches } from "@/pages/ExaPlayerPage"
import { endOnNonlegalGlitchAtom } from "@/pages/LevelPlayerPage"

export type PrefDisplayProps<T, P = {}> = P & {
	set: (val: T) => void
	value: T
	inputId: string
}

function ColorSchemePrefDisplay({
	set,
	value,
	inputId,
}: PrefDisplayProps<ThemeColor>) {
	return (
		<select
			id={inputId}
			value={value}
			onInput={ev => {
				const newColorScheme = (ev.target as HTMLSelectElement)
					.value as ThemeColor
				set(newColorScheme)
			}}
		>
			{listThemeColors().map(color => (
				<option value={color}>{color}</option>
			))}
		</select>
	)
}

function BinaryDisplayPref({ value, set, inputId }: PrefDisplayProps<boolean>) {
	return (
		<span class="flex">
			<input
				type="checkbox"
				class="align-middle"
				checked={value}
				id={inputId}
				onInput={ev => {
					set(ev.currentTarget.checked)
				}}
			/>
		</span>
	)
}

interface PrefProps<T, P = {}> {
	Display: FC<PrefDisplayProps<T> & P>
	atom: WritableAtom<T, [T], void>
	label: string
	expl?: string
	props?: P
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
		const inputId = useId()
		return (
			<>
				<label for={inputId} class="mr-2">
					{props.label}:
					{props.expl && (
						<Expl mode="dialog" title={props.label}>
							{props.expl}
						</Expl>
					)}
				</label>
				<props.Display
					value={val === DEFAULT_VALUE ? defaultedDefaultValue : val}
					set={setVal}
					inputId={inputId}
					{...(props.props ?? {})}
				/>
			</>
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
			<div class="grid grid-cols-2 gap-1">
				<h3 class="col-span-2 text-xl">Visuals</h3>
				<Pref
					atom={colorSchemeAtom}
					label="Color scheme"
					Display={ColorSchemePrefDisplay}
				/>
				<Pref
					atom={tilesetIdAtom}
					label="Tileset"
					Display={TilesetPrefDisplay}
				/>
				<h3 class="col-span-2 text-xl">Audio</h3>
				<Pref atom={sfxIdAtom} label="Sound effects" Display={SfxPrefDisplay} />
				<h3 class="col-span-2 text-xl">Behavior</h3>
				<Pref
					atom={endOnNonlegalGlitchAtom}
					label="Prevent nonlegal glitches"
					expl="When on, trying to perform a glitch that is not scoreboard-legal will immediately end the current attempt. Must be on for reporting scores."
					Display={BinaryDisplayPref}
				/>
				<h3 class="col-span-2 text-xl">ExaCC</h3>
				<Pref
					atom={exaComplainAboutNonlegalGlitches}
					label="Warn about nonlegal glitches"
					expl="When on, trying to perform a glitch that is not scoreboard-legal will generate a warning message. Keep enabled unless you know what you are doing."
					Display={BinaryDisplayPref}
				/>
			</div>
		</Dialog>
	)
}
