import { ComponentChildren, ComponentProps, Ref } from "preact"
import leafIcon from "./tabIcons/leaf.svg"
import levelIcon from "./tabIcons/level.svg"
import floppyIcon from "./tabIcons/floppy.svg"
import clockIcon from "./tabIcons/clock.svg"
import toolsIcon from "./tabIcons/tools.svg"
import infoIcon from "./tabIcons/info.svg"
import { useLayoutEffect, useRef, useState } from "preact/hooks"
import { forwardRef } from "preact/compat"
import { twJoin } from "tailwind-merge"
import { useMediaQuery } from "react-responsive"
import { Getter, Setter, useStore } from "jotai"
import { pageAtom } from "@/routing"
import { showPrompt } from "@/prompts"
import { AboutPrompt } from "../AboutDialog"
import { applyRef } from "@/helpers"
import { PreferencesPrompt } from "../PreferencesPrompt"

interface SidebarAction {
	label: string
	shortcut?: string
	disabled?: boolean
	onTrigger?: (get: Getter, set: Setter) => void
}

function ChooserButton(props: SidebarAction) {
	const { get, set } = useStore()
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
	if (!shouldRender) return

	return (
		<div
			class={twJoin(
				"absolute left-full z-10 flex",
				props.reverse
					? "bottom-1/3 [transform-origin:theme(spacing.2)_calc(100%_-_theme(spacing.2))]"
					: "top-1/3 [transform-origin:theme(spacing.2)_theme(spacing.2)]",
				props.open && "animate-tooltip-open",
				closingAnim && "animate-tooltip-close"
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
				open
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
		if (!shouldRender) return

		return (
			<dialog
				{...props}
				open
				ref={dialog => {
					applyRef(ref, dialog)
					applyRef(fref, dialog)
				}}
				onAnimationEnd={endClosingAnim}
				class={twJoin(
					"box fixed bottom-20 left-0 right-0 z-10 mx-auto w-screen rounded-b-none border-b-0 shadow-none [transform-origin:0_100%]",
					props.open && "animate-drawer-open",
					closingAnim && "animate-drawer-close"
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
		: !useMediaQuery({ query: "(min-width: 768px)" })
	const SidebarChooser = useDrawer ? SidebarDrawer : SidebarTooltip

	return (
		<div class="relative flex max-md:flex-1 md:[&:nth-last-child(2)]:mt-auto">
			<img
				tabIndex={0}
				draggable={false}
				src={props.icon}
				class="m-auto block cursor-pointer select-none max-md:h-4/5 md:w-1/2 lg:w-3/5"
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

export function Sidebar() {
	return (
		<div class="box flex h-full w-20 flex-col rounded-none border-none p-0 max-md:h-20 max-md:w-full max-md:flex-row md:gap-4 md:py-2 xl:w-28">
			<SidebarButton icon={leafIcon}>
				<ChooserButton
					label="Set selector"
					shortcut="Escape"
					onTrigger={(_get, set) => set(pageAtom, "")}
				/>
			</SidebarButton>
			{/* TODO dynamic icon */}
			<SidebarButton icon={levelIcon}>
				<ChooserButton label="Reset level" shortcut="Shift+R" />
				<ChooserButton label="Pause" shortcut="P" />
				<hr class="mx-2" />
				<ChooserButton label="Next level" shortcut="Shift+N" />
				<ChooserButton label="Previous level" shortcut="Shift+P" />
				<ChooserButton label="Level list" shortcut="Shift+S" />
			</SidebarButton>
			<SidebarButton icon={floppyIcon}>
				<ChooserButton label="No solutions yet!!" />
				<hr class="mx-2" />
				<ChooserButton label="All attempts" shortcut="Shift+A" />
			</SidebarButton>
			<SidebarButton icon={clockIcon}>
				<ChooserButton label="Toggle ExaCC" shortcut="Shift+X" />
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
	)
}
