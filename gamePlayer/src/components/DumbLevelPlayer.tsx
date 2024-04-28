import {
	AttemptTracker,
	CameraType,
	GameState,
	Inventory as InventoryI,
	LevelData,
	LevelSet,
	createLevelFromData,
} from "@notcc/logic"
import { GameRenderer } from "./GameRenderer"
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
import { IntervalTimer, applyRef, sleep, useJotaiFn } from "@/helpers"
import { embedReadyAtom, embedModeAtom } from "@/routing"
import { MobileControls, useShouldShowMobileControls } from "./MobileControls"
import { keyToInputMap, keyboardEventSource, useKeyInputs } from "@/inputs"
import { twJoin, twMerge } from "tailwind-merge"
import { Ref, VNode } from "preact"
import { useMediaQuery } from "react-responsive"
import { Inventory } from "./Inventory"
import { borrowLevelSetGs } from "@/levelData"
import { goToNextLevel as goToNextLevelGs } from "@/levelData"
import { trivia } from "@/trivia"
import { LevelControls, SidebarReplayable } from "./Sidebar"
import {
	TIMELINE_PLAYBACK_SPEEDS,
	Timeline,
	TimelineBox,
	TimelineHead,
} from "./Timeline"
import { sfxAtom } from "./PreferencesPrompt/SfxPrompt"

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

function Cover(props: {
	class: string
	header: VNode
	buttons: [string, null | (() => void)][]
	focusedButton?: string
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
			{props.header}
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
	level: LevelData
	set?: LevelSet
	mobile?: boolean
	onStart: () => void
}) {
	return (
		<Cover
			class="from-black/20 to-black/50"
			header={
				<>
					{props.set && (
						<span class="mb-1 mt-6 text-xl">
							{props.set?.scriptRunner.state.gameTitle} #
							{props.set.scriptRunner.state.variables?.level}:
						</span>
					)}
					<h2 class={twJoin(!props.set && "mt-6", "text-5xl [line-height:1]")}>
						{props.level.name ?? "UNNAMED"}
					</h2>
					<span class="mt-1 text-2xl">by {props.level.author ?? "???"}</span>
				</>
			}
			buttons={props.mobile ? [["Start", props.onStart]] : []}
		/>
	)
}

function PauseCover(props: { onUnpause: () => void }) {
	const [triviaIdx] = useState(() => Math.floor(Math.random() * trivia.length))
	return (
		<Cover
			class="from-theme-900 to-theme-900"
			header={
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
			}
			buttons={[["Unpause", props.onUnpause]]}
		/>
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
			header={
				<>
					<h2 class="mt-6 text-5xl">
						{props.timeout ? "Ran out of time" : "You lost..."}
					</h2>
				</>
			}
			buttons={[["Restart", props.onRestart]]}
		/>
	)
}

function WinCover(props: { onNextLevel: () => void }) {
	return (
		<Cover
			class="from-yellow-900/30 to-yellow-600/70"
			header={
				<>
					<h2 class="mt-6 text-4xl">You won!</h2>
				</>
			}
			buttons={[
				["Level list", null],
				["Next level", props.onNextLevel],
				["Explode Jupiter", null],
			]}
			focusedButton="Next level"
		/>
	)
}

