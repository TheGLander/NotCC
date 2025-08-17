import { CameraType, GameRenderer } from "@/components/GameRenderer"
import { Getter, Setter, atom, useAtom, useAtomValue, useSetAtom } from "jotai"
import { LinearModel } from "./models/linear"
import { GraphModel } from "./models/graph"
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "preact/hooks"
import {
	GameState,
	KeyInputs,
	calculateLevelPoints,
	protobuf,
	Level,
	KEY_INPUTS,
	BasicTile,
	Actor,
	Direction,
	SlidingState,
	protoTimeToMs,
	Inventory as InventoryT,
	LevelModifiers,
	Route,
	RouteDirection,
	ItemIndex,
	InputProvider,
	DETERMINISTIC_BLOB_MOD,
} from "@notcc/logic"
import { tilesetAtom } from "@/components/PreferencesPrompt/TilesetsPrompt"
import {
	CompensatingIntervalTimer,
	TimeoutTimer,
	formatTimeLeft,
	useJotaiFn,
} from "@/helpers"
import { DEFAULT_KEY_MAP } from "@/inputs"
import { ExaNewEvent, ExaInitEvent } from "./OpenExaPrompt"
import { Inventory } from "@/components/Inventory"
import {
	GraphScrollBar as GraphTimelineView,
	GraphView,
	MovesList,
} from "./GraphView"
import { levelNAtom, levelSetIdentAtom, pageAtom } from "@/routing"
import {
	LevelData,
	getGlobalLevelModifiersGs,
	levelSetAtom,
	useSwrLevel,
} from "@/levelData"
import { exaComplainAboutNonlegalGlitches, modelAtom } from "."
import { calcScale } from "@/components/DumbLevelPlayer"
import { PromptComponent, showPromptGs } from "@/prompts"
import { Dialog } from "@/components/Dialog"
import { levelControlsAtom } from "@/components/Sidebar"
import {
	TIMELINE_DEFAULT_IDX,
	TIMELINE_PLAYBACK_SPEEDS,
	Timeline,
	TimelineBox,
	TimelineHead,
} from "@/components/Timeline"
import { Toast, addToastGs, adjustToastGs, removeToastGs } from "@/toast"
import { Renderer, Tileset } from "@/components/GameRenderer/renderer"
import {
	NonlegalMessage,
	isGlitchKindNonlegal,
} from "@/components/NonLegalMessage"
import {
	RouteLocation,
	findModelSavePath,
	makeModel,
	makeModelSave,
	modelFromSave,
} from "./exaProj"
import { makeDirP, showSavePrompt, writeJson } from "@/fs"
import { basename, join } from "path"
import { Expl } from "@/components/Expl"
import { dismissablePreferenceAtom } from "@/preferences"

const modelConfigAtom = atom<ExaNewEvent | null>(null)
type Model = LinearModel | GraphModel

function getDefaultLevelModifiersGs(get: Getter, set: Setter): LevelModifiers {
	return {
		...getGlobalLevelModifiersGs(get, set),
		blobMod: DETERMINISTIC_BLOB_MOD,
		randomForceFloorDirection: Direction.UP,
	}
}

export function openExaCCReal(
	get: Getter,
	set: Setter,
	openEv: ExaInitEvent,
	levelData: LevelData
) {
	let modifiers: LevelModifiers
	let model: Model
	let config: ExaNewEvent
	if (openEv.type === "open") {
		const loadRes = modelFromSave(levelData, openEv.save)
		modifiers = loadRes.modifiers
		model = loadRes.model
		config = loadRes.config
		set(projectSavePathAtom, openEv.path ?? null)
	} else {
		modifiers = getDefaultLevelModifiersGs(get, set)
		model = makeModel(levelData, openEv, modifiers)
		config = openEv
		set(projectSavePathAtom, null)
	}
	set(exaLevelModifiersAtom, modifiers)
	set(modelConfigAtom, config)
	set(pageAtom, "exa")
	set(modelAtom, model)
}

