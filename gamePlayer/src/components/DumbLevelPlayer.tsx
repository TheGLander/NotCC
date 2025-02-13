import {
	AttemptTracker,
	// CameraType,
	// GameState,
	InputProvider,
	LevelSet,
	Level,
	GameState,
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
	sleep,
	useJotaiFn,
} from "@/helpers"
import { embedReadyAtom, embedModeAtom, pageAtom } from "@/routing"
import { MobileControls, useShouldShowMobileControls } from "./MobileControls"
import { useGameInputs } from "@/inputs"
import { twJoin, twMerge } from "tailwind-merge"
import { ComponentChildren, Ref, VNode } from "preact"
import { useMediaQuery } from "react-responsive"
import { Inventory } from "./Inventory"
import { LevelData, borrowLevelSetGs } from "@/levelData"
import { goToNextLevelGs } from "@/levelData"
import { trivia } from "@/trivia"
import { LevelControls, SidebarReplayable } from "./Sidebar"
import {
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
import { Expl } from "./Expl"

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

	return Math.min(xScale, yScale)
}

export function useAutoScale(args: AutoScaleConfig) {
	const [scale, setScale] = useState(1)
	function resize() {
		setScale(Math.floor(calcScale(args)))
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
				<div class="box mb-5 mt-auto flex h-20 w-4/5 flex-row gap-1">
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
				<span class="mb-1 mt-6 text-xl">
					{props.set.gameTitle()} #{props.set.currentLevel}:
				</span>
			)}
			<h2 class={twJoin(!props.set && "mt-6", "text-5xl [line-height:1]")}>
				{props.level.metadata.title ?? "UNNAMED"}
			</h2>
			<span class="mt-1 text-2xl">
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
				<h2 class="mt-6 text-left text-5xl">Paused</h2>
				<div class="bg-theme-950 relative my-auto w-4/5 rounded p-2 text-left [text-shadow:initial]">
					<div class="mb-1 text-lg">Did you know?</div>
					{trivia[triviaIdx]}
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

type ReportGrade = "b+" | "bc" | "pc" | "b" | "p+" | "p" | "s" | "u"

function Bi(props: { children?: ComponentChildren }) {
	return (
		<strong>
			<em>{props.children}</em>
		</strong>
	)
}
function Sm(props: { children?: ComponentChildren }) {
	return <span class="text-sm">{props.children}</span>
}

const gradeMap: Record<ReportGrade, VNode> = {
	"b+": (
		<Bi>
			B<Sm>old</Sm>+
		</Bi>
	),
	bc: (
		<Bi>
			B<Sm>old</Sm>C<Sm>onf</Sm>
		</Bi>
	),
	pc: (
		<Bi>
			P<Sm>art</Sm>C<Sm>onf</Sm>
		</Bi>
	),
	b: (
		<strong>
			B<Sm>old</Sm>
		</strong>
	),
	"p+": (
		<>
			P<Sm>ublic</Sm>+
		</>
	),
	p: (
		<>
			P<Sm>ublic</Sm>
		</>
	),
	s: (
		<>
			S<Sm>olved</Sm>
		</>
	),
	u: (
		<>
			U<Sm>nsolved</Sm>
		</>
	),
}

export function ExplGrade() {
	return (
		<Expl title="Score grade" mode="dialog">
			<div class="grid gap-2 [grid-template-columns:repeat(2,auto);]">
				<div>Grade</div>
				<div>Meaning</div>
				<Grade grade="b+" />
				<div>
					Better than bold. You've achieved a higher score than what is on the
					scoreboards! Report it and be part of Chips history!
				</div>
				<Grade grade="bc" />
				<div>
					Bold Confirm. You're the second person to achieve this score, thus{" "}
					<i>confirming</i> the <i>unconfirmed</i> score.
				</div>
				<Grade grade="pc" />
				<div>
					Partial Confirm. You've achieved a score higher than the highest
					confirmed score, but lower than the unconfirmed score, thus confirming
					that the unconfirmed score is at least <i>partially</i> real.
				</div>
				<Grade grade="b" />
				<div>Bold. Same as highest known/reported score for this level.</div>
				<Grade grade="p+" />
				<div>
					Better than public. This score is better than the score of the public
					route, but is less than bold.
				</div>
				<Grade grade="p" />
				<div>Public. This score matches the public route score.</div>
				<Grade grade="s" />
				<div>Solved. This score is worse than the public route score.</div>
				<Grade grade="u" />
				<div>Unsolved. This level has not been solved yet.</div>
			</div>
		</Expl>
	)
}

function Grade(props: { grade: ReportGrade }) {
	return (
		<span>
			<span class="text-lg">{gradeMap[props.grade]}</span>
		</span>
	)
}