export function DumbLevelPlayer(props: {
	level: LevelData
	levelSet?: LevelSet
	controlsRef?: Ref<LevelControls | null>
}) {
	const tileset = useAtomValue(tilesetAtom)!
	const sfx = useAtomValue(sfxAtom)
	useEffect(() => {
		return () => sfx?.stopAllSfx()
	}, [])
	useEffect(() => {
		level.sfxManager = sfx
	}, [sfx])
	// if (!tileset) return <div class="box m-auto p-1">No tileset loaded.</div>

	const [playerState, setPlayerState] = useState("pregame" as PlayerState)

	// Inputs & LevelState
	const { inputs, releaseKeys, handler: inputHandler } = useKeyInputs()
	useEffect(() => {
		inputHandler.addEventSource(keyboardEventSource)
	}, [inputHandler])

	const [level, setLevel] = useState(() => createLevelFromData(props.level))
	const resetLevel = useCallback(() => {
		sfx?.stopAllSfx()
		setAttempt(null)
		setPlayingSolution(null)
		const level = createLevelFromData(props.level)
		setLevel(level)
		level.sfxManager = sfx
		setPlayerState("pregame")
		return level
	}, [sfx, props.level])
	useLayoutEffect(() => void resetLevel(), [props.level])
	useEffect(() => {
		level.gameInput = inputs
		setChipsLeft(level.chipsLeft)
		setTimeLeft(level.timeLeft)
		setBonusPoints(level.bonusPoints)
		setInventory(level.selectedPlayable?.inventory)
	}, [level])

	const renderInventoryRef = useRef<() => void>(null)

	const [chipsLeft, setChipsLeft] = useState(0)
	const [timeLeft, setTimeLeft] = useState(0)
	const [bonusPoints, setBonusPoints] = useState(0)
	const [inventory, setInventory] = useState<InventoryI | undefined>()
	const [hint, setHint] = useState<string | null>()
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
			const lInfo = lSet.seenLevels[lSet.currentLevel].levelInfo
			lInfo.attempts ??= []
			lInfo.attempts.push(att)
			setAttempt(null)
		})
	}, [attempt, borrowLevelSet])

	// Ticking
	const tickLevel = useCallback(() => {
		if (level.gameState === GameState.PLAYING) {
			attempt?.recordAttemptStep(inputs)
		}
		level.tick()
		renderInventoryRef.current?.()
		if (level.gameState === GameState.PLAYING) {
			if (replay) {
				setSolutionLevelProgress(replay.ip.inputProgress(level))
			}
			setChipsLeft(level.chipsLeft)
			setTimeLeft(level.timeLeft)
			setBonusPoints(level.bonusPoints)
			setInventory(level.selectedPlayable?.inventory)
			setHint(level.getHint()?.trim())
			releaseKeys(level.releasedKeys)
		} else if (playerState === "play") {
			submitLevelAttempt()
			if (level.gameState === GameState.WON) {
				setPlayerState("win")
			} else if (level.gameState === GameState.DEATH) {
				setPlayerState("dead")
			} else if (level.gameState === GameState.TIMEOUT) {
				setPlayerState("timeout")
			}
		}
	}, [level, releaseKeys, submitLevelAttempt, playerState, attempt])

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
			if (
				!ev.shiftKey &&
				!ev.ctrlKey &&
				!ev.altKey &&
				(ev.code in keyToInputMap || ev.code === "Space")
			) {
				beginLevelAttempt()
			}
		}
		document.addEventListener("keydown", listener)
		return () => document.removeEventListener("keydown", listener)
	}, [playerState])
	// Replay
	const [replay, setPlayingSolution] = useState<SidebarReplayable | null>(null)
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
			if (progress < replay.ip.inputProgress(lvl)) {
				lvl = createLevelFromData(props.level)
				lvl.inputProvider = replay.ip
				lvl.tick()
				lvl.tick()
				setLevel(lvl)
			}
			const WAIT_PERIOD = 20 * 40
			while (replay.ip.inputProgress(lvl) < progress) {
				lvl.tick()
				lvl.tick()
				lvl.tick()
				if (lvl.currentTick % WAIT_PERIOD === 0) {
					setSolutionJumpProgress(replay.ip.inputProgress(lvl))
					await sleep(0)
				}
			}
			setSolutionJumpProgress(null)
		},
		[level, replay]
	)
	const autoTick =
		playerState === "play" || playerState === "dead" || playerState === "win"
	const tickTimer = useRef<IntervalTimer | null>(null)
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
			tickTimer.current = new IntervalTimer(
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

	const scaleArgs = useMemo<AutoScaleConfig>(
		() => ({
			cameraType: level.cameraType,
			tileSize: tileset.tileSize,
			twPadding: verticalLayout ? [4, replay ? 14 : 6] : [6, replay ? 12 : 4],
			tilePadding: verticalLayout ? [0, 2] : [4, 0],
		}),
		[level, tileset, verticalLayout, replay]
	)

	// GUI stuff
	const scale = useAutoScale(scaleArgs)
	const shouldShowMobileControls = useShouldShowMobileControls()
	const goToNextLevel = useJotaiFn(goToNextLevelGs)

	let cover: VNode | null
	if (playerState === "pregame") {
		cover = (
			<PregameCover
				set={props.levelSet}
				level={props.level}
				mobile={shouldShowMobileControls}
				onStart={beginLevelAttempt}
			/>
		)
	} else if (playerState === "dead" || playerState === "timeout") {
		cover = (
			<LoseCover timeout={playerState === "timeout"} onRestart={resetLevel} />
		)
	} else if (playerState === "win") {
		cover = <WinCover onNextLevel={goToNextLevel} />
	} else if (playerState === "pause") {
		cover = <PauseCover onUnpause={() => setPlayerState("play")} />
	} else {
		cover = null
	}

	useEffect(() => {
		const controls: LevelControls = {
			restart() {
				resetLevel()
			},
			playInputs(replayable) {
				const lvl = resetLevel()
				setPlayingSolution(replayable)
				lvl.inputProvider = replayable.ip
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
						cameraType={level.cameraType}
						autoDraw={autoTick}
						tileScale={scale}
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
						"h-[calc(var(--tile-size)_*_2)]",
						verticalLayout && "flex-1",
						!verticalLayout && "ml-1 "
					)}
				>
					<div>Chips left:</div>
					<div class="text-[1.5em]">{chipsLeft}</div>
					<div>Time left:</div>
					<div class="text-[1.5em]">{Math.ceil(timeLeft / 60)}s</div>
					<div>Bonus points:</div>
					<div class="text-[1.5em]">{bonusPoints}</div>
				</div>
				{inventory && (
					<div class="self-center">
						<Inventory
							tileset={tileset}
							tileScale={scale}
							inventory={inventory}
							renderRef={renderInventoryRef}
						/>
					</div>
				)}
				{!verticalLayout && (
					<div class="bg-theme-950 flex-1 whitespace-pre-line rounded p-1">
						{hint}
					</div>
				)}
			</div>
			<div class={twJoin("absolute", !shouldShowMobileControls && "hidden")}>
				<MobileControls handler={inputHandler} />
			</div>
		</div>
	)
}