// function useModel() {
// 	const [model, setModel] = useAtom(modelAtom)
// 	return (fn: (model: LinearModel | GraphModel) => void) => {
// 		fn(model!)
// 		setModel(model)
// 	}
// }

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
	const model = useAtomValue(modelAtom)
	const tileset = useAtomValue(tilesetAtom)
	useLayoutEffect(() => {
		if (!model) {
			pProps.onResolve()
		}
	}, [model])
	if (!model) return <></>
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
					const [camera, scale] = computeDefaultCamera(model.level!, tileset!)
					setCameraType(camera)
					setTileScale(scale)
				}}
			>
				Auto
			</button>
		</Dialog>
	)
}

const hoveredTileAtom = atom<null | [number, number]>(null)

function getBasicTileDesc(tile: BasicTile) {
	return `${tile.type.name} (${tile.customData.toString(16)})`
}
function getInventoryDesc(inv: InventoryT) {
	const itemN = inv.item4
		? 4
		: inv.item3
			? 3
			: inv.item2
				? 2
				: inv.item1
					? 1
					: 0
	let str = "["
	if (itemN >= 1) str += `${inv.item1!.name}, `
	if (itemN >= 2) str += `${inv.item2!.name}, `
	if (itemN >= 3) str += `${inv.item3!.name}, `
	if (itemN >= 4) str += `${inv.item4!.name}, `
	str += "]"
	str += ` r${inv.keysRed} b${inv.keysBlue} y${inv.keysYellow} g${inv.keysGreen}`
	return str
}
function getActorDesc(level: Level, actor: Actor) {
	return `${actor.type.name} (${actor.customData}) IDX ${actor.actorListIdx(level)} ${Direction[actor.direction]}${
		actor.pendingDecision !== Direction.NONE
			? ` pending ${
					Direction[actor.pendingDecision]
				} (${actor.pendingDecisionLockedIn ? "locked" : "unlocked"})`
			: ""
	}${
		actor.moveProgress !== 0
			? ` moving ${actor.moveProgress}/${actor.moveLength}`
			: ""
	}${actor.slidingState !== SlidingState.NONE ? ` sliding ${SlidingState[actor.slidingState]}` : ""}${
		actor.bonked ? " bonked" : ""
	}${actor.frozen ? " frozen" : ""}${actor.pulling ? " pulling" : ""}${
		actor.pulled ? " pulled" : ""
	}${actor.pushing ? " pushing" : ""} INV ${getInventoryDesc(actor.inventory)}`
}

const TileInspector: PromptComponent<void> = pProps => {
	const model = useAtomValue(modelAtom)
	const hoveredTile = useAtomValue(hoveredTileAtom)
	const cell =
		model && hoveredTile && model.level.getCell(hoveredTile[0], hoveredTile[1])
	return (
		<Dialog
			header="Tile inspector"
			notModal
			buttons={[["Close", () => {}]]}
			onResolve={pProps.onResolve}
		>
			<div>
				Hovered tile{" "}
				{hoveredTile === null
					? "none"
					: `(${hoveredTile[0]}, ${hoveredTile[1]}):`}
			</div>
			<div class="bg-theme-950 h-40 w-[30rem] whitespace-pre-line rounded font-mono">
				{cell?.actor && `Actor: ${getActorDesc(model!.level, cell.actor)}\n`}
				{cell?.special && `Special: ${getBasicTileDesc(cell.special)}\n`}
				{cell?.itemMod && `Item mod: ${getBasicTileDesc(cell.itemMod)}\n`}
				{cell?.item && `Item: ${getBasicTileDesc(cell.item)}\n`}
				{cell?.terrain && `Terrain: ${getBasicTileDesc(cell.terrain)}\n`}
			</div>
		</Dialog>
	)
}

function computeDefaultCamera(
	level: Level,
	tileset: Tileset
): [CameraType, number] {
	const camera: CameraType = {
		width: Math.min(32, level.width),
		height: Math.min(32, level.height),
	}
	let scale = calcScale({
		tileSize: tileset.tileSize,
		cameraType: camera,
		twPadding: [1 + 2 + 2 + 2 + 2 + 16 + 30 + 2 + 1, 1 + 2 + 2 + 1 + 2 + 6],
		tilePadding: [4, 0],
		subSteps: 4,
	})
	if (scale < 1) {
		scale = 0.5
	}
	return [camera, scale]
}

