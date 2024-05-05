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
	InputProvider,
	KeyInputs,
	LevelData,
	LevelState,
	calculateLevelPoints,
	createLevelFromData,
	makeEmptyInputs,
} from "@notcc/logic"
import { tilesetAtom } from "@/components/PreferencesPrompt/TilesetsPrompt"
import {
	IntervalTimer,
	TimeoutTimer,
	formatTimeLeft,
	sleep,
	useJotaiFn,
} from "@/helpers"
import { keyToInputMap } from "@/inputs"
import {
	DEFAULT_HASH_SETTINGS,
	ExaNewEvent,
	ExaOpenEvent,
} from "./OpenExaPrompt"
import { Inventory } from "@/components/Inventory"
import {
	GraphScrollBar as GraphTimelineView,
	GraphView,
	MovesList,
} from "./GraphView"
import { levelNAtom, pageAtom } from "@/routing"
import { makeLevelHash } from "./hash"
import { useSwrLevel } from "@/levelData"
import { modelAtom } from "."
import { calcScale } from "@/components/DumbLevelPlayer"
import { PromptComponent, showPrompt as showPromptGs } from "@/prompts"
import { Dialog } from "@/components/Dialog"
import { levelControlsAtom } from "@/components/Sidebar"
import {
	TIMELINE_PLAYBACK_SPEEDS,
	Timeline,
	TimelineBox,
	TimelineHead,
} from "@/components/Timeline"
import { Toast, addToastGs, adjustToastGs, removeToastGs } from "@/toast"
import { Tileset } from "@/components/GameRenderer/renderer"

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

function makeModel(
	levelData: LevelData,
	conf: ExaNewEvent,
	init?: InputProvider
): Model {
	const level = createLevelFromData(levelData)
	init?.setupLevel(level)
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
		<div class="bg-theme-950 absolute h-full w-full overflow-y-auto rounded">
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
	const aLevel = useSwrLevel()
	const tileset = useAtomValue(tilesetAtom)
	return (
		<Dialog
			header="Camera control"
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
			<button
				onClick={() => {
					const [camera, scale] = computeDefaultCamera(aLevel!, tileset!)
					setCameraType(camera)
					setTileScale(scale)
				}}
			>
				Auto
			</button>
		</Dialog>
	)
}

function computeDefaultCamera(
	level: LevelData | LevelState,
	tileset: Tileset
): [CameraType, number] {
	const camera: CameraType = {
		width: Math.min(32, level.width),
		height: Math.min(32, level.height),
		screens: 1,
	}
	let scale = calcScale({
		tileSize: tileset!.tileSize,
		cameraType: camera,
		twPadding: [1 + 2 + 2 + 2 + 2 + 16 + 30 + 2 + 1, 1 + 2 + 2 + 1 + 2 + 6],
		tilePadding: [4, 0],
		// safetyCoefficient: 0.95,
	})
	if (scale > 1) scale = Math.floor(scale)
	else {
		scale = 0.5
	}
	return [camera, scale]
}

const cameraTypeAtom = atom<CameraType>({ screens: 1, width: 10, height: 10 })
const tileScaleAtom = atom<number>(1)

