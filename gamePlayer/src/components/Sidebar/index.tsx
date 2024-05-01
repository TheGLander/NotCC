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
import { showPrompt } from "@/prompts"
import { AboutPrompt } from "../AboutDialog"
import { applyRef, formatTimeLeft } from "@/helpers"
import { PreferencesPrompt } from "../PreferencesPrompt"
import isHotkey from "is-hotkey"
import { openExaCC, toggleExaCC } from "@/pages/ExaPlayerPage/OpenExaPrompt"
import {
	goToNextLevel,
	goToPreviousLevel,
	levelSetAtom,
	levelUnwrappedAtom,
} from "@/levelData"
import { Expl } from "../Expl"
import backfeedPruningImg from "./backfeedPruning.png"
import {
	InputProvider,
	RouteFileInputProvider,
	SolutionInfoInputProvider,
	calculateLevelPoints,
	protoTimeToMs,
} from "@notcc/logic"
import { ISolutionInfo } from "@notcc/logic/dist/parsers/nccs.pb"
import { RRLevel, RRRoute, getRRLevel, setRRRoutesAtom } from "@/railroad"

export interface LevelControls {
	restart?(): void
	pause?(): void
	playInputs?(ip: SidebarReplayable): void
	exa?: {
		undo?(): void
		redo?(): void
		purgeBackfeed?(): void
		cameraControls?(): void
	}
}

export const levelControlsAtom = atom<LevelControls>({})

interface SidebarAction {
	label: string
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
			onClick={() => props.onTrigger?.(get, set)}
		>
			<div
				class={twJoin(
					"closes-tooltip w-max ",
					isDisabled && "text-neutral-500"
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
				<div class="closes-tooltip ml-auto pb-1 pl-8 max-md:hidden">
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
				class="box static border-none"
			/>
		</div>
	)
})