function WinCover(props: {
	onNextLevel: () => void
	onRestart: () => void
	onSetSelector: () => void
	singleLevel: boolean
}) {
	const buttons: CoverButton[] = props.singleLevel
		? [
				["Restart", props.onRestart],
				["Back to set selector", props.onSetSelector],
				["Explode Jupiter", null],
			]
		: [
				["Level list", null],
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
				{/* <div class="box my-auto w-4/5 rounded p-2 text-left [text-shadow:initial]"> */}
				{/* 	<div class="grid w-auto items-center justify-items-end gap-x-2 [grid-template-columns:repeat(4,auto);]"> */}
				{/* 		<div>Metric</div> */}
				{/* 		<div>This run</div> */}
				{/* 		<div>Best run</div> */}
				{/* 		<div> */}
				{/* 			Grade */}
				{/* 			<ExplGrade /> */}
				{/* 		</div> */}
				{/* 		<div>Time</div> */}
				{/* 		<div>123s</div> */}
				{/* 		<div>125s</div> */}
				{/* 		<div> */}
				{/* 			<Grade grade="pc" /> */}
				{/* 		</div> */}
				{/* 		<div>Score</div> */}
				{/* 		<div>4000pts</div> */}
				{/* 		<div>3900pts</div> */}
				{/* 		<div> */}
				{/* 			<Grade grade="p+" /> */}
				{/* 		</div> */}
				{/* 	</div> */}
				{/* 	<div class="mt-4"> */}
				{/* 		<div> */}
				{/* 			Total set time: 1000s / 10.7 ABC (unreported: 12s / 0.4 ABC) */}
				{/* 		</div> */}
				{/* 		<div> */}
				{/* 			Total set score: 100000pts / 12.3 ABC (unreported: 1200pts / 1.6 */}
				{/* 			ABC) */}
				{/* 		</div> */}
				{/* 	</div> */}
				{/* </div> */}
			</div>
		</Cover>
	)
}

type SimpleSidebarReplayable = Omit<SidebarReplayable, "ip"> & {
	ip: InputProvider
}

