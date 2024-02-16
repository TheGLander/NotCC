import { Dialog } from "@/components/Dialog"
import { PromptComponent, showPrompt } from "@/prompts"
import { pageAtom } from "@/routing"
import { Route as RouteFile, createLevelFromData } from "@notcc/logic"
import { Getter, Setter } from "jotai"
import { useCallback, useId } from "preact/hooks"
import { LinearModel } from "./models/linear"
import { GraphModel } from "./models/graph"
import { levelAtom } from "@/levelData"
import { modelAtom } from "."
import { makeLevelHash } from "./hash"

type ExaOpenEvent =
	| { type: "new"; model: MoveModel }
	| { type: "open"; file: RouteFile }

export type MoveModel = "linear" | "tree" | "graph"

function NewProject(props: { onSubmit: (ev: ExaOpenEvent) => void }) {
	const radioName = useId()
	const submitNewProjectForm = useCallback((ev: SubmitEvent) => {
		ev.preventDefault()
		const form = ev.currentTarget as HTMLFormElement
		const moveMode = (form.elements.namedItem(radioName) as RadioNodeList)
			.value as MoveModel
		props.onSubmit({ type: "new", model: moveMode })
	}, [])
	return (
		<form onSubmit={submitNewProjectForm as () => void} class="flex-1">
			<h3 class="text-xl">New</h3>
			<legend>Select ExaCC move model:</legend>
			<div class="pl-2">
				<label>
					<input type="radio" name={radioName} value="linear" checked /> Linear
				</label>
				<p class="text-sm">
					The SuperCC experience. There is one move sequence, adding inputs over
					existing moves overwrites them.
				</p>
				<label>
					<input disabled type="radio" name={radioName} value="tree" /> Tree
				</label>
				<p class="text-sm">
					The MVS experience. Adding inputs over existing moves creates a new
					branch containing the input and all previous moves.
				</p>
				<label>
					<input type="radio" name={radioName} value="Graph" /> Graph
				</label>
				<p class="text-sm">
					Move sequences are treated as bridges between level states, new inputs
					creating and merging branches as necessary. Different level states
					with effectively equal positions can be manually tied to be treated as
					the same level state.
				</p>
			</div>
			<button type="submit">New project</button>
		</form>
	)
}

export const OpenExaPrompt: PromptComponent<ExaOpenEvent | null> = props => {
	return (
		<Dialog
			header="ExaCC Studio"
			section={
				<div class="flex flex-row">
					<NewProject onSubmit={props.onResolve} />
					{/* <NewProject onSubmit={props.onResolve} /> */}
					{/* <OpenProject /> */}
				</div>
			}
			buttons={[["Cancel", () => props.onResolve(null)]]}
		/>
	)
}

export async function openExaCC(get: Getter, set: Setter) {
	const levelData = await get(levelAtom)
	if (!levelData) return
	const openEv = await showPrompt(get, set, OpenExaPrompt)
	if (!openEv || openEv.type !== "new") return
	const level = createLevelFromData(levelData)
	level.tick()
	level.tick()

	let model: LinearModel | GraphModel
	if (openEv.model === "linear") {
		model = new LinearModel(level)
	} else if (openEv.model === "graph") {
		model = new GraphModel(level)
	} else {
		throw new Error("Unsupported model :(")
	}
	//@ts-ignore Temporary
	globalThis.NotCC.exa = { model, makeLevelHash }
	set(pageAtom, "exa")
	set(modelAtom, model)
}
