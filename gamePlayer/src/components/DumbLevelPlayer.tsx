import {
	AttemptTracker,
	InputProvider,
	LevelSet,
	Level,
	GameState,
	applyLevelModifiers,
	winInterruptResponseFromLevel,
	LevelModifiers,
	DETERMINISTIC_BLOB_MOD,
	SolutionMetrics,
	calculateLevelPoints,
	findBestMetrics,
	KeyInputs,
} from "@notcc/logic"
import { CameraType, GameRenderer } from "./GameRenderer"
import { useAtomValue, useSetAtom } from "jotai"
import { tilesetAtom } from "@/components/PreferencesPrompt/TilesetsPrompt"
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "preact/hooks"
import {
	CompensatingIntervalTimer,
	applyRef,
	formatTimeLeft,
	sleep,
	useJotaiFn,
} from "@/helpers"
import { embedReadyAtom, embedModeAtom, pageAtom, levelNAtom } from "@/routing"
import { MobileControls } from "./MobileControls"
import { useGameInputs } from "@/inputs"
import { twJoin, twMerge } from "tailwind-merge"
import { ComponentChildren, Ref, VNode } from "preact"
import { useMediaQuery } from "react-responsive"
import { Inventory } from "./Inventory"
import {
	LevelData,
	borrowLevelSetGs,
	getGlobalLevelModifiersGs,
	importantSetAtom,
	levelWinInterruptResponseAtom,
} from "@/levelData"
import { goToNextLevelGs } from "@/levelData"
import { trivia } from "@/trivia"
import { LevelControls } from "./Sidebar"
import {
	TIMELINE_DEFAULT_IDX,
	TIMELINE_PLAYBACK_SPEEDS,
	Timeline,
	TimelineBox,
	TimelineHead,
} from "./Timeline"
import { sfxAtom } from "./PreferencesPrompt/SfxPrompt"
import { protobuf } from "@notcc/logic"
import {
	CrashMessage,
	NonlegalMessage,
	isGlitchKindNonlegal,
} from "./NonLegalMessage"
import { ExplGrade, Grade } from "./Grade"
import {
	ReportGrade,
	getReportGradesForMetrics,
	setScoresAtom,
} from "@/scoresApi"
import { LevelListPrompt, showTimeFractionInMetricsAtom } from "./LevelList"
import { showPromptGs } from "@/prompts"
import { Ht } from "./Ht"
import { PORTRAIT_QUERY } from "@/../tailwind.config"

// A TW unit is 0.25rem
export function twUnit(tw: number): number {
	if (!globalThis.window) return Infinity
	const rem = parseFloat(getComputedStyle(document.body).fontSize)
	return rem * tw * 0.25
}

export interface AutoScaleConfig {
	tileSize: number
	cameraType: CameraType
	tilePadding?: [number, number]
	twPadding?: [number, number]
	safetyCoefficient?: number
	subSteps?: number
}

export function calcScale(args: AutoScaleConfig) {
	const sidebar = document.querySelector<HTMLDivElement>("#sidebar")
	if (!sidebar) return 1
	const sidebarRect = sidebar.getBoundingClientRect()
	const availableSize = document.body.getBoundingClientRect()
	if (sidebarRect.width > sidebarRect.height) {
		availableSize.height -= sidebarRect.height
	} else {
		availableSize.width -= sidebarRect.width
	}
	availableSize.width -= twUnit(args.twPadding?.[0] ?? 0)
	availableSize.height -= twUnit(args.twPadding?.[1] ?? 0)
	availableSize.width *= args.safetyCoefficient ?? 0.97
	availableSize.height *= args.safetyCoefficient ?? 0.97

	const xTiles = args.cameraType.width + (args.tilePadding?.[0] ?? 0)
	const yTiles = args.cameraType.height + (args.tilePadding?.[1] ?? 0)

	const xScale = availableSize.width / (xTiles * args.tileSize)
	const yScale = availableSize.height / (yTiles * args.tileSize)

	let subSteps = args.subSteps ?? 1
	subSteps *= window.devicePixelRatio

	const scale = Math.floor(Math.min(xScale, yScale) * subSteps) / subSteps
	return scale
}