export function DumbLevelPlayer(props: {
	level: LevelData
	levelSet?: LevelSet
	controlsRef?: Ref<LevelControls | null>
	preventSimultaneousMovement?: boolean
	endOnNonlegalGlitch?: boolean
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

	const resetLevel = useCallback(() => {
		sfx?.stopAllSfx()
		setAttempt(null)
		setReplay(null)
		const level = props.level.initLevel()
		// @ts-ignore
		globalThis.NotCC.player = { level }
		setLevel(level)
		setPlayerState("pregame")
		return level
	}, [sfx, props.level])
	useLayoutEffect(() => void resetLevel(), [props.level])

	const renderInventoryRef = useRef<() => void>(null)

	const timeLeftRef = useRef<HTMLDivElement>(null)
	const chipsLeftRef = useRef<HTMLDivElement>(null)
	const bonusPointsRef = useRef<HTMLDivElement>(null)
	const hintRef = useRef<HTMLDivElement>(null)
	const updateLevelMetrics = useCallback(() => {
		timeLeftRef.current!.innerText = `${Math.ceil(level.timeLeft / 60)}s`
		chipsLeftRef.current!.innerText = level.chipsLeft.toString()
		bonusPointsRef.current!.innerText = `${level.bonusPoints}pts`
		if (hintRef.current) {
			hintRef.current.innerText = playerSeat.displayedHint ?? ""
		}
	}, [level])
	useLayoutEffect(() => {
		updateLevelMetrics()
	}, [updateLevelMetrics])

	// Attempt tracking
	const [attempt, setAttempt] = useState<null | AttemptTracker>(null)
	function beginLevelAttempt() {
		setPlayerState("play")
		// setAttempt(
		// 	new AttemptTracker(
		// 		level.blobPrngValue,
		// 		level.randomForceFloorDirection,
		// 		props.levelSet?.scriptRunner.state
		// 	)
		// )
	}
	const borrowLevelSet = useJotaiFn(borrowLevelSetGs)
	const submitLevelAttempt = useCallback(() => {
		if (embedMode || !attempt) return
		const att = attempt.endAttempt(level)
		borrowLevelSet(lSet => {
			lSet.logAttemptInfo(att)
			setAttempt(null)
		})
	}, [attempt, borrowLevelSet])

	// Ticking
	const tickLevel = useCallback(() => {
		if (replay) {
			level.setProviderInputs(replay.ip)
		} else {
			inputMan.setLevelInputs()
		}
		if (level.gameState === GameState.PLAYING) {
			attempt?.recordAttemptStep(level)
		}
		level.tick()
		inputMan.setReleasedInputs()
		sfx?.processSfxField(level.sfx)
		if (props.endOnNonlegalGlitch) {
			for (const glitch of level.glitches) {
				if (isGlitchKindNonlegal(glitch.glitchKind)) {
					setCaughtGlitch(glitch.toGlitchInfo())
					setPlayerState("nonlegal")
					return
				}
			}
		}
		if (level.gameState === GameState.PLAYING) {
			renderInventoryRef.current?.()
			if (replay) {
				setSolutionLevelProgress(
					replay.ip.inputProgress(level.subticksPassed())
				)
			}
			updateLevelMetrics()
		} else if (playerState === "play") {
			submitLevelAttempt()
			if (level.gameState === GameState.WON) {
				setPlayerState("win")
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
	// Replay
	const [replay, setReplay] = useState<SimpleSidebarReplayable | null>(null)
	const [solutionIsPlaying, setSolutionIsPlaying] = useState(true)
	const [solutionSpeedIdx, setSolutionSpeedIdx] = useState(3)
	const [solutionLevelProgress, setSolutionLevelProgress] = useState(0)
	const [solutionJumpProgress, setSolutionJumpProgress] = useState<
		number | null
	>(null)
	const solutionJumpTo = useCallback(
		async (progress: number) => {
			if (!replay) return
			let lvl = level
			setSolutionLevelProgress(progress)
			if (progress < replay.ip.inputProgress(lvl.subticksPassed())) {
				lvl = props.level.initLevel()
				lvl.tick()
				lvl.tick()
				setLevel(lvl)
			}
			const WAIT_PERIOD = 20 * 40
			while (replay.ip.inputProgress(lvl.subticksPassed()) < progress) {
				lvl.tick()
				lvl.tick()
				lvl.setProviderInputs(replay.ip)
				lvl.tick()
				if (lvl.currentTick % WAIT_PERIOD === 0) {
					setSolutionJumpProgress(replay.ip.inputProgress(lvl.subticksPassed()))
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
		if (tickTimer.current) {
			tickTimer.current.adjust(timePeriod)
		} else {
			tickTimer.current = new CompensatingIntervalTimer(
				() => tickLevelRef.current(),
				timePeriod
			)
		}
	}, [autoTick, replay, solutionIsPlaying, solutionSpeedIdx, tickLevel])

	useLayoutEffect(() => {
		rescheduleTimer()
	}, [rescheduleTimer])
	useEffect(() => {
		return () => {
			tickTimer.current?.cancel()
			tickTimer.current = null
		}
	}, [])

	const verticalLayout = !useMediaQuery({
		query: "(min-aspect-ratio: 1/1)",
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
			twPadding: verticalLayout ? [4, replay ? 14 : 6] : [6, replay ? 12 : 4],
			tilePadding: verticalLayout ? [0, 2] : [4, 0],
		}),
		[cameraType, tileset, verticalLayout, replay]
	)

	// GUI stuff
	const scale = useAutoScale(scaleArgs)
	const shouldShowMobileControls = useShouldShowMobileControls()
	const goToNextLevel = useJotaiFn(goToNextLevelGs)
	const setPage = useSetAtom(pageAtom)
	const [caughtGlitch, setCaughtGlitch] = useState<protobuf.IGlitchInfo | null>(
		null
	)

	let cover: VNode | null
	if (playerState === "pregame") {
		cover = (
			<PregameCover
				set={props.levelSet}
				level={level}
				mobile={shouldShowMobileControls}
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
				onRestart={resetLevel}
				singleLevel={!props.levelSet}
			/>
		)
	} else if (playerState === "pause") {
		cover = <PauseCover onUnpause={() => setPlayerState("play")} />
	} else if (playerState === "nonlegal") {
		cover = <NonlegalCover glitch={caughtGlitch!} onRestart={resetLevel} />
	} else if (playerState === "crash") {
		cover = <CrashCover glitch={caughtGlitch!} onRestart={resetLevel} />
	} else {
		cover = null
	}

	useEffect(() => {
		const controls: LevelControls = {
			restart() {
				resetLevel()
			},
			async playInputs(repl) {
				if (typeof repl.ip === "function") {
					repl.ip = await repl.ip()
				}
				const level = resetLevel()
				repl.ip.setupLevel(level)
				setReplay(repl as SimpleSidebarReplayable)
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
				"box m-auto flex gap-2 p-2 max-md:text-sm lg:gap-4 lg:p-4 lg:text-lg",
				verticalLayout && "flex-col",
				!verticalLayout && "flex-row"
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
				class={
					verticalLayout
						? "flex h-[calc(var(--tile-size)_*_2)] w-auto flex-row-reverse justify-end gap-1"
						: "flex w-[calc(var(--tile-size)_*_4)] flex-col gap-2 lg:gap-4"
				}
			>
				<div
					class={twJoin(
						"grid w-auto items-center justify-items-end gap-x-2 [grid-template-columns:repeat(2,auto);]",
						"gap-y-1 lg:gap-y-4",
						verticalLayout && "flex-1",
						!verticalLayout && "ml-1 "
					)}
				>
					<div>Chips left:</div>
					<div class="text-[1.5em]" ref={chipsLeftRef} />
					<div>Time left:</div>
					<div class="text-[1.5em]" ref={timeLeftRef} />
					<div>Bonus points:</div>
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
				{!verticalLayout && (
					<div
						class="bg-theme-950 flex-1 whitespace-pre-line rounded p-1"
						ref={hintRef}
					></div>
				)}
			</div>
			<div class={twJoin("absolute", !shouldShowMobileControls && "hidden")}>
				<MobileControls handler={inputMan.handler} />
			</div>
		</div>
	)
}