const cameraTypeAtom = atom<CameraType>({ width: 10, height: 10 })
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

const NonlegalPrompt =
	(props: {
		glitch: protobuf.IGlitchInfo
		undo: () => void
	}): PromptComponent<void> =>
	pProps => {
		return (
			<Dialog
				header="Nonlegal glitch"
				notModal
				onResolve={pProps.onResolve}
				buttons={[
					["Continue", () => {}],
					["Undo", props.undo],
				]}
			>
				<NonlegalMessage glitch={props.glitch} />
			</Dialog>
		)
	}

function getLevelStats(levelN: number, model: Model) {
	const timeLeft = model.timeLeft()
	return {
		timeLeft,
		chipsLeft: model.level.chipsLeft,
		bonusPoints: model.level.bonusPoints,
		totalPoints: calculateLevelPoints(
			levelN,
			Math.ceil(timeLeft / 60),
			model.level.bonusPoints
		),
	}
}

const confirmNewExaModifiersPromptDismissedAtom = dismissablePreferenceAtom(
	"confirmNewExaModifiersPromptDismissed"
)

const ConfirmNewModifiersPrompt: PromptComponent<boolean> = pProps => {
	const setPromptDismissed = useSetAtom(
		confirmNewExaModifiersPromptDismissedAtom
	)
	return (
		<Dialog
			header="Reset level to apply modifiers?"
			buttons={[
				["Cancel", () => pProps.onResolve(false)],
				["Apply", () => pProps.onResolve(true)],
			]}
			onClose={() => pProps.onResolve(false)}
		>
			<div>
				Warning: to apply the new level modifiers, the level will be reset and
				the current project will be re-imported on the new level. If any
				sequence of moves in the project prematurely wins or loses the level,
				some of the moves might be lost.
			</div>
			<div>
				<label>
					<input
						type="checkbox"
						onChange={ev => setPromptDismissed(ev.currentTarget.checked)}
					/>{" "}
					Don't show this warning again
				</label>
			</div>
		</Dialog>
	)
}

const IncompatibleReplayModifiersPrompt: PromptComponent<
	"cancel" | "reset" | "overlay"
> = pProps => (
	<Dialog
		header="Incompatible level modifiers in replay"
		buttons={[
			["Cancel", () => pProps.onResolve("cancel")],
			["Reset project", () => pProps.onResolve("reset")],
			["Overlay over project anyway", () => pProps.onResolve("overlay")],
		]}
		onClose={() => pProps.onResolve("cancel")}
	>
		The replay you attempted to load has incompatible level modifiers with the
		current project. To load the replay, the current project must be reset.
		Otherwise, the replay may fail if it depends on the specific modifiers.
	</Dialog>
)

const exaLevelModifiersAtom = atom<LevelModifiers | null>(null)

const DIRECTION_PRETTY_NAMES: Record<Direction, string> = {
	[Direction.NONE]: "None",
	[Direction.UP]: "Up",
	[Direction.RIGHT]: "Right",
	[Direction.DOWN]: "Down",
	[Direction.LEFT]: "Left",
}