const SidebarDrawer = forwardRef<HTMLDialogElement, ComponentProps<"dialog">>(
	function SidebarDrawer(props, fref) {
		const { endClosingAnim, closingAnim, ref, shouldRender } =
			useSidebarChooserAnim<HTMLDialogElement>(!!props.open)
		const isSidebarAtBottom = !useMediaQuery({
			query: "(min-aspect-ratio: 1/1)",
		})

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
					"box fixed left-0 right-0 z-10 mx-auto rounded-b-none border-b-0 shadow-none [transform-origin:0_100%]",
					isSidebarAtBottom
						? "bottom-20 w-screen"
						: "bottom-0 left-20 w-[calc(100vw_-_theme(spacing.20))]",
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
	reverse?: boolean
}) {
	const [tooltipOpened, setTooltipOpened] = useState(false)
	const onDialogMount = (dialog: HTMLDialogElement | null) => {
		if (tooltipOpened && dialog) {
			dialog.focus()
		}
	}
	const useDrawer = !globalThis.window
		? false
		: !useMediaQuery({
				query: "(min-width: 768px) and (min-aspect-ratio: 1/1)",
		  })
	const SidebarChooser = useDrawer ? SidebarDrawer : SidebarTooltip

	return (
		<div class="relative flex">
			<img
				tabIndex={0}
				draggable={false}
				src={props.icon}
				class="m-auto block cursor-pointer select-none md:w-1/2 lg:w-3/5"
				onClick={() => {
					setTooltipOpened(true)
				}}
			/>
			<SidebarChooser
				open={tooltipOpened}
				onfocusout={ev => {
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

export interface SidebarReplayable {
	name: string
	metric: string
	ip: InputProvider | (() => Promise<InputProvider>)
}

function SolutionsTooltipList(props: { controls: LevelControls }) {
	const lSet = useAtomValue(levelSetAtom)
	const level = useAtomValue(levelUnwrappedAtom)
	if (!level || !props.controls.playInputs)
		return <div class="mx-2 my-1">N/A</div>
	const sols: SidebarReplayable[] = []
	if (level.associatedSolution) {
		const solLength = Math.ceil(
			level.associatedSolution.steps![0].reduce(
				(acc, val, i) => (i % 2 === 1 ? acc + val : acc),
				0
			) / 60
		)
		sols.push({
			name: "Built-in",
			metric: `${Math.floor(solLength / 60)}:${(solLength % 60)
				.toString()
				.padStart(2, "0")}`,
			ip: new SolutionInfoInputProvider(level.associatedSolution),
		})
	}
	const attempts = lSet?.seenLevels[lSet.currentLevel].levelInfo.attempts
	if (attempts) {
		let bestTime: ISolutionInfo | null = null
		let bestScore: ISolutionInfo | null = null
		let bestScoreVal = -Infinity
		let last: ISolutionInfo | null = null
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
					lSet.currentLevel,
					Math.ceil(protoTimeToMs(sol.outcome.timeLeft) / 1000),
					sol.outcome.bonusScore
				)
				if (!bestScore || score > bestScoreVal) {
					bestScore = sol
					bestScoreVal = score
				}
			}
		}
		function makeMetrics(sol: ISolutionInfo) {
			const score = calculateLevelPoints(
				lSet!.currentLevel,
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
	}
	if (sols.length === 0) return <div class="mx-2 my-1">None</div>
	return (
		<>
			{sols.map(sol => (
				<ChooserButton
					label={`${sol.name} ${sol.metric}`}
					onTrigger={() => {
						props.controls.playInputs?.(sol)
					}}
				/>
			))}
		</>
	)
}

function getRRRoutes(
	routes: RRLevel[],
	levelN: number,
	packId: string
): SidebarReplayable[] {
	const rrLevel = routes.find(lvl => lvl.levelN === levelN)
	if (!rrLevel || !rrLevel.mainlineTimeRoute || !rrLevel.mainlineScoreRoute)
		return []
	function makeMetrics(route: RRRoute) {
		return `${formatTimeLeft(route.timeLeft * 60)}s / ${route.points}pts`
	}
	function fetchIp(route: RRRoute) {
		return async () => {
			const level = await getRRLevel(packId, levelN)
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
	const routes: SidebarReplayable[] = []
	if (levelSet && rrRoutes) {
		routes.push(...getRRRoutes(rrRoutes, levelSet.currentLevel, setIdent!))
	}
	return (
		<>
			{routes.map(route => (
				<ChooserButton
					label={`${route.name} ${route.metric}`}
					onTrigger={() => {
						props.controls.playInputs?.(route)
					}}
				/>
			))}
		</>
	)
}

export function Sidebar() {
	const sidebarActions: SidebarAction[] = useRef([]).current
	const levelControls = useAtomValue(levelControlsAtom)
	const { get, set } = useStore()
	const hasSet = !!get(levelSetAtom)
	useEffect(() => {
		const listener = (ev: KeyboardEvent) => {
			if (document.querySelector("dialog[open]")) return
			for (const action of sidebarActions) {
				if (!action.shortcut) continue
				if (!isHotkey(action.shortcut)(ev)) continue
				if (action.disabled || !action.onTrigger) continue
				action.onTrigger(get, set)
			}
		}
		document.addEventListener("keydown", listener)
		return () => {
			document.removeEventListener("keydown", listener)
		}
	}, [levelControls])
	return (
		<SidebarActionContext.Provider value={sidebarActions}>
			<div id="sidebar" class="box flex rounded-none border-none p-0 xl:w-28">
				<SidebarButton icon={leafIcon}>
					<ChooserButton
						label="Set selector"
						shortcut="Escape"
						onTrigger={(_get, set) => set(pageAtom, "")}
					/>
				</SidebarButton>
				{/* TODO dynamic icon */}
				<SidebarButton icon={levelIcon}>
					<ChooserButton
						label="Reset level"
						shortcut="Shift+R"
						disabled={!levelControls.restart}
						onTrigger={() => levelControls.restart!()}
					/>
					<ChooserButton
						label="Pause"
						shortcut="P"
						disabled={!levelControls.pause}
						onTrigger={() => levelControls.pause!()}
					/>
					<hr class="mx-2 my-1" />
					<ChooserButton
						label="Next level"
						shortcut="Shift+N"
						disabled={!hasSet}
						onTrigger={goToNextLevel}
					/>
					<ChooserButton
						label="Previous level"
						shortcut="Shift+P"
						disabled={!hasSet}
						onTrigger={goToPreviousLevel}
					/>
					<ChooserButton label="Level list" shortcut="Shift+S" />
				</SidebarButton>
				<SidebarButton icon={floppyIcon}>
					<div class="mx-2">Solutions:</div>
					<SolutionsTooltipList controls={levelControls} />
					<ChooserButton label="All attempts" shortcut="Shift+A" />
					<hr class="mx-2 my-1" />
					<div class="mx-2">Routes:</div>
					<RoutesTooltipList controls={levelControls} />
					<ChooserButton label="All routes" />
				</SidebarButton>
				<SidebarButton icon={clockIcon}>
					<ChooserButton
						label="Toggle ExaCC"
						shortcut="Shift+X"
						onTrigger={toggleExaCC}
						expl={
							<>
								ExaCC is a tool for routing levels based on NotCC's game logic.
							</>
						}
					/>
					<ChooserButton
						label="New ExaCC route"
						shortcut="Ctrl+Shift+X"
						onTrigger={openExaCC}
					/>
					<ChooserButton
						label="Undo"
						shortcut="Backspace"
						onTrigger={() => {
							levelControls.exa!.undo!()
						}}
						disabled={!levelControls.exa?.undo}
					/>
					<ChooserButton
						label="Redo"
						shortcut="Enter"
						onTrigger={() => {
							levelControls.exa!.redo!()
						}}
						disabled={!levelControls.exa?.redo}
					/>
					<ChooserButton
						label="Camera control"
						onTrigger={() => {
							levelControls.exa!.cameraControls!()
						}}
						disabled={!levelControls.exa?.cameraControls}
					/>
					<ChooserButton
						label="Prune backfeed"
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

				<SidebarButton icon={toolsIcon} reverse>
					<ChooserButton
						label="Preferences"
						shortcut="Shift+C"
						onTrigger={(get, set) => showPrompt(get, set, PreferencesPrompt)}
					/>
					<ChooserButton label="Save file manager" shortcut="Alt+S" />
				</SidebarButton>
				<SidebarButton icon={infoIcon} reverse>
					<ChooserButton
						label="About"
						shortcut="F1"
						onTrigger={(get, set) => showPrompt(get, set, AboutPrompt)}
					/>
				</SidebarButton>
			</div>
		</SidebarActionContext.Provider>
	)
}
