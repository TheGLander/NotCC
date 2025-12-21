import { Dialog } from "@/components/Dialog"
import { PromptComponent, showAlertGs, showPromptGs } from "@/prompts"
import { HashSettings, Route } from "@notcc/logic"
import { Getter, Setter, useAtomValue } from "jotai"
import { useCallback, useEffect, useState } from "preact/hooks"
import { LevelData, levelAtom, levelSetAtom } from "@/levelData"
import {
	levelNAtom,
	levelSetIdentAtom,
	pageAtom,
	pageNameAtom,
} from "@/routing"
import { preferenceAtom } from "@/preferences"
import { Expl } from "@/components/Expl"
import type { AnyProjectSave, ExaProj, RouteLocation } from "./exaProj"
import { useJotaiFn, usePromise } from "@/helpers"
import { basename, join } from "path"
import { exists, readDir, readJson, showLoadPrompt } from "@/fs"

export type ExaNewEvent = {
	type: "new"
	model: MoveModel
	hashSettings?: HashSettings
}

export type ExaOpenEvent = { type: "open"; save: AnyProjectSave; path?: string }

export type ExaInitEvent = ExaNewEvent | ExaOpenEvent

export type MoveModel = "linear" | "tree" | "graph"

export type FoundProjectFile = {
	path: string
} & ({ isRoute: true; contents: Route } | { isRoute: false; contents: ExaProj })

export async function findRouteFiles(
	location: RouteLocation
): Promise<FoundProjectFile[]> {
	if (!(await exists(join("/routes", location.setIdent)))) return []
	const files: FoundProjectFile[] = []
	for (const file of await readDir(join("/routes", location.setIdent))) {
		const filePath = join("/routes", location.setIdent, file)
		if (!file.startsWith(location.levelN.toString())) continue
		if (location.path && filePath !== location.path) continue
		// @ts-ignore
		const routeFile: FoundProjectFile = {
			path: filePath,
			isRoute: file.endsWith(".route"),
			contents: await readJson(filePath),
		}
		files.push(routeFile)
	}
	return files
}

export function getModelTypeFromSave(save: AnyProjectSave) {
	if ("Moves" in save) return "route"
	return "graph"
}

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
	onSubmit: (ev: ExaNewEvent & { byDefault: boolean }) => void
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
			byDefault: useByDefault,
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
				<label>
					<input
						type="checkbox"
						checked={useByDefault}
						onChange={ev => setUseByDefault(ev.currentTarget.checked)}
					/>{" "}
					Always use this configuration when toggling into ExaCC
				</label>
			</div>

			<button type="submit">New project</button>
		</form>
	)
}
function OpenProject(props: {
	onSubmit: (ev: ExaOpenEvent) => void
	setLocation?: RouteLocation
}) {
	const loadedProjectsRes = usePromise(
		() =>
			props.setLocation
				? findRouteFiles(props.setLocation)
				: Promise.resolve(null),
		[props.setLocation]
	)
	useEffect(() => {
		if (loadedProjectsRes.state === "error") {
			console.error(loadedProjectsRes.error)
		}
	}, [loadedProjectsRes.state])
	const showAlert = useJotaiFn(showAlertGs)
	const importProject = useCallback(async () => {
		const res = await showLoadPrompt("Load project", {
			filters: [
				{ name: "ExaCC project", extensions: ["exaproj"] },
				{ name: "Routefile", extensions: ["route"] },
			],
		})
		if (!res) return
		const importedFile: AnyProjectSave = JSON.parse(await res[0].text())
		if (!("Moves" in importedFile) && !("Model" in importedFile)) {
			showAlert(
				<>
					Loaded file doesn't appear to be a Routefile or ExaProject, are you
					sure you loaded the correct file?
				</>,
				"Invalid file"
			)
			return
		}
		props.onSubmit({ type: "open", save: importedFile })
	}, [])
	return (
		<div class="flex w-[20rem] flex-col gap-1">
			<h3 class="text-xl">Open</h3>
			{props.setLocation ? (
				<div>
					Existing projects for {props.setLocation.setName} #
					{props.setLocation.levelN}:
				</div>
			) : (
				<div>No saved projects for level outside of a set</div>
			)}
			<div class="bg-theme-950 flex flex-1 flex-col gap-1 rounded p-1">
				{loadedProjectsRes.state !== "done" ||
				!loadedProjectsRes.value ||
				loadedProjectsRes.value.length === 0 ? (
					<div class="m-auto">
						{loadedProjectsRes.state === "error"
							? "Failed to load local project files"
							: loadedProjectsRes.state === "working"
								? "Loading..."
								: "No project files found"}
					</div>
				) : (
					<>
						{loadedProjectsRes.value.map(proj => (
							<div
								key={proj.path}
								class="hover:bg-theme-900 cursor-pointer rounded p-0.5"
								onClick={() =>
									props.onSubmit({
										type: "open",
										save: proj.contents,
										path: proj.path,
									})
								}
							>
								{getModelTypeFromSave(proj.contents) === "route"
									? "Route"
									: "Graph"}{" "}
								- {basename(proj.path)}
							</div>
						))}
					</>
				)}
			</div>
			<div>
				<button onClick={() => importProject()}>Import project</button>
			</div>
		</div>
	)
}

export const OpenExaPrompt: PromptComponent<
	(ExaInitEvent & { byDefault?: boolean }) | null
> = props => {
	const levelSet = useAtomValue(levelSetAtom)
	const levelN = useAtomValue(levelNAtom)
	const setIdent = useAtomValue(levelSetIdentAtom)
	return (
		<Dialog
			header="ExaCC Studio"
			buttons={[["Cancel", () => props.onResolve(null)]]}
			onClose={() => props.onResolve(null)}
		>
			<div class="flex flex-row">
				<NewProject onSubmit={props.onResolve} />
				<OpenProject
					onSubmit={props.onResolve}
					setLocation={
						levelSet && levelN !== null && setIdent
							? { setName: levelSet.gameTitle(), setIdent, levelN }
							: undefined
					}
				/>
			</div>
		</Dialog>
	)
}

export const exaToggleConfig = preferenceAtom<ExaNewEvent | null>(
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
		await openExaCC(get, set, levelData)
	}
}

export async function openExaCC(
	get: Getter,
	set: Setter,
	levelData: LevelData,
	useDefaultConfig = true
): Promise<boolean> {
	let config: ExaInitEvent | null = null
	if (useDefaultConfig) {
		config = get(exaToggleConfig)
	}
	if (!config) {
		const openEv = await showPromptGs(get, set, OpenExaPrompt)
		if (openEv?.byDefault && openEv.type === "new") {
			set(exaToggleConfig, openEv)
		}
		config = openEv
	}
	if (!config) return false
	const realIndex = await import("./exaPlayer")
	realIndex.openExaCCReal(get, set, config, levelData)
	return true
}