const ModifiersControl: PromptComponent<void> = pProps => {
	const [model, setModel] = useAtom(modelAtom)
	const level = model?.level
	const blobLimit = !level?.metadata
		? 0
		: level.metadata.rngBlobDeterministic
			? 1
			: level.metadata.rngBlob4Pat
				? 4
				: 256

	const [levelModifiers, setLevelModifiers] = useAtom(exaLevelModifiersAtom)

	const [rffDirection, setRffDirection] = useState(
		levelModifiers?.randomForceFloorDirection ?? Direction.UP
	)
	const [blobMod, setBlobMod] = useState(
		levelModifiers?.blobMod ?? DETERMINISTIC_BLOB_MOD
	)
	const bypassConfirmDialog = useAtomValue(
		confirmNewExaModifiersPromptDismissedAtom
	)
	const showPrompt = useJotaiFn(showPromptGs)

	const levelData = useSwrLevel()
	const modelConfig = useAtomValue(modelConfigAtom)
	const applyNewModifiers = useCallback(async () => {
		if (!modelConfig || !levelData) return
		if (!bypassConfirmDialog) {
			const agreedToContinue = await showPrompt(ConfirmNewModifiersPrompt)
			if (!agreedToContinue) return
		}
		const newModifiers: LevelModifiers = {
			...levelModifiers,
			randomForceFloorDirection: rffDirection,
			blobMod,
		}
		const newModel = makeModel(levelData, modelConfig, newModifiers)
		// @ts-ignore
		newModel.transcribeFromOther(model)
		setLevelModifiers(newModifiers)
		setModel(newModel)
	}, [model, levelModifiers, rffDirection, blobMod, bypassConfirmDialog])

	return (
		<Dialog
			notModal
			header="Level modifiers"
			onClose={() => pProps.onResolve()}
			buttons={[
				["Close", () => pProps.onResolve()],
				["Apply", () => applyNewModifiers()],
			]}
		>
			<div class="m-2 grid grid-rows-3 gap-2 [grid-template-columns:repeat(3,auto)]">
				<div></div>
				<div>
					RFF direction<Expl>the initial random force floor direction</Expl>
				</div>
				<div>
					Blob mod<Expl>the initial randomness value for blobs</Expl>
				</div>
				<div>Current</div>
				<div>
					{level &&
						levelModifiers &&
						DIRECTION_PRETTY_NAMES[
							levelModifiers.randomForceFloorDirection ?? Direction.UP
						]}
				</div>
				<div>
					{level &&
						levelModifiers &&
						(blobLimit === 1
							? "N/A (one seed)"
							: levelModifiers.blobMod !== undefined &&
								levelModifiers.blobMod % blobLimit)}
				</div>
				<div>New</div>
				<div>
					<select
						disabled={!level || !levelModifiers}
						value={Direction[rffDirection]}
						onInput={ev => {
							setRffDirection(
								Direction[ev.currentTarget.value as RouteDirection]
							)
						}}
					>
						<option value="UP">Up</option>
						<option value="RIGHT">Right</option>
						<option value="DOWN">Down</option>
						<option value="LEFT">Left</option>
					</select>
				</div>
				<div>
					{blobLimit === 1 ? (
						"N/A (one seed)"
					) : (
						<input
							type="number"
							disabled={!level || !levelModifiers}
							min="0"
							max={blobLimit === 0 ? 0 : blobLimit - 1}
							value={blobMod % blobLimit}
							onInput={ev => {
								setBlobMod(parseInt(ev.currentTarget.value))
							}}
						/>
					)}
				</div>
			</div>
		</Dialog>
	)
}

function areLevelModifiersEqual(a: LevelModifiers, b: LevelModifiers) {
	if (
		(a.blobMod ?? DETERMINISTIC_BLOB_MOD) !==
		(b.blobMod ?? DETERMINISTIC_BLOB_MOD)
	)
		return false
	if (
		(a.randomForceFloorDirection ?? Direction.UP) !==
		(b.randomForceFloorDirection ?? Direction.UP)
	)
		return false
	if (a.timeLeft !== b.timeLeft) return false
	if (
		(a.inventoryKeys?.red ?? 0) !== (b.inventoryKeys?.red ?? 0) ||
		(a.inventoryKeys?.green ?? 0) !== (b.inventoryKeys?.green ?? 0) ||
		(a.inventoryKeys?.blue ?? 0) !== (b.inventoryKeys?.blue ?? 0) ||
		(a.inventoryKeys?.yellow ?? 0) !== (b.inventoryKeys?.yellow ?? 0)
	)
		return false
	if ((a.playableEnterN ?? 0) !== (b.playableEnterN ?? 0)) return false
	const aTools = a.inventoryTools ?? [
		ItemIndex.Nothing,
		ItemIndex.Nothing,
		ItemIndex.Nothing,
		ItemIndex.Nothing,
	]
	const bTools = b.inventoryTools ?? [
		ItemIndex.Nothing,
		ItemIndex.Nothing,
		ItemIndex.Nothing,
		ItemIndex.Nothing,
	]
	if (aTools.some((aItem, idx) => aItem !== bTools[idx])) return false
	return true
}

