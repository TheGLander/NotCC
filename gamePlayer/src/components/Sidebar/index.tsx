import { ComponentChildren, ComponentProps, Ref, createContext } from "preact"
import leafIcon from "./tabIcons/leaf.svg"
import levelIcon from "./tabIcons/level.svg"
import floppyIcon from "./tabIcons/floppy.svg"
import clockIcon from "./tabIcons/clock.svg"
import toolsIcon from "./tabIcons/tools.svg"
import infoIcon from "./tabIcons/info.svg"
import {
	useContext,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "preact/hooks"
import { forwardRef } from "preact/compat"
import { twJoin } from "tailwind-merge"
import { useMediaQuery } from "react-responsive"
import { Getter, Setter, atom, useAtomValue, useStore } from "jotai"
import { levelSetIdentAtom, pageAtom } from "@/routing"
import { showPromptGs } from "@/prompts"
import { AboutPrompt } from "../AboutDialog"
import { applyRef, formatTimeLeft, keypressIsFocused } from "@/helpers"
import { PreferencesPrompt } from "../PreferencesPrompt"
import isHotkey from "is-hotkey"
import { openExaCC, toggleExaCC } from "@/pages/ExaPlayerPage/OpenExaPrompt"
import {
	goToNextLevelGs,
	goToPreviousLevelGs,
	levelAtom,
	levelSetAtom,
	useSwrLevel,
} from "@/levelData"
import { Expl } from "../Expl"
import backfeedPruningImg from "./backfeedPruning.png"
import {
	InputProvider,
	ReplayInputProvider,
	Route,
	RouteFileInputProvider,
	SolutionInfoInputProvider,
	calculateLevelPoints,
	protoTimeToMs,
} from "@notcc/logic"
import { protobuf } from "@notcc/logic"
import { RRLevel, RRRoute, getRRLevel, setRRRoutesAtom } from "@/railroad"
import { Toast, addToastGs, removeToastGs } from "@/toast"
import { showLoadPrompt } from "@/fs"
import { LevelListPrompt } from "../LevelList"
import { unwrap } from "jotai/utils"
import { Ht } from "../Ht"
import { MOBILE_QUERY, PORTRAIT_QUERY } from "../../../tailwind.config"

export interface LevelControls {
	restart?(): void
	pause?(): void
	saveMapScreenshot?(): void
	playInputs?(ip: InputProvider): void
	exa?: {
		undo(): void
		redo(): void
		save?(): void
		export(): void
		purgeBackfeed?(): void
		cameraControls(): void
		tileInspector(): void
		levelModifiersControls(): void
	}
}

export const levelControlsAtom = atom<LevelControls>({})

interface SidebarAction {
	label: ComponentChildren
	expl?: ComponentChildren
	shortcut?: string
	disabled?: boolean
	onTrigger?: (get: Getter, set: Setter) => void
}

const SidebarActionContext = createContext<SidebarAction[]>([])

function ChooserButton(props: SidebarAction) {
	const { get, set } = useStore()
	const sidebarActions = useContext(SidebarActionContext)
	useEffect(() => {
		sidebarActions.push(props)
		return () => {
			sidebarActions.splice(sidebarActions.indexOf(props), 1)
		}
	}, [props])
	const isDisabled = props.disabled || !props.onTrigger
	return (
		<div
			class={twJoin(
				"closes-tooltip flex w-full flex-row px-2 py-1",
				!isDisabled &&
					"hover:bg-theme-950 focus-visible:bg-theme-950 cursor-pointer"
			)}
			tabIndex={isDisabled ? undefined : 0}
			onClick={() => {
				if (!isDisabled) {
					props.onTrigger?.(get, set)
				}
			}}
		>
			<div
				class={twJoin(
					"closes-tooltip w-max ",
					isDisabled && "text-neutral-400"
				)}
			>
				{props.label}
				{props.expl && (
					<Expl mode="dialog" title={props.label}>
						{props.expl}
					</Expl>
				)}
			</div>
			{props.shortcut && (
				<div class="closes-tooltip mobile:hidden ml-auto pb-1 pl-8">
					{props.shortcut}
				</div>
			)}
		</div>
	)
}

function useSidebarChooserAnim<T extends HTMLElement>(
	open: boolean
): {
	ref: Ref<T>
	closingAnim: boolean
	endClosingAnim: () => void
	shouldRender: boolean
} {
	const [wasOpen, setWasOpen] = useState(false)
	if (!wasOpen && open) {
		setWasOpen(true)
	}

	const ref = useRef<T>(null)
	const [closingAnim, setClosingAnim] = useState(false)

	useLayoutEffect(() => {
		if (wasOpen && !open) {
			setClosingAnim(true)
			// REFLOW the main div so that the new animation plays
			void ref.current?.offsetHeight
		}
	}, [wasOpen, open])
	function endClosingAnim() {
		if (closingAnim) {
			setWasOpen(false)
			setClosingAnim(false)
		}
	}
	return { ref, closingAnim, endClosingAnim, shouldRender: open || closingAnim }
}

const SidebarTooltip = forwardRef<
	HTMLDialogElement,
	ComponentProps<"dialog"> & { reverse?: boolean }
>(function SidebarTooltip(props, fref) {
	const { endClosingAnim, closingAnim, ref, shouldRender } =
		useSidebarChooserAnim<HTMLDivElement>(!!props.open)

	return (
		<div
			class={twJoin(
				"absolute left-full z-10 flex",
				props.reverse
					? "bottom-1/3 [transform-origin:theme(spacing.2)_calc(100%_-_theme(spacing.2))]"
					: "top-1/3 [transform-origin:theme(spacing.2)_theme(spacing.2)]",
				props.open && "animate-tooltip-open",
				closingAnim && "animate-tooltip-close",
				!shouldRender && "hidden"
			)}
			onAnimationEnd={endClosingAnim}
			ref={ref}
		>
			<div
				class={twJoin(
					"border-r-theme-900 mr-[-4px] inline-block h-0 w-0 border-8 border-transparent",
					props.reverse && "mt-auto"
				)}
			/>
			<dialog
				{...props}
				open={props.open || shouldRender}
				tabIndex={0}
				ref={fref}
				class="box static border-none shadow-2xl"
			/>
		</div>
	)
})

const SidebarDrawer = forwardRef<HTMLDialogElement, ComponentProps<"dialog">>(
	function SidebarDrawer(props, fref) {
		const { endClosingAnim, closingAnim, ref, shouldRender } =
			useSidebarChooserAnim<HTMLDialogElement>(!!props.open)

		return (
			<dialog
				{...props}
				open={props.open || shouldRender}
				ref={dialog => {
					applyRef(ref, dialog)
					applyRef(fref, dialog)
				}}
				onAnimationEnd={endClosingAnim}
				class={twJoin(
					"box fixed bottom-20 left-0 right-0 z-10 mx-auto w-screen rounded-b-none border-b-0 shadow-none [transform-origin:0_100%] landscape:bottom-0 landscape:left-20 landscape:w-[calc(100vw_-_theme(spacing.20))]",
					props.open && "animate-drawer-open",
					closingAnim && "animate-drawer-close",
					!shouldRender && "hidden"
				)}
			/>
		)
	}
)

function SidebarButton(props: {
	icon: string
	children: ComponentChildren
	addMargin?: boolean
	reverse?: boolean
}) {
	const [tooltipOpened, setTooltipOpened] = useState(false)
	const onDialogMount = (dialog: HTMLDialogElement | null) => {
		if (tooltipOpened && dialog) {
			dialog.focus()
		}
	}
	const isMobile = useMediaQuery({
		query: MOBILE_QUERY,
	})
	const isPortrait = useMediaQuery({ query: PORTRAIT_QUERY })

	const SidebarChooser = isMobile || isPortrait ? SidebarDrawer : SidebarTooltip

	return (
		<div
			class={twJoin(
				"mobile:min-h-0 mobile:flex-1 relative flex",
				props.addMargin && "landscape:mt-auto"
			)}
		>
			<img
				tabIndex={0}
				draggable={false}
				src={props.icon}
				class="m-auto block h-4/5 cursor-pointer select-none"
				onClick={() => {
					setTooltipOpened(true)
				}}
			/>
			<SidebarChooser
				open={tooltipOpened}
				onFocusOut={ev => {
					if (
						ev.relatedTarget &&
						(ev.target as HTMLElement).contains(ev.relatedTarget as HTMLElement)
					)
						return
					setTooltipOpened(false)
				}}
				ref={onDialogMount}
				reverse={props.reverse}
			>
				<div
					class="flex flex-col"
					onClick={ev => {
						if (
							(ev.target as HTMLElement).classList.contains("closes-tooltip")
						) {
							setTooltipOpened(false)
						}
					}}
				>
					{props.children}
				</div>
			</SidebarChooser>
		</div>
	)
}

interface SidebarReplayable {
	name: string
	metric: string
	ip: LoadableInputProvider
}

export type LoadableInputProvider =
	| InputProvider
	| (() => Promise<InputProvider>)

function getAttemptSolutions(
	attempts: protobuf.IAttemptInfo[],
	currentLevel: number
) {
	const sols = []
	let bestTime: protobuf.ISolutionInfo | null = null
	let bestScore: protobuf.ISolutionInfo | null = null
	let bestScoreVal = -Infinity
	let last: protobuf.ISolutionInfo | null = null
	for (const attempt of attempts) {
		const sol = attempt.solution
		if (!sol) continue
		last = sol
		if (
			sol.outcome?.timeLeft != undefined &&
			(!bestTime ||
				protoTimeToMs(sol.outcome.timeLeft) >
					protoTimeToMs(bestTime.outcome!.timeLeft!))
		) {
			bestTime = sol
		}
		if (
			sol.outcome?.bonusScore != undefined &&
			sol.outcome?.timeLeft != undefined
		) {
			const score = calculateLevelPoints(
				currentLevel,
				Math.ceil(protoTimeToMs(sol.outcome.timeLeft) / 1000),
				sol.outcome.bonusScore
			)
			if (!bestScore || score > bestScoreVal) {
				bestScore = sol
				bestScoreVal = score
			}
		}
	}
	function makeMetrics(sol: protobuf.ISolutionInfo) {
		const score = calculateLevelPoints(
			currentLevel,
			Math.ceil(protoTimeToMs(sol.outcome!.timeLeft!) / 1000),
			sol.outcome!.bonusScore!
		)
		return `${Math.ceil(
			protoTimeToMs(sol.outcome!.timeLeft!) / 1000
		)}s / ${score}pts`
	}
	if (bestTime || bestScore) {
		if (bestTime === bestScore) {
			sols.push({
				name: "Best",
				metric: makeMetrics(bestTime!),
				ip: new SolutionInfoInputProvider(bestTime!),
			})
		} else {
			sols.push({
				name: "Best time",
				metric: makeMetrics(bestTime!),
				ip: new SolutionInfoInputProvider(bestTime!),
			})
			sols.push({
				name: "Best score",
				metric: makeMetrics(bestScore!),
				ip: new SolutionInfoInputProvider(bestScore!),
			})
		}
	}
	if (last && last !== bestTime && last !== bestScore) {
		sols.push({
			name: "Last",
			metric: makeMetrics(last),
			ip: new SolutionInfoInputProvider(last),
		})
	}
	return sols
}

function ReplayableTooltipList(props: {
	replayables: SidebarReplayable[]
	controls: LevelControls
}) {
	return (
		<>
			{props.replayables.map(sol => (
				<ChooserButton
					label={`${sol.name} ${sol.metric}`}
					onTrigger={async () => {
						props.controls.playInputs?.(
							typeof sol.ip === "function" ? await sol.ip() : sol.ip
						)
					}}
				/>
			))}
		</>
	)
}

function SolutionsTooltipList(props: { controls: LevelControls }) {
	const lSet = useAtomValue(levelSetAtom)
	const level = useSwrLevel()
	if (!level || !props.controls.playInputs)
		return <div class="mx-2 my-1">N/A</div>
	const sols: SidebarReplayable[] = []
	if (level.replay) {
		const replayLength = Math.round(level.replay.inputs.length / 20)
		sols.push({
			name: "Built-in",
			metric: `${Math.floor(replayLength / 60)}:${(replayLength % 60)
				.toString()
				.padStart(2, "0")}`,
			ip: new ReplayInputProvider(level.replay),
		})
	}
	const attempts = lSet?.currentLevelRecord().levelInfo.attempts
	if (attempts) {
		sols.push(...getAttemptSolutions(attempts, lSet.currentLevel))
	}
	if (sols.length === 0) return <div class="mx-2 my-1">None</div>
	return <ReplayableTooltipList controls={props.controls} replayables={sols} />
}

function getRRRoutes(
	routes: RRLevel[],
	levelN: number,
	packId: string,
	get?: Getter,
	set?: Setter
): SidebarReplayable[] {
	const rrLevel = routes.find(lvl => lvl.levelN === levelN)
	if (!rrLevel || !rrLevel.mainlineTimeRoute || !rrLevel.mainlineScoreRoute)
		return []
	function makeMetrics(route: RRRoute) {
		return `${formatTimeLeft(Math.round(route.timeLeft * 60))}s / ${route.points}pts`
	}
	function fetchIp(route: RRRoute) {
		return async () => {
			const toast: Toast = { title: "Fetching Railroad route..." }
			if (get && set) {
				addToastGs(get, set, toast)
			}
			const level = await getRRLevel(packId, levelN)
			if (get && set) {
				removeToastGs(get, set, toast)
			}
			return new RouteFileInputProvider(
				level.routes.find(route2 => route2.id === route.id)!.moves!
			)
		}
	}
	const tRoute = rrLevel.routes.find(
		route => route.id === rrLevel.mainlineTimeRoute
	)!
	const sRoute = rrLevel.routes.find(
		route => route.id === rrLevel.mainlineScoreRoute
	)!
	if (tRoute === sRoute) {
		return [
			{
				name: "Railroad",
				metric: makeMetrics(tRoute),
				ip: fetchIp(tRoute),
			},
		]
	}
	return [
		{ name: "Railroad time", metric: makeMetrics(tRoute), ip: fetchIp(tRoute) },
		{
			name: "Railroad score",
			metric: makeMetrics(sRoute),
			ip: fetchIp(sRoute),
		},
	]
}

function RoutesTooltipList(props: { controls: LevelControls }) {
	const levelSet = useAtomValue(levelSetAtom)
	const rrRoutes = useAtomValue(setRRRoutesAtom)
	const setIdent = useAtomValue(levelSetIdentAtom)
	const { get, set } = useStore()
	const routes: SidebarReplayable[] = []
	if (levelSet && rrRoutes) {
		routes.push(
			...getRRRoutes(rrRoutes, levelSet.currentLevel, setIdent!, get, set)
		)
	}
	return (
		<ReplayableTooltipList controls={props.controls} replayables={routes} />
	)
}

async function importRoute(controls: LevelControls) {
	const routeFiles = await showLoadPrompt("Load routefile", {
		filters: [
			{ name: "Routefile", extensions: ["route"] },
			{ name: "MS/Lynx route to transcribe", extensions: ["json"] },
		],
	})
	const routeFile = routeFiles?.[0]
	if (!routeFile) return
	const route: Route = JSON.parse(await routeFile.text())
	if (!route.Rule) return
	controls.playInputs?.(new RouteFileInputProvider(route))
}

const wrappedLevelAtom = unwrap(levelAtom)

export function Sidebar() {
	const sidebarActions: SidebarAction[] = useRef([]).current
	const levelControls = useAtomValue(levelControlsAtom)
	const { get, set } = useStore()
	const hasSet = !!get(levelSetAtom)
	useEffect(() => {
		const listener = (ev: KeyboardEvent) => {
			if (keypressIsFocused(ev)) return
			for (const action of sidebarActions) {
				if (!action.shortcut) continue
				if (!isHotkey(action.shortcut)(ev)) continue
				if (action.disabled || !action.onTrigger) continue
				ev.preventDefault()
				action.onTrigger(get, set)
			}
		}
		document.addEventListener("keydown", listener)
		return () => {
			document.removeEventListener("keydown", listener)
		}
	}, [levelControls])
	const hasLevel = !!useSwrLevel()
	return (
		<SidebarActionContext.Provider value={sidebarActions}>
			<div
				class="box desktop:landscape:gap-4 desktop:landscape:py-2 sticky z-10 flex h-20 w-full flex-row rounded-none border-none p-0 portrait:bottom-[env(safe-area-inset-bottom,_0px)] landscape:h-full landscape:w-20 landscape:flex-col"
				id="sidebar"
			>
				<SidebarButton icon={leafIcon}>
					<ChooserButton
						label={<Ht haiku="Choose a set to play">Set selector</Ht>}
						shortcut="Escape"
						onTrigger={(_get, set) => set(pageAtom, "")}
					/>
				</SidebarButton>
				{/* TODO dynamic icon */}
				<SidebarButton icon={levelIcon}>
					<ChooserButton
						label={<Ht haiku="Try again, test new ideas">Reset level</Ht>}
						shortcut="Shift+R"
						disabled={!levelControls.restart}
						onTrigger={() => levelControls.restart!()}
					/>
					<ChooserButton
						label={<Ht haiku="Pause a bit and rest">Pause</Ht>}
						shortcut="P"
						disabled={!levelControls.pause}
						onTrigger={() => levelControls.pause!()}
					/>
					<hr class="mx-2 my-1" />
					<ChooserButton
						label={<Ht haiku="Another level">Next level</Ht>}
						shortcut="Shift+N"
						disabled={!hasSet}
						onTrigger={goToNextLevelGs}
					/>
					<ChooserButton
						label={
							<Ht haiku="That one you skipped twice before">Previous level</Ht>
						}
						shortcut="Shift+P"
						disabled={!hasSet}
						onTrigger={goToPreviousLevelGs}
					/>
					<ChooserButton
						label={<Ht haiku="The full arrangement">Level list</Ht>}
						shortcut="Shift+S"
						disabled={!hasSet}
						onTrigger={() => showPromptGs(get, set, LevelListPrompt)}
					/>
					<hr />
					<ChooserButton
						label="Save full map screenshot"
						shortcut="Ctrl+Shift+P"
						disabled={!levelControls.saveMapScreenshot}
						onTrigger={() => levelControls.saveMapScreenshot!()}
					/>
				</SidebarButton>
				<SidebarButton icon={floppyIcon}>
					<div class="mx-2">
						<Ht haiku="Your correct replays:">Solutions:</Ht>
					</div>
					<SolutionsTooltipList controls={levelControls} />
					<ChooserButton
						label={<Ht haiku="All of the attempts are there">All attempts</Ht>}
						shortcut="Shift+A"
					/>
					<hr class="mx-2 my-1" />
					<div class="mx-2">
						<Ht haiku="Pre-existing plays:">Routes:</Ht>
					</div>
					<RoutesTooltipList controls={levelControls} />
					<ChooserButton
						label={<Ht haiku="Add one to the world">Import route...</Ht>}
						shortcut="Shift+I"
						onTrigger={() => importRoute(levelControls)}
						disabled={!hasLevel}
					/>
					<ChooserButton
						label={<Ht haiku="Routings' complete collection">All routes</Ht>}
					/>
				</SidebarButton>
				<SidebarButton icon={clockIcon}>
					<ChooserButton
						label={<Ht haiku="A time-travel tool">Toggle ExaCC</Ht>}
						shortcut="Shift+X"
						disabled={!hasLevel}
						onTrigger={toggleExaCC}
						expl={
							<>
								ExaCC is a tool for routing levels based on NotCC's game logic.
							</>
						}
					/>
					<ChooserButton
						label={<Ht haiku="Try any new route">New or Open ExaCC project</Ht>}
						shortcut="Ctrl+Shift+X"
						disabled={!hasLevel}
						onTrigger={(get, set) => {
							const level = get(wrappedLevelAtom)
							if (!level) return
							openExaCC(get, set, level)
						}}
					/>
					<ChooserButton
						label={
							<Ht haiku="Please make sure to save sometimes">Save project</Ht>
						}
						shortcut="Ctrl+S"
						disabled={!levelControls.exa?.save}
						onTrigger={() => levelControls.exa!.save!()}
					/>
					<ChooserButton
						label={<Ht haiku="Save it locally">Export current route</Ht>}
						shortcut="Shift+E"
						disabled={!levelControls.exa}
						onTrigger={() => levelControls.exa!.export()}
					/>
					<hr />
					<ChooserButton
						label={<Ht haiku="Erase a mistake">Undo</Ht>}
						shortcut="Backspace"
						onTrigger={() => {
							levelControls.exa!.undo()
						}}
						disabled={!levelControls.exa}
					/>
					<ChooserButton
						label={<Ht haiku="Check if that move was okay">Redo</Ht>}
						shortcut="Enter"
						onTrigger={() => {
							levelControls.exa!.redo()
						}}
						disabled={!levelControls.exa}
					/>
					<hr />
					<ChooserButton
						label={<Ht haiku="Resize the viewport">Camera control</Ht>}
						onTrigger={() => {
							levelControls.exa!.cameraControls()
						}}
						disabled={!levelControls.exa}
					/>
					<ChooserButton
						label={<Ht haiku="Inspect the cell's tiles">Tile inspector</Ht>}
						onTrigger={() => {
							levelControls.exa!.tileInspector()
						}}
						disabled={!levelControls.exa}
					/>
					<ChooserButton
						label={
							<Ht haiku="Adjust starting conditions">
								Level modifiers control
							</Ht>
						}
						onTrigger={() => {
							levelControls.exa!.levelModifiersControls()
						}}
						disabled={!levelControls.exa}
					/>
					<hr />
					<ChooserButton
						label={<Ht haiku="Remove unused links">Prune backfeed</Ht>}
						onTrigger={() => {
							levelControls.exa!.purgeBackfeed!()
						}}
						disabled={!levelControls.exa?.purgeBackfeed}
						expl={
							<>
								<img src={backfeedPruningImg} class="float-left" />
								Pressing "prune backfeed" will remove all edges which "feed"
								into parent nodes. This is useful for decluttering the graph, as
								these edges cannot possibly be part of an optimal route.
							</>
						}
					/>
				</SidebarButton>

				<SidebarButton icon={toolsIcon} reverse addMargin>
					<ChooserButton
						label={<Ht haiku="Change the haiku mode">Preferences</Ht>}
						shortcut="Shift+C"
						onTrigger={(get, set) => showPromptGs(get, set, PreferencesPrompt)}
					/>
					<ChooserButton
						label={
							<Ht haiku="Save or load whatever here">Save file manager</Ht>
						}
						shortcut="Alt+S"
					/>
				</SidebarButton>
				<SidebarButton icon={infoIcon} reverse>
					<ChooserButton
						label={<Ht haiku="Who made this nice app?">About</Ht>}
						shortcut="F1"
						onTrigger={(get, set) => showPromptGs(get, set, AboutPrompt)}
					/>
				</SidebarButton>
			</div>
		</SidebarActionContext.Provider>
	)
}
