import { GameRenderer } from "@/components/GameRenderer"
import { Getter, Setter, atom, useAtom, useAtomValue, useSetAtom } from "jotai"
import { LinearModel } from "./models/linear"
import { GraphModel, Node } from "./models/graph"
import {
	Ref,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "preact/hooks"
import {
	CameraType,
	GameState,
	KeyInputs,
	LevelData,
	LevelState,
	calculateLevelPoints,
	createLevelFromData,
	makeEmptyInputs,
} from "@notcc/logic"
import { tilesetAtom } from "@/components/Preloader"
import { TimeoutTimer, useJotaiFn } from "@/helpers"
import { keyToInputMap } from "@/inputs"
import {
	DEFAULT_HASH_SETTINGS,
	ExaNewEvent,
	ExaOpenEvent,
} from "./OpenExaPrompt"
import { Inventory } from "@/components/Inventory"
import { GraphView, MovesList } from "./GraphView"
import { levelNAtom, pageAtom } from "@/routing"
import { makeLevelHash } from "./hash"
import { levelControlsAtom, useSwrLevel } from "@/levelData"
import { modelAtom } from "."
import { calcScale } from "@/components/DumbLevelPlayer"
import { PromptComponent, showPrompt as showPromptGs } from "@/prompts"
import { Dialog } from "@/components/Dialog"

const modelConfigAtom = atom<ExaNewEvent | null>(null)
type Model = LinearModel | GraphModel

export function openExaCCReal(
	_get: Getter,
	set: Setter,
	openEv: ExaOpenEvent,
	levelData: LevelData
) {
	if (openEv.type !== "new") return
	const model = makeModel(levelData, openEv)
	// @ts-ignore Temporary
	globalThis.NotCC.exa = { model, makeLevelHash }
	set(modelConfigAtom, openEv)
	set(pageAtom, "exa")
	set(modelAtom, model)
}

function makeModel(levelData: LevelData, conf: ExaNewEvent): Model {
	const level = createLevelFromData(levelData)
	level.tick()
	level.tick()

	let model: Model
	if (conf.model === "linear") {
		model = new LinearModel(level)
	} else if (conf.model === "graph") {
		model = new GraphModel(level, conf.hashSettings ?? DEFAULT_HASH_SETTINGS)
	} else {
		throw new Error("Unsupported model :(")
	}
	return model
}

// function useModel() {
// 	const [model, setModel] = useAtom(modelAtom)
// 	return (fn: (model: LinearModel | GraphModel) => void) => {
// 		fn(model!)
// 		setModel(model)
// 	}
// }

function Inv(props: {
	level: { current: LevelState }
	renderRef: Ref<(() => void) | undefined>
	tileScale: number
}) {
	const tileset = useAtomValue(tilesetAtom)
	const invRef = useMemo(
		() => ({
			get current() {
				return props.level.current.selectedPlayable!.inventory
			},
			set current(_val) {},
		}),
		[props.level]
	)
	return (
		<Inventory
			inventory={invRef}
			renderRef={props.renderRef}
			tileset={tileset!}
			tileScale={props.tileScale}
		/>
	)
}

function LinearView(props: { model: LinearModel; inputs: KeyInputs }) {
	return (
		<div class="bg-theme-950 h-full w-full rounded">
			<MovesList
				moves={props.model.moveSeq.displayMoves}
				offset={props.model.offset}
				composeOverlay={props.inputs}
			/>
		</div>
	)
}

const CameraUtil: PromptComponent<void> = pProps => {
	const [cameraType, setCameraType] = useAtom(cameraTypeAtom)
	const [tileScale, setTileScale] = useAtom(tileScaleAtom)
	return (
		<Dialog
			header="Camera util"
			notModal
			buttons={[["Close", () => {}]]}
			onResolve={pProps.onResolve}
		>
			<div>
				Camera size:{" "}
				<input
					type="number"
					step="1"
					class="w-14"
					value={cameraType.width}
					onChange={ev =>
						setCameraType({
							...cameraType,
							width: parseInt(ev.currentTarget.value),
						})
					}
				/>
				{" x "}
				<input
					type="number"
					step="1"
					class="w-14"
					value={cameraType.height}
					onChange={ev =>
						setCameraType({
							...cameraType,
							height: parseInt(ev.currentTarget.value),
						})
					}
				/>
			</div>
			<div class="mt-1">
				Tile scale:{" "}
				<input
					type="number"
					class="w-14"
					step=".25"
					value={tileScale}
					onChange={ev => setTileScale(parseFloat(ev.currentTarget.value))}
				/>
			</div>
		</Dialog>
	)
}

const cameraTypeAtom = atom<CameraType>({ screens: 1, width: 10, height: 10 })
const tileScaleAtom = atom<number>(1)

export function formatTimeLeft(timeLeft: number) {
	let sign = ""
	if (timeLeft < 0) {
		timeLeft = -timeLeft
		sign = "-"
	}
	const subtickStr = ["", "⅓", "⅔"]
	const subtick = timeLeft % 3
	const int = Math.ceil(timeLeft / 60)
	let decimal = (Math.floor((timeLeft / 3) % 20) * 5)
		.toString()
		.padStart(2, "0")
	if (decimal === "00" && subtick === 0) {
		decimal = "100"
	}
	return `${sign}${int}.${decimal}${subtickStr[subtick]}`
}

export function formatTicks(timeLeft: number) {
	let sign = ""
	if (timeLeft < 0) {
		timeLeft = -timeLeft
		sign = "-"
	}
	const subtickStr = ["", "⅓", "⅔"]
	const subtick = timeLeft % 3
	const int = Math.floor(timeLeft / 60)
	let decimal = (Math.floor((timeLeft / 3) % 20) * 5)
		.toString()
		.padStart(2, "0")
	return `${sign}${int}.${decimal}${subtickStr[subtick]}`
}

export function RealExaPlayerPage() {
	const [modelM, setModel] = useAtom(modelAtom)
	const aLevel = useSwrLevel()
	const modelConfig = useAtomValue(modelConfigAtom)
	useEffect(() => {
		if (!aLevel || !modelConfig) return
		setModel(makeModel(aLevel, modelConfig))
		const [camera, scale] = computeDefaultCamera(aLevel)
		setCameraType(camera)
		setTileScale(scale)
	}, [aLevel])
	const model = modelM!
	const levelN = useAtomValue(levelNAtom)
	const setControls = useSetAtom(levelControlsAtom)
	// Sidebar and router comms, level state
	function purgeBackfeed() {
		if (!(model instanceof GraphModel)) return
		for (const ptr of model.findBackfeedConns()) {
			ptr.n.removeConnection(ptr.m)
		}
		model.buildReferences()
		updateLevel()
	}
	const showPrompt = useJotaiFn(showPromptGs)
	useEffect(() => {
		setControls({
			restart: () => {
				model.resetLevel()
				updateLevel()
			},
			exa: {
				undo: () => {
					try {
						model.undo()
					} catch (err: any) {
						// Dumbest hack of all time
						if (
							!(err as Error).message.startsWith("into is required for multi-")
						) {
							throw err
						}
					}
					updateLevel()
				},
				redo: () => {
					try {
						model.redo()
					} catch (err: any) {
						// Dumbest hack of all time
						if (
							!(err as Error).message.startsWith("into is required for multi-")
						) {
							throw err
						}
					}
					updateLevel()
				},
				purgeBackfeed: model instanceof GraphModel ? purgeBackfeed : undefined,
				cameraControls() {
					showPrompt(CameraUtil)
				},
			},
		})
	}, [model])
	useEffect(() => {
		return () => {
			setControls({})
		}
	}, [])
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
	const tileset = useAtomValue(tilesetAtom)

	const [cameraType, setCameraType] = useAtom(cameraTypeAtom)
	const [tileScale, setTileScale] = useAtom(tileScaleAtom)

	function computeDefaultCamera(
		level: LevelData | LevelState
	): [CameraType, number] {
		const camera: CameraType = {
			width: Math.min(32, level.width),
			height: Math.min(32, level.height),
			screens: 1,
		}
		let scale = calcScale({
			tileSize: tileset!.tileSize,
			cameraType: camera,
			twPadding: [1 + 2 + 2 + 2 + 2 + 16 + 30 + 2 + 1, 1 + 2 + 2 + 1],
			tilePadding: [4, 0],
			// safetyCoefficient: 0.95,
		})
		if (scale > 1) scale = Math.floor(scale)
		else {
			scale = 0.5
		}
		return [camera, scale]
	}

	useLayoutEffect(() => {
		// Guess a good default tile scale, and let the user adjust
		const [camera, scale] = computeDefaultCamera(model.level)
		setCameraType(camera)
		setTileScale(scale)
	}, [])

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
				if (model?.level.gameState !== GameState.PLAYING) return
				model!.addInput(inputRef.current, model!.level)
				render()
			} finally {
				setInput(makeEmptyInputs())
			}
		}
		let timer: TimeoutTimer | null = null
		const listener = (ev: KeyboardEvent) => {
			const input = keyToInputMap[ev.code]
			const isWait = ev.code === "Space"
			if (isWait) {
				finalizeInput()
			} else if (
				input === "up" ||
				input === "right" ||
				input === "down" ||
				input === "left"
			) {
				setInput({ ...inputRef.current, [input]: true })
				if (timer === null) {
					timer = new TimeoutTimer(finalizeInput, 0.05)
				}
			} else if (input !== undefined) {
				setInput({ ...inputRef.current, [input]: !inputRef.current[input] })
			}
		}
		document.addEventListener("keydown", listener)
		return () => {
			document.removeEventListener("keydown", listener)
			timer?.cancel()
		}
	}, [model])
	let rootTimeLeft: number | undefined
	if (model instanceof GraphModel) {
		let distFromRoot: number
		if (model.current instanceof Node) {
			distFromRoot = model.current.rootDistance
			if (model.current.level.gameState === GameState.WON) {
				// This doesn't correctly emulate cases where a playable dies on a winning node,
				// since in those cases you actually *don't* lose a subtick, but it doesn't matter too much
				distFromRoot += 1
			}
		} else {
			distFromRoot = model.current.n.rootDistance + model.current.o * 3
		}
		rootTimeLeft = Math.max(0, model.initialTimeLeft - distFromRoot)
	}
	return (
		<div class="flex h-full w-full">
			<div class="m-auto grid items-center justify-center gap-2 [grid-template:auto_1fr/auto_min-content]">
				<div class="box row-span-2">
					<GameRenderer
						renderRef={renderRef1}
						level={levelRef}
						tileScale={tileScale}
						tileset={tileset!}
						cameraType={cameraType}
					/>
				</div>
				<div class="box col-start-2 flex w-auto gap-2">
					<div class="row-span-full mr-16 self-center justify-self-center">
						<Inv
							level={levelRef}
							renderRef={renderRef2}
							tileScale={tileScale}
						/>
					</div>
					<div class="grid items-center justify-items-end gap-2 gap-x-2 whitespace-nowrap text-end [grid-template-columns:repeat(2,auto);]">
						<div>Time left:</div>
						<div>{formatTimeLeft(rootTimeLeft ?? model.level.timeLeft)}s</div>
						<div>Chips left:</div>
						<div>{model.level.chipsLeft}</div>
						<div>Bonus points:</div>
						<div>{model.level.bonusPoints}</div>
						<div>Total points:</div>
						<div>
							{calculateLevelPoints(
								levelN!,
								Math.ceil((rootTimeLeft ?? model.level.timeLeft) / 60),
								model.level.bonusPoints
							)}
						</div>
					</div>
				</div>
				<div class="box col-start-2 h-full">
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
