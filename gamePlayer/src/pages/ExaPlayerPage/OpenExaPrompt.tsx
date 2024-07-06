import { Dialog } from "@/components/Dialog"
import { PromptComponent, showPrompt } from "@/prompts"
import { HashSettings, Route as RouteFile } from "@notcc/logic"
import { Getter, Setter } from "jotai"
import { useState } from "preact/hooks"
import { levelAtom } from "@/levelData"
import { pageAtom, pageNameAtom } from "@/routing"
import { preferenceAtom } from "@/preferences"
import { Expl } from "@/components/Expl"

export type ExaNewEvent = {
	type: "new"
	model: MoveModel
	hashSettings?: HashSettings
}

export type ExaOpenEvent = ExaNewEvent | { type: "open"; file: RouteFile }

export type MoveModel = "linear" | "tree" | "graph"

function HashSettingsInput(props: {
	settings: HashSettings
	disabled?: boolean
	onChange?: (settings: HashSettings) => void
}) {
	function Input(props2: {
		name: string
		id: HashSettings
		desc: string
		disabled?: boolean
	}) {
		return (
			<div>
				<label>
					<input
						type="checkbox"
						disabled={props2.disabled}
						checked={!!(props.settings & props2.id)}
						onChange={() => {
							props.onChange?.(
								(props.settings & ~props2.id) |
									(props.settings & props2.id ? 0 : props2.id)
							)
						}}
					/>{" "}
					{props2.name}
				</label>
				<Expl>{props2.desc}</Expl>
			</div>
		)
	}
	return (
		<fieldset disabled={props.disabled} class="disabled:text-neutral-400">
			<label>
				Check tick parity for:{" "}
				<select
					value={
						!(props.settings & HashSettings.IGNORE_MIMIC_PARITY)
							? "mimic"
							: !(props.settings & HashSettings.IGNORE_TEETH_PARITY)
								? "teeth"
								: "none"
					}
					onChange={ev => {
						props.onChange?.(
							(props.settings &
								~(
									HashSettings.IGNORE_TEETH_PARITY |
									HashSettings.IGNORE_MIMIC_PARITY
								)) |
								(ev.currentTarget.value !== "mimic"
									? HashSettings.IGNORE_MIMIC_PARITY
									: 0) |
								(ev.currentTarget.value !== "teeth"
									? HashSettings.IGNORE_TEETH_PARITY
									: 0)
						)
					}}
				>
					<option value="none">none</option>
					<option value="teeth">teeth (8 ticks)</option>
					<option value="mimic">floor mimic (16 ticks)</option>
				</select>
			</label>
			<Expl>
				If set to anything other than none, tick parity will be taken account
				when calculating the hash. Only use if the selected monster is in the
				level and affects routing.
			</Expl>
			<br />
			<Input
				id={HashSettings.IGNORE_BLOCK_ORDER}
				name="Ignore block order"
				desc="If set, blocks will be ignored in the monster order, and considered
					separately. When set, two blocks can swap places and the level state
					will be the same."
			/>
			<Input
				id={HashSettings.IGNORE_PLAYER_DIRECTION}
				name="Ignore player direction"
				desc="If set, the player's facing direction (while not sliding) will not
				matter when comparing level state. This should be unset for levels with
				block slapping."
			/>
			<Input
				id={0 as HashSettings}
				disabled
				name="Ignore player bonk state"
				desc="If set, player bonk state from last tick info will not matter when comparing level
				state. This only affects levels with mirror players, and should
				be set otherwise."
			/>
		</fieldset>
	)
}

export const DEFAULT_HASH_SETTINGS: HashSettings =
	HashSettings.IGNORE_TEETH_PARITY |
	HashSettings.IGNORE_MIMIC_PARITY |
	HashSettings.IGNORE_BLOCK_ORDER

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
			<legend>
				Select ExaCC move model:
				<Expl>
					The move model determines how the inputs will be tracked. More complex
					move models make routing easier, but are harder to grasp and require
					more system resources.
				</Expl>
			</legend>
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
					<input type="radio" name="moveMode" value="linear" defaultChecked />{" "}
					Linear
				</label>
				<Expl>
					The SuperCC experience. There is one move sequence, adding inputs over
					existing moves overwrites them.
				</Expl>
				<br />
				<label>
					<input disabled type="radio" name="moveMode" value="tree" /> Tree
				</label>
				<Expl>
					The MVS experience. Adding inputs over existing moves creates a new
					branch containing the input and all previous moves.
				</Expl>
				<br />
				<label>
					<input type="radio" name="moveMode" value="graph" /> Graph
				</label>
				<Expl>
					Move sequences are treated as bridges between level states, new inputs
					creating and merging branches as necessary. Different level states
					with effectively equal positions can be manually tied to be treated as
					the same level state.
				</Expl>
			</fieldset>
			<h3 class="mt-2">
				Hash settings
				<Expl>
					Graph mode deems two level states identical if their hashes are equal.
					By ignoring some of the level state when calculating the hash, two
					level states which have minor, unimportant differences will be
					considered as the same state.
				</Expl>
			</h3>
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
				buttons={[["Cancel", () => props.onResolve(null)]]}
				onClose={() => props.onResolve(null)}
			>
				{" "}
				<div class="flex w-[40vw] flex-row">
					<NewProject onSubmit={props.onResolve} toggleMode={toggleMode} />
					{/* <NewProject onSubmit={props.onResolve} /> */}
					{/* <OpenProject /> */}
				</div>
			</Dialog>
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