export function useAutoScale(args: AutoScaleConfig) {
	const [scale, setScale] = useState(1)
	function resize() {
		setScale(calcScale(args))
	}
	useLayoutEffect(() => {
		resize()
		window.addEventListener("resize", resize)
		return () => {
			window.removeEventListener("resize", resize)
		}
	}, [args])
	return scale
}

type PlayerState =
	| "pregame"
	| "play"
	| "pause"
	| "dead"
	| "timeout"
	| "win"
	| "gz"
	| "nonlegal"
	| "crash"

type CoverButton = [string, null | (() => void)]

function Cover(props: {
	class: string
	buttons: CoverButton[]
	focusedButton?: string
	children: ComponentChildren
}) {
	const focusedRef = useRef<HTMLButtonElement>(null)
	useEffect(() => {
		//@ts-ignore Exists only in firefox, looks like declarations don't have it yet
		focusedRef.current?.focus({ focusVisible: true })
	}, [focusedRef])
	return (
		<div
			class={twMerge(
				"bg-radial-gradient flex h-full w-full flex-col items-center text-center [text-shadow:black_1px_0px_10px]",
				props.class
			)}
		>
			{props.children}
			{props.buttons.length !== 0 && (
				<div class="box desktop:h-20 mb-5 mt-auto flex h-16 w-4/5 flex-row gap-1">
					{props.buttons.map(([name, callback]) => (
						<button
							disabled={!callback}
							class="flex-1"
							onClick={callback ?? undefined}
							ref={
								props.focusedButton === name || !props.focusedButton
									? focusedRef
									: undefined
							}
						>
							{name}
						</button>
					))}
				</div>
			)}
		</div>
	)
}

function PregameCover(props: {
	level: Level
	set?: LevelSet
	mobile?: boolean
	onStart: () => void
}) {
	return (
		<Cover
			class="from-black/20 to-black/50"
			buttons={props.mobile ? [["Start", props.onStart]] : []}
		>
			{props.set && (
				<span class="text-md desktop:text-xl mb-1 mt-6">
					{props.set.gameTitle()} #{props.set.currentLevel}:
				</span>
			)}
			<h2
				class={twJoin(
					!props.set && "mt-6",
					"desktop:text-5xl text-3xl [line-height:1]"
				)}
			>
				{props.level.metadata.title ?? "UNNAMED"}
			</h2>
			<span class="desktop:text-2xl mt-1 text-lg">
				by {props.level.metadata.author ?? "???"}
			</span>
		</Cover>
	)
}

function PauseCover(props: { onUnpause: () => void }) {
	const [triviaIdx] = useState(() => Math.floor(Math.random() * trivia.length))
	return (
		<Cover
			class="from-theme-900 to-theme-900"
			buttons={[["Unpause", props.onUnpause]]}
		>
			<div class="flex flex-1 flex-col items-center">
				<h2 class="mt-6 text-left text-5xl">
					<Ht haiku="Take some moments off">Paused</Ht>
				</h2>
				<div class="bg-theme-950 relative my-auto w-4/5 rounded p-2 text-left [text-shadow:initial]">
					<div class="mb-1 text-lg">
						<Ht haiku="This fun fact shouldn't be unknown:">Did you know?</Ht>
					</div>
					<Ht haiku="JK, no facts here!">{trivia[triviaIdx]}</Ht>
					{/* For the guaranteed space */}
					<span class="invisible">
						{triviaIdx + 1}/{trivia.length}
					</span>
					<span class="absolute right-2">
						{triviaIdx + 1}/{trivia.length}
					</span>
				</div>
			</div>
		</Cover>
	)
}

function LoseCover(props: { timeout: boolean; onRestart: () => void }) {
	return (
		<Cover
			class={twJoin(
				props.timeout
					? "from-blue-900/10 to-blue-950/90"
					: "from-red-600/10 to-red-950/70"
			)}
			buttons={[["Restart", props.onRestart]]}
		>
			<h2 class="mt-6 text-5xl">
				{props.timeout ? "Ran out of time" : "You lost..."}
			</h2>
		</Cover>
	)
}

