import { GameRenderer } from "@/components/GameRenderer"
import { useSwrLevel } from "@/levelData"
import { atom, useAtomValue } from "jotai"
import { LinearModel } from "./models/linear"
import { GraphModel } from "./models/graph"
import { Ref, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks"
import {
	CameraType,
	KeyInputs,
	LevelState,
	keyInputToChar,
	makeEmptyInputs,
} from "@notcc/logic"
import { tilesetAtom } from "@/components/Preloader"
import { TimeoutTimer, useJotaiFn } from "@/helpers"
import { keyToInputMap } from "@/inputs"
import { openExaCC as openExaCCgs } from "./OpenExaPrompt"
import { Inventory } from "@/components/Inventory"

export const modelAtom = atom<LinearModel | GraphModel | null>(null)
// function useModel() {
// 	const [model, setModel] = useAtom(modelAtom)
// 	return (fn: (model: LinearModel | GraphModel) => void) => {
// 		fn(model!)
// 		setModel(model)
// 	}
// }

function Render(props: {
	level: { current: LevelState }
	renderRef: Ref<(() => void) | undefined>
}) {
	const tileset = useAtomValue(tilesetAtom)
	const cameraType = useMemo<CameraType>(
		() => ({
			width: Math.min(32, props.level.current.width),
			height: Math.min(32, props.level.current.height),
			screens: 1,
		}),
		[props.level]
	)
	return (
		<GameRenderer
			renderRef={props.renderRef}
			level={props.level}
			tileScale={3}
			tileset={tileset!}
			cameraType={cameraType}
		/>
	)
}

function Inv(props: {
	level: { current: LevelState }
	renderRef: Ref<(() => void) | undefined>
}) {
	const tileset = useAtomValue(tilesetAtom)
	return (
		<Inventory
			inventory={props.level.current.selectedPlayable!.inventory}
			renderRef={props.renderRef}
			tileset={tileset!}
			tileScale={3}
		/>
	)
}

function LinearView(props: { model: LinearModel; inputs: KeyInputs }) {
	return (
		<div class="bg-theme-950 h-full w-full rounded font-mono [line-break:anywhere] [overflow-wrap:anywhere]">
			<span>{props.model.moveSeq.displayMoves.join("")}</span>
			<span>{keyInputToChar(props.inputs, false, true)}</span>
		</div>
	)
}

function GraphView(props: {
	model: GraphModel
	inputs: KeyInputs
	updateLevel: () => void
}) {
	return (
		<div>
			<div class="bg-theme-950 h-full w-full rounded">
				{Array.from(props.model.nodeHashMap.values()).map(node => (
					<div
						onClick={() => {
							props.model.goTo(node)
							props.updateLevel()
						}}
					>
						{node === props.model.current && "> "}
						{node === props.model.rootNode
							? "root"
							: node.major
							  ? "major"
							  : "minor"}{" "}
						{(node.hash >>> 0).toString(16)}:{" "}
						{node.outConns.size === 0 && "none"}
						{Array.from(node.outConns.entries())
							.map(
								([node, seqs]) =>
									` to ${(node.hash >>> 0).toString(16)}: ${seqs
										.map(seq => seq.displayMoves.join(""))
										.join()}`
							)
							.join(";")}
					</div>
				))}
			</div>
			<button
				onClick={() => {
					props.model.undo()
					props.updateLevel()
				}}
			>
				Undo
			</button>
			<button
				onClick={() => {
					props.model.redo()
					props.updateLevel()
				}}
			>
				Redo
			</button>
		</div>
	)
}
export function ExaPlayerPage() {
	const levelData = useSwrLevel()
	if (!levelData) return <div class="box m-auto">Loading™ level...</div>

	const model = useAtomValue(modelAtom)!
	const openExaCC = useJotaiFn(openExaCCgs)
	if (!model) {
		openExaCC()
		return <></>
	}
	const renderRef1 = useRef<() => void>()
	const renderRef2 = useRef<() => void>()
	function render() {
		renderRef1.current?.()
		renderRef2.current?.()
	}
	const levelRef = useMemo(
		() => ({
			get current() {
				return model.level
			},
			set current(_level) {},
		}),
		[model]
	)

	const [, setDummyState] = useState(false)

	function updateLevel() {
		setDummyState(ds => !ds)
		render()
	}

	// Inputs
	const [inputs, setInputs] = useState(makeEmptyInputs)

	const inputRef = useRef(inputs)
	useLayoutEffect(() => {
		function setInput(inputsNeue: KeyInputs) {
			inputRef.current = inputsNeue
			setInputs(inputsNeue)
		}
		function finalizeInput() {
			timer = null
			try {
				model.addInput(inputRef.current, model.level)
				render()
			} finally {
				setInput(makeEmptyInputs())
			}
		}
		let timer: TimeoutTimer | null = null
		const listener = (ev: KeyboardEvent) => {
			const input = keyToInputMap[ev.code]
			if (input === undefined) return
			if (
				input === "up" ||
				input === "right" ||
				input === "down" ||
				input === "left"
			) {
				setInput({ ...inputRef.current, [input]: true })
				if (timer === null) {
					timer = new TimeoutTimer(finalizeInput, 0.05)
				}
			} else {
				setInput({ ...inputRef.current, [input]: !inputRef.current[input] })
			}
		}
		document.addEventListener("keydown", listener)
		return () => {
			document.removeEventListener("keydown", listener)
			timer?.cancel()
		}
	}, [model])

	return (
		<div class="flex h-full w-full">
			<div class="m-auto grid items-center justify-center gap-2 [grid-template:auto_1fr/auto_1fr]">
				<div class="box row-span-2">
					<Render level={levelRef} renderRef={renderRef1} />
				</div>
				{/* <div class="flex flex-col gap-2"> */}
				<div class="box col-start-2 flex flex-row gap-2">
					<Inv level={levelRef} renderRef={renderRef2} />
					<div>blablahlblahblahhahah</div>
				</div>
				<div class="box col-start-2 h-full flex-1">
					{model instanceof LinearModel && (
						<LinearView model={model} inputs={inputs} />
					)}
					{model instanceof GraphModel && (
						<GraphView
							model={model}
							inputs={inputs}
							updateLevel={updateLevel}
						/>
					)}
				</div>
				{/* </div> */}
			</div>
		</div>
	)
}