function LinearTimelineView(props: {
	model: LinearModel
	updateLevel: () => void
}) {
	return (
		<Timeline
			onScrub={progress => {
				if (props.model.moveSeq.tickLen === 0) return
				props.model.goTo(Math.round(progress * props.model.moveSeq.tickLen))
				props.updateLevel()
			}}
		>
			<TimelineHead
				progress={props.model.offset / props.model.moveSeq.tickLen}
			/>
		</Timeline>
	)
}
export function RealExaPlayerPage() {
	const [modelM, setModel] = useAtom(modelAtom)
	const aLevel = useSwrLevel()
	const modelConfig = useAtomValue(modelConfigAtom)
	useEffect(() => {
		if (!aLevel || !modelConfig) return
		setModel(makeModel(aLevel, modelConfig))
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
	const addToast = useJotaiFn(addToastGs)
	const removeToast = useJotaiFn(removeToastGs)
	const adjustToast = useJotaiFn(adjustToastGs)
	useEffect(() => {
		setControls({
			restart: () => {
				model.resetLevel()
				updateLevel()
			},
			playInputs: async repl => {
				const ip = typeof repl.ip === "function" ? await repl.ip() : repl.ip
				const model = makeModel(aLevel!, modelConfig!, ip)
				setModel(model)
				const UPDATE_PERIOD = 200
				const toast: Toast = { title: "Importing route (0%)" }
				addToast(toast)
				while (!ip.outOfInput(model.level)) {
					if (model.level.gameState !== GameState.PLAYING) break
					model.addInput(ip.getInput(model.level), model.level)
					if (model.level.currentTick % UPDATE_PERIOD === 0) {
						updateLevel()
						toast.title = `Importing route (${Math.floor(
							ip.inputProgress(model.level) * 100
						)}%)`
						adjustToast()
						await sleep(0)
					}
				}
				removeToast(toast)
				updateLevel()
			},
			exa: {
				undo: () => {
					model.undo()
					updateLevel()
				},
				redo: () => {
					model.redo()
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
	// Rendering
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

	useLayoutEffect(() => {
		// Guess a good default tile scale, and let the user adjust
		const [camera, scale] = computeDefaultCamera(model.level, tileset!)
		setCameraType(camera)
		setTileScale(scale)
	}, [aLevel, tileset])

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
				if (!model!.isCurrentlyAlignedToMove()) {
					model!.redo()
					render()
					return
				}
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
	// Time left
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
	// Scrollbar, scrub and playback
	const [playing, setPlaying] = useState(false)
	const [speedIdx, setSpeedIdx] = useState(3)
	const timerRef = useRef<IntervalTimer | null>(null)
	function stepLevel() {
		if (model.isAtEnd()) {
			if (model.level.subtick !== 1) {
				model.level.tick()
				updateLevel()
				return
			}
			setPlaying(false)
			return
		}
		model.step()
		updateLevel()
	}
	useLayoutEffect(() => {
		if (!playing) {
			timerRef.current?.cancel()
			timerRef.current = null
			return
		}
		timerRef.current = new IntervalTimer(
			stepLevel,
			1 / (60 * TIMELINE_PLAYBACK_SPEEDS[speedIdx])
		)
	}, [playing])
	useLayoutEffect(() => {
		if (!timerRef.current) return
		timerRef.current.adjust(1 / (60 * TIMELINE_PLAYBACK_SPEEDS[speedIdx]))
	}, [speedIdx])
	useEffect(() => {
		return () => {
			timerRef.current?.cancel()
			timerRef.current = null
		}
	}, [])
	return (
		<div class="flex h-full w-full">
			<div class="m-auto grid items-center justify-center gap-2 [grid-template:auto_1fr_auto/auto_min-content]">
				<div class="box row-span-2">
					<GameRenderer
						renderRef={renderRef1}
						level={levelRef}
						tileScale={tileScale}
						tileset={tileset!}
						cameraType={cameraType}
					/>
				</div>
				<div class="box row-start-3">
					<TimelineBox
						playing={playing}
						speedIdx={speedIdx}
						onSetPlaying={v => setPlaying(v)}
						onSetSpeed={v => setSpeedIdx(v)}
					>
						{model instanceof LinearModel && (
							<LinearTimelineView model={model} updateLevel={updateLevel} />
						)}
						{model instanceof GraphModel && (
							<GraphTimelineView model={model} updateLevel={updateLevel} />
						)}
					</TimelineBox>
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
						<div class="font-mono">
							{formatTimeLeft(rootTimeLeft ?? model.level.timeLeft, true)}s
						</div>
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
				<div class="box col-start-2 row-span-2 h-full">
					<div class="relative h-full w-full">
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
				</div>
				{/* </div> */}
			</div>
		</div>
	)
}