function NonlegalCover(props: {
	glitch: protobuf.IGlitchInfo
	onRestart: () => void
}) {
	return (
		<Cover
			class="bg-repeating-conic-gradient from-black/50 via-black/75 via-5% to-black/50 to-10%"
			buttons={[["Restart", props.onRestart]]}
		>
			<div class="flex flex-1 flex-col items-center">
				<h2 class="mx-2 mt-8  text-5xl">Stop! You've violated the law!</h2>
				<div class="box my-auto w-4/5 rounded p-2 text-left [text-shadow:initial]">
					<NonlegalMessage glitch={props.glitch} />
				</div>
			</div>
		</Cover>
	)
}

function CrashCover(props: {
	glitch: protobuf.IGlitchInfo
	onRestart: () => void
}) {
	return (
		<Cover
			class="bg-[conic-gradient(#300a,_#509a,_#950a,_#300a)]"
			buttons={[["Restart", props.onRestart]]}
		>
			<div class="flex flex-1 flex-col items-center">
				<h2 class="mx-2 mt-8  text-5xl">Game crash</h2>
				<div class="box my-auto w-4/5 rounded p-2 text-left [text-shadow:initial]">
					<CrashMessage glitch={props.glitch} />
				</div>
			</div>
		</Cover>
	)
}

interface LevelStatsBoxProps {
	metrics: SolutionMetrics
	bestMetrics?: SolutionMetrics
	grades?: Record<"time" | "score", ReportGrade>
	levelN: number
	totalMetrics?: SolutionMetrics
	showFraction: boolean
	showScore: boolean
}

function LevelStatsBox(props: LevelStatsBoxProps) {
	const formatTime: (val: number) => string = props.showFraction
		? time => formatTimeLeft(time, false)
		: time => Math.ceil(time / 60).toString()
	const bonusPoints =
		props.metrics.score -
		calculateLevelPoints(props.levelN, Math.ceil(props.metrics.timeLeft / 60))
	return (
		<div class="box my-auto rounded p-2 text-left [text-shadow:initial]">
			<div
				class={twJoin(
					"grid w-auto items-end justify-items-start gap-4",
					props.grades
						? "[grid-template-columns:repeat(4,auto);]"
						: "[grid-template-columns:repeat(3,auto);]"
				)}
			>
				<div>Metric</div>
				<div>This run</div>
				<div>Best run</div>
				{props.grades && (
					<div>
						Grade
						<ExplGrade />
					</div>
				)}
				<div>Time</div>
				<div class="justify-self-end">
					{formatTime(props.metrics.timeLeft)}s
				</div>
				<div class="justify-self-end">
					{props.bestMetrics
						? `${formatTime(props.bestMetrics.timeLeft)}s`
						: "—"}
				</div>
				{props.grades && (
					<div>
						<Grade grade={props.grades.time} />
					</div>
				)}
				{props.showScore && (
					<>
						<div>Score</div>
						<div class="flex flex-col justify-self-end">
							<div class="border-b-theme-800 grid gap-1 rounded rounded-b-md border-b-2 text-xs [grid:auto-flow/auto_auto]">
								<div>base score</div>
								<div class="justify-self-end">{props.levelN * 500}pts</div>
								<div>time score</div>
								<div class="justify-self-end">
									{Math.ceil(props.metrics.timeLeft / 60) * 10}pts
								</div>
								{bonusPoints !== 0 && (
									<>
										<div>bonus score</div>
										<div class="justify-self-end">{bonusPoints}pts</div>
									</>
								)}
							</div>
							<div class="self-end">{props.metrics.score}pts</div>
						</div>
						<div class="justify-self-end">
							{props.bestMetrics ? `${props.bestMetrics.score}pts` : "—"}
						</div>
						{props.grades && (
							<div>
								<Grade grade={props.grades.score} />
							</div>
						)}
					</>
				)}
			</div>
			{props.totalMetrics && (
				<div class="mt-2">
					<div>
						Total set time: {Math.ceil(props.totalMetrics.timeLeft / 60)}s
					</div>
					<div>Total set score: {props.totalMetrics.score}pts</div>
				</div>
			)}
		</div>
	)
}