function importInputsToModel(
	model: Model,
	ip: InputProvider,
	reportProgress?: (progress: number) => void
) {
	const UPDATE_PERIOD = 600
	// Graph model might mess with the level's currentTick/Subtick if it detects a redundancy, so we need to maintain a separate linear currentSubtick
	let linearCurrentSubtick = 0
	while (!ip.outOfInput(linearCurrentSubtick)) {
		if (model.level.gameState !== GameState.PLAYING) break
		const moveLength = model.addInput(ip.getInput(linearCurrentSubtick, 0))
		if (linearCurrentSubtick % UPDATE_PERIOD === 0) {
			reportProgress?.(ip.inputProgress(linearCurrentSubtick))
		}
		linearCurrentSubtick += moveLength
	}
}

const projectSavePathAtom = atom<string | null>(null)

export function RealExaPlayerPage() {
	const [modelM, setModel] = useAtom(modelAtom)
	const aLevel = useSwrLevel()
	const [modelConfig, setModelConfig] = useAtom(modelConfigAtom)

	const model = modelM!
	useEffect(() => {
		// @ts-ignore
		globalThis.NotCC.exa = { model }
	}, [model])
	const playerSeat = model.level.playerSeats[0]
	const levelN = useAtomValue(levelNAtom)!
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
	const complainAboutNonlegal = useAtomValue(exaComplainAboutNonlegalGlitches)
	const checkForNonlegalGlitches = useCallback(
		(lastCheck: number) => {
			if (!complainAboutNonlegal) return
			const nonlegalGlitches = [...model.level.glitches].filter(
				gl =>
					isGlitchKindNonlegal(gl.glitchKind) &&
					protoTimeToMs(gl.toGlitchInfo().happensAt!) > lastCheck
			)
			if (nonlegalGlitches.length > 0) {
				showPrompt(
					NonlegalPrompt({
						glitch: nonlegalGlitches[0].toGlitchInfo(),
						undo: () => {
							model.undo()
							updateLevel()
						},
					})
				)
			}
		},
		[model, complainAboutNonlegal]
	)
	const [levelModifiers, setLevelModifiers] = useAtom(exaLevelModifiersAtom)
	const levelSet = useAtomValue(levelSetAtom)
	const levelSetIdent = useAtomValue(levelSetIdentAtom)
	const [projectSavePath, setProjectSavePath] = useAtom(projectSavePathAtom)
	const getDefaultLevelModifiers = useJotaiFn(getDefaultLevelModifiersGs)

	const lastLevelRef = useRef(aLevel)

	useEffect(() => {
		if (!aLevel || !modelConfig || !levelModifiers) return
		if (aLevel === lastLevelRef.current) {
			lastLevelRef.current = aLevel
			return
		}
		lastLevelRef.current = aLevel
		const modifiers = getDefaultLevelModifiers()
		const model = makeModel(aLevel, modelConfig, modifiers)
		setLevelModifiers(modifiers)
		setModel(model)
	}, [aLevel, modelConfig])

	const showPrompt = useJotaiFn(showPromptGs)
	const addToast = useJotaiFn(addToastGs)
	const removeToast = useJotaiFn(removeToastGs)
	const adjustToast = useJotaiFn(adjustToastGs)
	useEffect(() => {
		setControls({
			restart() {
				model.resetLevel()
				updateLevel()
			},
			async playInputs(ip) {
				if (!aLevel || !modelConfig) return
				let thisModel = model
				const ipModifiers = ip.levelModifiers()
				if (!areLevelModifiersEqual(levelModifiers ?? {}, ipModifiers)) {
					let actuallyResetModel = true
					if (!model.isBlank()) {
						const userAgreedToReset = await showPrompt(
							IncompatibleReplayModifiersPrompt
						)
						if (userAgreedToReset === "cancel") return
						actuallyResetModel = userAgreedToReset === "reset"
					}
					if (actuallyResetModel) {
						thisModel = makeModel(aLevel, modelConfig, ipModifiers)
						setModel(thisModel)
						setLevelModifiers(ipModifiers)
						updateLevel()
					}
				}
				const toast: Toast = { title: "Importing route (0%)" }
				addToast(toast)
				thisModel.resetLevel()
				importInputsToModel(thisModel, ip, progress => {
					updateLevel()
					toast.title = `Importing route (${Math.floor(progress * 100)}%)`
					adjustToast()
				})
				removeToast(toast)
				updateLevel()
			},
			exa: {
				undo: () => {
					model.undo()
					updateLevel()
				},
				redo: () => {
					const curTime = model.level.msecsPassed()
					model.redo()
					checkForNonlegalGlitches(curTime)
					updateLevel()
				},
				purgeBackfeed: model instanceof GraphModel ? purgeBackfeed : undefined,
				cameraControls() {
					showPrompt(CameraUtil)
				},
				tileInspector() {
					showPrompt(TileInspector)
				},
				levelModifiersControls() {
					showPrompt(ModifiersControl)
				},
				save:
					(levelSet ?? undefined) &&
					(async () => {
						const routeLocation: RouteLocation = {
							levelN,
							setIdent: levelSetIdent!,
							setName: levelSet!.gameTitle(),
							path: projectSavePath ?? undefined,
						}

						const savePath = await findModelSavePath(
							model.level.metadata.title ?? "UNKNOWN",
							model instanceof LinearModel,
							routeLocation
						)
						await makeDirP(join(savePath, ".."))
						await writeJson(
							savePath,
							makeModelSave(model, levelModifiers ?? {}, routeLocation)
						)
						addToast({
							title: !projectSavePath
								? `Saved as ${basename(savePath)}`
								: "Saved",
							autoHideAfter: 2,
						})
						setProjectSavePath(savePath)
					}),
				async export() {
					const moves = model.getSelectedMoveSequence()
					const levelStats = getLevelStats(levelN, model)
					const route: Route = {
						Moves: moves.join(""),
						Blobmod: levelModifiers?.blobMod,
						"Initial Slide":
							levelModifiers?.randomForceFloorDirection === undefined
								? undefined
								: (Direction[
										levelModifiers.randomForceFloorDirection
									] as RouteDirection),
						Rule: "Steam",
						ExportApp: "ExaCC v2.0",
						For: {
							Set: levelSet?.gameTitle(),
							LevelName: model.level.metadata.title ?? undefined,
							LevelNumber: levelSet ? levelN : undefined,
						},
					}
					showSavePrompt(
						new TextEncoder().encode(JSON.stringify(route)).buffer,
						"Save route export",
						{
							defaultPath: `./${route.For!.LevelName?.replace("/", " ") ?? "Unknown"} ${formatTimeLeft(levelStats.timeLeft, false)}s ${levelStats.totalPoints}pts.route`,
						}
					)
				},
			},
		})
	}, [model, levelModifiers, checkForNonlegalGlitches, projectSavePath])
	useEffect(() => {
		return () => {
			setModel(null)
			setProjectSavePath(null)
			setLevelModifiers(null)
			setModelConfig(null)
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
	useLayoutEffect(() => {
		if (!model) return
		render()
	}, [model])
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
		if (!tileset) return
		// Guess a good default tile scale, and let the user adjust
		const [camera, scale] = computeDefaultCamera(model.level, tileset)
		setCameraType(camera)
		setTileScale(scale)
	}, [model, tileset])

	// Inputs
	const [inputs, setInputs] = useState<KeyInputs>(0)

	const inputRef = useRef(inputs)
	useLayoutEffect(() => {
		function setInput(inputsNeue: KeyInputs) {
			inputRef.current = inputsNeue
			setInputs(inputsNeue)
		}
		function finalizeInput() {
			timer?.cancel()
			timer = null
			try {
				if (model?.level.gameState !== GameState.PLAYING) return
				if (!model!.isCurrentlyAlignedToMove()) {
					model!.redo()
					updateLevel()
					return
				}
				const curTime = model.level.msecsPassed()
				model!.addInput(inputRef.current)
				checkForNonlegalGlitches(curTime)
				updateLevel()
			} finally {
				setInput(0)
			}
		}
		let timer: TimeoutTimer | null = null
		const listener = (ev: KeyboardEvent) => {
			const inputs = inputRef.current
			const input: number | undefined = DEFAULT_KEY_MAP[ev.code as "ArrowUp"]
			const isWait = ev.code === "Space"
			if (isWait) {
				finalizeInput()
			} else if (input && input & KEY_INPUTS.directional) {
				setInput(inputs | input)
				if (timer === null) {
					timer = new TimeoutTimer(finalizeInput, 0.05)
				}
			} else if (input !== undefined) {
				setInput((inputs & ~input) | (input & inputs ? 0 : input))
			}
		}
		document.addEventListener("keydown", listener)
		return () => {
			document.removeEventListener("keydown", listener)
			timer?.cancel()
		}
	}, [model, checkForNonlegalGlitches])
	// Scrollbar, scrub and playback
	const [playing, setPlaying] = useState(false)
	const [speedIdx, setSpeedIdx] = useState(TIMELINE_DEFAULT_IDX)
	const timerRef = useRef<CompensatingIntervalTimer | null>(null)
	function stepLevel() {
		if (model.isAtEnd()) {
			if (model.level.currentSubtick !== 1) {
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
		timerRef.current = new CompensatingIntervalTimer(
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
	const rendererRef = useRef<Renderer>(null)
	const tilePosFromCanvasCoords = useCallback(
		(coords: [number, number]): [number, number] | null => {
			const renderer = rendererRef.current
			const level = renderer?.level
			if (!renderer || !level) return null
			const tileSize = renderer.tileset.tileSize * tileScale
			const cameraOffset = renderer.cameraPosition
			const coordsTiled = [coords[0] / tileSize, coords[1] / tileSize]
			const pos = [
				coordsTiled[0] - cameraOffset[0],
				coordsTiled[1] - cameraOffset[1],
			]
			if (pos[0] >= level?.width || pos[1] >= level.height) return null
			return [Math.floor(pos[0]), Math.floor(pos[1])]
		},
		[tileScale]
	)
	const setHoveredTile = useSetAtom(hoveredTileAtom)
	const levelStats = getLevelStats(levelN, model)
	return (
		<div class="flex h-full w-full">
			<div class="m-auto grid items-center justify-center gap-2 [grid-template:auto_1fr_auto/auto_min-content]">
				<div class="box row-span-2">
					<GameRenderer
						playerSeat={playerSeat}
						renderRef={renderRef1}
						level={levelRef}
						tileScale={tileScale}
						tileset={tileset!}
						cameraType={cameraType}
						rendererRef={rendererRef}
						onMouseOver={ev => {
							setHoveredTile(tilePosFromCanvasCoords([ev.offsetX, ev.offsetY]))
						}}
						onMouseMove={ev => {
							setHoveredTile(tilePosFromCanvasCoords([ev.offsetX, ev.offsetY]))
						}}
						onMouseOut={() => setHoveredTile(null)}
						forcePerspective
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
						<Inventory
							tileset={tileset!}
							inventory={playerSeat}
							renderRef={renderRef2}
							tileScale={tileScale}
						/>
					</div>
					<div class="grid items-center justify-items-end gap-2 gap-x-2 whitespace-nowrap text-end [grid-template-columns:repeat(2,auto);]">
						<div>Time left:</div>
						<div class="font-mono">
							{formatTimeLeft(levelStats.timeLeft, true)}s
						</div>
						<div>Chips left:</div>
						<div>{levelStats.chipsLeft}</div>
						<div>Bonus points:</div>
						<div>{levelStats.bonusPoints}</div>
						<div>Total points:</div>
						<div>{levelStats.totalPoints}</div>
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
