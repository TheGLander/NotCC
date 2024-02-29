import { Dialog } from "@/components/Dialog"
import { PromptComponent, showPrompt } from "@/prompts"
import { Route as RouteFile } from "@notcc/logic"
import { Getter, Setter } from "jotai"
import { useState } from "preact/hooks"
import { levelAtom } from "@/levelData"
import type { HashSettings } from "./hash"
import { pageAtom, pageNameAtom } from "@/routing"
import { preferenceAtom } from "@/preferences"

export type ExaOpenEvent =
	| { type: "new"; model: MoveModel; hashSettings?: HashSettings }
	| { type: "open"; file: RouteFile }

export type MoveModel = "linear" | "tree" | "graph"

function HashSettingsInput(props: {
	settings: HashSettings
	disabled?: boolean
	onChange?: (settings: HashSettings) => void
}) {
	function Input(props2: {
		name: string
		id: keyof HashSettings
		desc: string
	}) {
		return (
			<>
				<label>
					<input
						type="checkbox"
						checked={!!props.settings[props2.id]}
						onChange={ev => {
							props.onChange?.({
								...props.settings,
								[props2.id]: ev.currentTarget.checked,
							})
						}}
					/>{" "}
					{props2.name}
				</label>
				<p class="text-sm">{props2.desc}</p>
			</>
		)
	}
	return (
		<fieldset disabled={props.disabled} class="disabled:text-neutral-400">
			<label>
				Check tick parity for:{" "}
				<select
					value={
						!props.settings.ignoreFloorMimicParity
							? "mimic"
							: !props.settings.ignoreTeethParity
							  ? "teeth"
							  : "none"
					}
					onChange={ev => {
						props.onChange?.({
							...props.settings,
							ignoreFloorMimicParity: ev.currentTarget.value !== "mimic",
							ignoreTeethParity: ev.currentTarget.value !== "teeth",
						})
					}}
				>
					<option value="none">none</option>
					<option value="teeth">teeth (8 ticks)</option>
					<option value="mimic">floor mimic (16 ticks)</option>
				</select>
			</label>
			<p class="text-sm">
				If set to anything other than None, tick parity will be taken account
				for level state discrimination purposes. Only use if the selected
				monster is in the level and affects routing.
			</p>
			<Input
				id="ignoreBlockOrder"
				name="Ignore block order"
				desc="If set, blocks will be ignored in the monster order, and considered
					separately. When set, two blocks can swap places and the level state
					will be the same."
			/>
			<Input
				id="ignorePlayerDir"
				name="Ignore player direction"
				desc="If set, the player's facing direction (while not sliding) will not
				matter when comparing level state. This should be unset for levels with
				block slapping."
			/>
			<Input
				id="ignorePlayerBump"
				name="Ignore mirror player buffered inputs"
				desc="If set, buffered decision info will not matter when comparing level
				state. This only affects levels with mirror players, and should
				be set otherwise."
			/>
		</fieldset>
	)
}

export const DEFAULT_HASH_SETTINGS: HashSettings = {
	ignoreFloorMimicParity: true,
	ignoreTeethParity: true,
	ignoreBlockOrder: true,
	ignorePlayerBump: true,
}

function NewProject(props: {
	onSubmit: (ev: ExaOpenEvent & { byDefault: boolean }) => void
	toggleMode?: boolean
}) {
	const [moveModel, setMoveModel] = useState<MoveModel>("linear")
	const [hashSettings, setHashSettings] = useState<HashSettings>(
		DEFAULT_HASH_SETTINGS
	)
	const [useByDefault, setUseByDefault] = useState(false)
	const createNewModel = (ev: Event) => {
		ev.preventDefault()
		props.onSubmit({
			type: "new",
			model: moveModel,
			hashSettings,
			byDefault: !!props.toggleMode && useByDefault,
		})
	}
	return (
		<form onSubmit={createNewModel} class="flex-1">
			<h3 class="text-xl">New</h3>
			<legend>Select ExaCC move model:</legend>
			<fieldset
				class="pl-2"
				onChange={ev => {
					setMoveModel(
						//@ts-ignore
						ev.currentTarget.parentElement.elements.namedItem("moveMode").value
					)
				}}
			>
				<label>
					<input type="radio" name="moveMode" value="linear" /> Linear
				</label>
				<p class="text-sm">
					The SuperCC experience. There is one move sequence, adding inputs over
					existing moves overwrites them.
				</p>
				<label>
					<input disabled type="radio" name="moveMode" value="tree" /> Tree
				</label>
				<p class="text-sm">
					The MVS experience. Adding inputs over existing moves creates a new
					branch containing the input and all previous moves.
				</p>
				<label>
					<input type="radio" name="moveMode" value="graph" /> Graph
				</label>
				<p class="text-sm">
					Move sequences are treated as bridges between level states, new inputs
					creating and merging branches as necessary. Different level states
					with effectively equal positions can be manually tied to be treated as
					the same level state.
				</p>
			</fieldset>
			<h3 class="mt-2">Hash settings</h3>
			<div class="pl-2">
				<HashSettingsInput
					settings={hashSettings}
					onChange={setHashSettings}
					disabled={moveModel !== "graph"}
				/>
				{props.toggleMode && (
					<label>
						<input
							type="checkbox"
							checked={useByDefault}
							onChange={ev => setUseByDefault(ev.currentTarget.checked)}
						/>{" "}
						Always use this configuration when toggling into ExaCC
					</label>
				)}
			</div>

			<button type="submit">New project</button>
		</form>
	)
}

export const OpenExaPrompt: (props: {
	toggleMode: boolean
}) => PromptComponent<(ExaOpenEvent & { byDefault?: boolean }) | null> =
	({ toggleMode }) =>
	props => {
		return (
			<Dialog
				header="ExaCC Studio"
				section={
					<div class="flex flex-row">
						<NewProject onSubmit={props.onResolve} toggleMode={toggleMode} />
						{/* <NewProject onSubmit={props.onResolve} /> */}
						{/* <OpenProject /> */}
					</div>
				}
				buttons={[["Cancel", () => props.onResolve(null)]]}
				onClose={() => props.onResolve(null)}
			/>
		)
	}

export const exaToggleConfig = preferenceAtom<ExaOpenEvent | null>(
	"exaToggleConfig",
	null
)

export async function toggleExaCC(get: Getter, set: Setter) {
	const pageName = get(pageNameAtom)
	if (pageName === "exa") {
		set(pageAtom, "play")
	} else {
		const levelData = await get(levelAtom)
		if (!levelData) return
		let config = get(exaToggleConfig)
		if (!config) {
			const openEv = await showPrompt(
				get,
				set,
				OpenExaPrompt({ toggleMode: true })
			)
			if (openEv?.byDefault) {
				set(exaToggleConfig, openEv)
			}
			config = openEv
		}
		if (!config) return
		const realIndex = await import("./exaPlayer")
		realIndex.openExaCCReal(get, set, config, levelData)
	}
}

export async function openExaCC(get: Getter, set: Setter) {
	const levelData = await get(levelAtom)
	if (!levelData) return
	const openEv = await showPrompt(
		get,
		set,
		OpenExaPrompt({ toggleMode: false })
	)
	if (!openEv) return
	const realIndex = await import("./exaPlayer")
	realIndex.openExaCCReal(get, set, openEv, levelData)
}