function WinCover(props: {
	onNextLevel: () => void
	onRestart: () => void
	onSetSelector: () => void
	onLevelList: () => void
	singleLevel: boolean

	levelStats: LevelStatsBoxProps
}) {
	const buttons: CoverButton[] = props.singleLevel
		? [
				["Restart", props.onRestart],
				["Back to set selector", props.onSetSelector],
				["Explode Jupiter", null],
			]
		: [
				["Level list", props.onLevelList],
				["Next level", props.onNextLevel],
				["Explode Jupiter", null],
			]
	return (
		<Cover
			class="from-yellow-900/30 to-yellow-600/70"
			buttons={buttons}
			focusedButton="Next level"
		>
			<div class="flex w-full flex-1 flex-col items-center">
				<h2 class="mt-6 text-4xl">You won!</h2>
				<LevelStatsBox {...props.levelStats} />
			</div>
		</Cover>
	)
}

type HintRefFunc = (hint: string | null) => void

function NormalHintDisplay({ hintRef }: { hintRef: Ref<HintRefFunc> }) {
	const hintRefRef = useCallback(
		(el: HTMLDivElement | null) => {
			if (!el) {
				applyRef(hintRef, () => {})
			} else {
				applyRef(hintRef, hint => {
					el.innerText = hint ?? ""
				})
			}
		},
		[hintRef]
	)
	return (
		<div class="bg-theme-950 relative flex-1 rounded portrait:hidden">
			<div
				class="absolute max-h-full overflow-auto whitespace-pre-line p-1"
				ref={hintRefRef}
			></div>
		</div>
	)
}

function MobileHintCover({ hintRef }: { hintRef: Ref<HintRefFunc> }) {
	const hintBoxRef = useRef<HTMLDivElement | null>(null)
	const hintPlaceRef = useRef<HTMLDivElement | null>(null)
	const [hidden, setHidden] = useState(false)
	const hintApplier = useCallback((hint: string | null) => {
		const hintBox = hintBoxRef.current
		const hintPlace = hintPlaceRef.current
		if (!hint) {
			if (hintBox) {
				hintBox.style.display = "none"
			}
		} else {
			if (hintBox) {
				hintBox.style.display = "flex"
			}
			if (hintPlace) {
				hintPlace.innerText = hint
			}
		}
	}, [])
	useLayoutEffect(() => {
		applyRef(hintRef, hintApplier)
	}, [hintApplier])
	return (
		<div class="flex h-full w-full landscape:hidden">
			<div
				class="box mx-auto mb-4 mt-auto flex flex-col gap-1"
				ref={hintBoxRef}
			>
				<div
					class={twJoin("bg-theme-950 rounded p-1", hidden && "hidden")}
					ref={hintPlaceRef}
				></div>
				<button class="self-center" onClick={() => setHidden(!hidden)}>
					{hidden ? "Show hint" : "Hide hint"}
				</button>
			</div>
		</div>
	)
}

export function DumbLevelPlayer(props: {
	level: LevelData
	levelSet?: LevelSet
	controlsRef?: Ref<LevelControls | null>
	preventSimultaneousMovement?: boolean
	endOnNonlegalGlitch?: boolean
	speedMult?: number
	levelFinished?: () => void
	ignoreBonusFlags?: boolean
}) {
	const tileset = useAtomValue(tilesetAtom)!
	const sfx = useAtomValue(sfxAtom)
	useEffect(() => {
		return () => sfx?.stopAllSfx()
	}, [sfx])
	// if (!tileset) return <div class="box m-auto p-1">No tileset loaded.</div>

	const [playerState, setPlayerState] = useState("pregame" as PlayerState)

	useEffect(() => {
		if (playerState === "pause") sfx?.pause()
		else sfx?.unpause()
	}, [playerState, sfx])

	// Inputs & LevelState

	const [level, setLevel] = useState(() => props.level.initLevel())
	const inputMan = useGameInputs(level)
	const playerSeat = useMemo(() => level.playerSeats[0], [level])

	const getGlobalLevelModifiers = useJotaiFn(getGlobalLevelModifiersGs)
	const resetLevel = useCallback(
		(modifiers?: LevelModifiers) => {
			sfx?.stopAllSfx()
			setWinInterruptResponse(null)
			setAttempt(null)
			setReplay(null)
			const level = props.level.initLevel()
			applyLevelModifiers(
				level,
				modifiers ?? {
					...(getGlobalLevelModifiers() ?? {}),
					blobMod: level.metadata.rngBlobDeterministic
						? DETERMINISTIC_BLOB_MOD
						: Math.floor(Math.random() * 0x100),
				}
			)
			// @ts-ignore
			globalThis.NotCC.player = { level }
			setLevel(level)
			setPlayerState("pregame")
			processedPostLevelStuffRef.current = false
			if (props.levelSet) {
				setBestMetricsBeforeAttempt(
					findBestMetrics(props.levelSet.currentLevelRecord().levelInfo)
				)
			}
			possibleActionsRef.current?.(
				level.playerSeats[0].getPossibleActions(level)
			)
			return level
		},
		[sfx, props.level, props.levelSet]
	)
	useLayoutEffect(() => void resetLevel(), [props.level])

	const renderInventoryRef = useRef<() => void>(null)

	const timeLeftRef = useRef<HTMLDivElement>(null)
	const chipsLeftRef = useRef<HTMLDivElement>(null)
	const bonusPointsRef = useRef<HTMLDivElement>(null)
	const hintRef = useRef<HintRefFunc>(null)
	const updateLevelMetrics = useCallback(() => {
		timeLeftRef.current!.innerText = `${Math.ceil(level.timeLeft / 60)}s`
		chipsLeftRef.current!.innerText = level.chipsLeft.toString()
		bonusPointsRef.current!.innerText = `${level.bonusPoints}pts`
		hintRef.current?.(playerSeat.displayedHint)
	}, [level])
	useLayoutEffect(() => {
		updateLevelMetrics()
	}, [updateLevelMetrics])
	const hintRefAppl = useCallback(
		(ref: HintRefFunc | null) => {
			ref?.(playerSeat.displayedHint)
			applyRef(hintRef, ref)
		},
		[playerSeat]
	)

	// Attempt tracking
	const [attempt, setAttempt] = useState<null | AttemptTracker>(null)
	const beginLevelAttempt = useCallback(() => {
		setPlayerState("play")
		setAttempt(
			new AttemptTracker(
				1,
				level.rngBlob,
				level.randomForceFloorDirection,
				props.levelSet?.currentLevelRecord().levelInfo.scriptState ?? undefined
			)
		)
	}, [props.levelSet, level])
	const borrowLevelSet = useJotaiFn(borrowLevelSetGs)
	const submitLevelAttempt = useCallback(() => {
		if (embedMode || !attempt) return
		const att = attempt.endAttempt(level)
		borrowLevelSet(lSet => {
			lSet.logAttemptInfo(att)
			setAttempt(null)
		})
	}, [attempt, borrowLevelSet])
	const setWinInterruptResponse = useSetAtom(levelWinInterruptResponseAtom)

	// Ticking
	const levelN = useAtomValue(levelNAtom)
	// Ughh React's inability to immediately noticed changed state is very annoying
	const processedPostLevelStuffRef = useRef<boolean>(false)

	const possibleActionsRef = useRef<(actions: KeyInputs) => void>(null)

	const tickLevel = useCallback(() => {
		if (replay) {
			level.setProviderInputs(replay)
		} else {
			inputMan.setLevelInputs()
		}
		if (level.gameState === GameState.PLAYING) {
			attempt?.recordAttemptStep(level)
		}
		level.tick()
		// Only update this on movements subticks, since otherwise possible actions would flicker constants
		if (level.currentSubtick === 2) {
			possibleActionsRef.current?.(playerSeat.getPossibleActions(level))
		}
		inputMan.setReleasedInputs()
		sfx?.processSfxField(level.sfx)
		if (level.gameState === GameState.PLAYING) {
			renderInventoryRef.current?.()
			if (replay) {
				setSolutionLevelProgress(replay.inputProgress(level.subticksPassed()))
			}
			updateLevelMetrics()
			if (props.endOnNonlegalGlitch) {
				for (const glitch of level.glitches) {
					if (isGlitchKindNonlegal(glitch.glitchKind)) {
						setCaughtGlitch(glitch.toGlitchInfo())
						setPlayerState("nonlegal")
					}
				}
			}
		} else if (playerState === "play") {
			if (processedPostLevelStuffRef.current) return
			processedPostLevelStuffRef.current = true
			submitLevelAttempt()
			if (level.gameState !== GameState.CRASH) {
				props.levelFinished?.()
			}

			if (level.gameState === GameState.WON) {
				setPlayerState("win")
				setWinInterruptResponse(winInterruptResponseFromLevel(level))
				setSolutionMetrics({
					// FIXME: Wrong but idc rn
					realTime: 0,
					score: calculateLevelPoints(
						levelN!,
						Math.ceil(level.timeLeft / 60),
						level.bonusPoints
					),
					timeLeft: level.timeLeft,
				})
			} else if (level.gameState === GameState.DEATH) {
				setPlayerState("dead")
			} else if (level.gameState === GameState.TIMEOUT) {
				setPlayerState("timeout")
			} else if (level.gameState === GameState.CRASH) {
				setCaughtGlitch(
					[...level.glitches].find(gl => gl.isCrashing())?.toGlitchInfo() ??
						null
				)
				setPlayerState("crash")
			}
		}
	}, [
		level,
		inputMan,
		submitLevelAttempt,
		playerState,
		attempt,
		props.endOnNonlegalGlitch,
		props.levelFinished,
		levelN,
	])

	// Report embed ready
	const embedMode = useAtomValue(embedModeAtom)
	const setEmbedReady = useSetAtom(embedReadyAtom)
	useEffect(() => {
		if (!embedMode) return
		setEmbedReady(true)
	}, [embedMode])

	// Pregame
	useEffect(() => {
		if (playerState !== "pregame") return
		const listener = (ev: KeyboardEvent) => {
			if (!ev.shiftKey && !ev.ctrlKey && !ev.altKey && ev.code === "Space") {
				beginLevelAttempt()
			}
		}
		document.addEventListener("keydown", listener)
		inputMan.anyInputRef.current = beginLevelAttempt
		return () => {
			document.removeEventListener("keydown", listener)
			inputMan.anyInputRef.current = undefined
		}
	}, [playerState, inputMan])
	useEffect(() => {
		return () => {
			setWinInterruptResponse(null)
		}
	}, [])
	// Replay
	const [replay, setReplay] = useState<InputProvider | null>(null)
	const [solutionIsPlaying, setSolutionIsPlaying] = useState(true)
	const [solutionSpeedIdx, setSolutionSpeedIdx] = useState(TIMELINE_DEFAULT_IDX)
	const [solutionLevelProgress, setSolutionLevelProgress] = useState(0)
	const [solutionJumpProgress, setSolutionJumpProgress] = useState<
		number | null
	>(null)
	const solutionJumpTo = useCallback(
		async (progress: number) => {
			if (!replay) return
			let lvl = level
			setSolutionLevelProgress(progress)
			if (progress < replay.inputProgress(lvl.subticksPassed())) {
				lvl = props.level.initLevel()
				setLevel(lvl)
			}
			const WAIT_PERIOD = 20 * 40
			while (replay.inputProgress(lvl.subticksPassed()) < progress) {
				lvl.tick()
				lvl.tick()
				lvl.setProviderInputs(replay)
				lvl.tick()
				if (lvl.currentTick % WAIT_PERIOD === 0) {
					setSolutionJumpProgress(replay.inputProgress(lvl.subticksPassed()))
					await sleep(0)
				}
			}
			setSolutionJumpProgress(null)
		},
		[level, replay]
	)
	const autoTick =
		playerState === "play" || playerState === "dead" || playerState === "win"
	const tickTimer = useRef<CompensatingIntervalTimer | null>(null)
	const tickLevelRef = useRef(tickLevel)
	const rescheduleTimer = useCallback(() => {
		if (!autoTick || (replay && !solutionIsPlaying)) {
			tickTimer.current?.cancel()
			tickTimer.current = null
			return
		}
		tickLevelRef.current = tickLevel
		let timePeriod = 1 / 60
		if (replay) {
			timePeriod /= TIMELINE_PLAYBACK_SPEEDS[solutionSpeedIdx]
		}
		if (props.speedMult) {
			timePeriod /= props.speedMult
		}
		if (tickTimer.current) {
			tickTimer.current.adjust(timePeriod)
		} else {
			tickTimer.current = new CompensatingIntervalTimer(
				() => tickLevelRef.current(),
				timePeriod
			)
		}
	}, [
		autoTick,
		replay,
		solutionIsPlaying,
		solutionSpeedIdx,
		tickLevel,
		props.speedMult,
	])

	useLayoutEffect(() => {
		rescheduleTimer()
	}, [rescheduleTimer])
	useEffect(() => {
		return () => {
			tickTimer.current?.cancel()
			tickTimer.current = null
		}
	}, [])

	const portraitLayout = useMediaQuery({
		query: PORTRAIT_QUERY,
	})

	const cameraType = useMemo(
		() => ({
			width: level.metadata.cameraWidth,
			height: level.metadata.cameraHeight,
		}),
		[level]
	)

	const scaleArgs = useMemo<AutoScaleConfig>(
		() => ({
			cameraType,
			tileSize: tileset.tileSize,
			twPadding: portraitLayout ? [4, replay ? 14 : 6] : [6, replay ? 12 : 4],
			tilePadding: portraitLayout ? [0, 2] : [4, 0],
		}),
		[cameraType, tileset, portraitLayout, replay]
	)

	// Level stats

	const setScores = useAtomValue(setScoresAtom)
	const importantSet = useAtomValue(importantSetAtom)
	const levelScores = useMemo(
		() => setScores?.find(lvl => lvl.level === props.levelSet?.currentLevel),
		[props.levelSet?.currentLevel]
	)
	const [solutionMetrics, setSolutionMetrics] =
		useState<SolutionMetrics | null>(null)
	const [bestMetricsBeforeAttempt, setBestMetricsBeforeAttempt] =
		useState<SolutionMetrics | null>(null)

	const showTimeFraction = useAtomValue(showTimeFractionInMetricsAtom)

	const winStats = useMemo(() => {
		if (!solutionMetrics) return null
		const stats: LevelStatsBoxProps = {
			metrics: solutionMetrics,
			levelN: levelN!,
			showFraction: showTimeFraction,
			showScore: importantSet?.scoreboardHasScores ?? true,
		}
		if (bestMetricsBeforeAttempt) {
			stats.bestMetrics = bestMetricsBeforeAttempt
		}
		if (props.levelSet) {
			stats.totalMetrics = props.levelSet.totalMetrics()
		}
		if (levelScores) {
			stats.grades = getReportGradesForMetrics(
				{
					score: Math.max(stats.bestMetrics?.score ?? 0, solutionMetrics.score),
					timeLeft: Math.max(
						stats.bestMetrics?.timeLeft ?? 0,
						solutionMetrics.timeLeft
					),
					realTime: Math.min(
						stats.bestMetrics?.realTime ?? Infinity,
						solutionMetrics.realTime
					),
				},
				levelScores
			)
		}
		return stats
	}, [solutionMetrics, props.levelSet, levelN])

	// GUI stuff
	const scale = useAutoScale(scaleArgs)
	const mobileControls = "ontouchstart" in window
	const goToNextLevel = useJotaiFn(goToNextLevelGs)
	const setPage = useSetAtom(pageAtom)
	const [caughtGlitch, setCaughtGlitch] = useState<protobuf.IGlitchInfo | null>(
		null
	)
	const showPrompt = useJotaiFn(showPromptGs)

	let cover: VNode | null
	if (playerState === "pregame") {
		cover = (
			<PregameCover
				set={props.levelSet}
				level={level}
				mobile={mobileControls}
				onStart={beginLevelAttempt}
			/>
		)
	} else if (playerState === "dead" || playerState === "timeout") {
		cover = (
			<LoseCover timeout={playerState === "timeout"} onRestart={resetLevel} />
		)
	} else if (playerState === "win") {
		cover = (
			<WinCover
				onNextLevel={goToNextLevel}
				onSetSelector={() => setPage("")}
				onLevelList={() => showPrompt(LevelListPrompt)}
				onRestart={resetLevel}
				singleLevel={!props.levelSet}
				levelStats={winStats!}
			/>
		)
	} else if (playerState === "pause") {
		cover = <PauseCover onUnpause={() => setPlayerState("play")} />
	} else if (playerState === "nonlegal") {
		cover = <NonlegalCover glitch={caughtGlitch!} onRestart={resetLevel} />
	} else if (playerState === "crash") {
		cover = <CrashCover glitch={caughtGlitch!} onRestart={resetLevel} />
	} else if (playerState === "play" && portraitLayout) {
		cover = <MobileHintCover hintRef={hintRefAppl} />
	} else {
		cover = null
	}

	useEffect(() => {
		const controls: LevelControls = {
			restart() {
				resetLevel()
			},
			async playInputs(ip) {
				const level = resetLevel()
				applyLevelModifiers(level, ip.levelModifiers())
				setSolutionSpeedIdx(TIMELINE_DEFAULT_IDX)
				setReplay(ip)
				setPlayerState("play")
			},

			pause:
				playerState === "pause"
					? () => setPlayerState("play")
					: playerState === "play"
						? () => setPlayerState("pause")
						: undefined,
		}
		applyRef(props.controlsRef, controls)
		return () => {
			applyRef(props.controlsRef, null)
		}
	}, [props.controlsRef, playerState])

	return (
		<div
			class={twJoin(
				"box desktop:gap-4 desktop:p-4 desktop:text-lg m-auto flex flex-col gap-2 p-2 text-sm landscape:flex-row",
				mobileControls && "mt-0"
			)}
			style={{
				"--tile-size": `${scale * tileset.tileSize}px`,
			}}
		>
			<div class="flex flex-col gap-2">
				<div class="relative">
					<GameRenderer
						tileset={tileset}
						level={level}
						cameraType={cameraType}
						autoDraw={autoTick}
						tileScale={scale}
						playerSeat={playerSeat}
					/>
					<div class={twJoin("absolute top-0 h-full w-full")}>{cover}</div>
				</div>
				{replay && (
					<TimelineBox
						playing={solutionIsPlaying}
						speedIdx={solutionSpeedIdx}
						onSetSpeed={setSolutionSpeedIdx}
						onSetPlaying={setSolutionIsPlaying}
					>
						<Timeline onScrub={solutionJumpTo}>
							{solutionJumpProgress !== null && (
								<TimelineHead
									progress={solutionJumpProgress}
									class="bg-theme-600"
								/>
							)}
							<TimelineHead progress={solutionLevelProgress} />
						</Timeline>
					</TimelineBox>
				)}
			</div>
			<div
				// class2={
				// 	verticalLayout
				// 		? "flex h-[calc(var(--tile-size)_*_2)] w-auto flex-row-reverse justify-end gap-1"
				// 		: "desktop:gap-4 flex w-[calc(var(--tile-size)_*_4)] flex-col gap-2"
				// }
				class="flex flex-row-reverse gap-2 landscape:w-[calc(var(--tile-size_*_4))] landscape:flex-col"
			>
				<div class="desktop:gap-y-4 grid w-auto items-center justify-items-end gap-x-2 gap-y-1 [grid-template-columns:repeat(2,auto);] portrait:flex-1 landscape:ml-1">
					<div>
						<Ht haiku="Electronic chips:">Chips left:</Ht>
					</div>
					<div class="text-[1.5em]" ref={chipsLeftRef} />
					<div class="text-right">
						<Ht haiku="Moments until our game over:">Time left:</Ht>
					</div>
					<div class="text-[1.5em]" ref={timeLeftRef} />
					<div>
						<Ht haiku="Extra points for you:">Bonus points:</Ht>
					</div>
					<div class="text-[1.5em]" ref={bonusPointsRef} />
				</div>
				{playerSeat && (
					<div class="self-center">
						<Inventory
							tileset={tileset}
							tileScale={scale}
							inventory={playerSeat}
							renderRef={renderInventoryRef}
						/>
					</div>
				)}
				<NormalHintDisplay hintRef={hintRefAppl} />
			</div>
			<div class={twJoin("absolute", !mobileControls && "hidden")}>
				<MobileControls
					handler={inputMan.handler}
					possibleActionsRef={possibleActionsRef}
				/>
			</div>
		</div>
	)
}
