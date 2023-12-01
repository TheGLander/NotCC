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

const SidebarTooltip = forwardRef<HTMLDialogElement, ComponentProps<"dialog">>(
	function SidebarTooltip(props, fref) {
		const { endClosingAnim, closingAnim, ref, shouldRender } =
			useSidebarChooserAnim<HTMLDivElement>(!!props.open)
		if (!shouldRender) return

		return (
			<div
				class={twJoin(
					"absolute left-full top-1/3 z-10 flex [transform-origin:theme(spacing.2)_theme(spacing.2)]",
					props.open && "animate-tooltip-open",
					closingAnim && "animate-tooltip-close"
				)}
				onAnimationEnd={endClosingAnim}
				ref={ref}
			>
				<div class="border-r-theme-900 mr-[-4px] inline-block h-0 w-0 border-8 border-transparent" />
				<dialog {...props} open tabIndex={0} ref={fref} class="box static" />
			</div>
		)
	}
)

function applyRef<T>(ref: Ref<T>, val: T | null): void {
	if (typeof ref === "function") ref(val)
	else if (ref) ref.current = val
}

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
					"box fixed bottom-20 left-0 right-0 z-10 mx-auto w-screen rounded-b-none shadow-none [transform-origin:0_100%]",
					props.open && "animate-drawer-open",
					closingAnim && "animate-drawer-close"
				)}
			/>
		)
	}
)

function SidebarButton(
	props: { icon: string } | { children: ComponentChildren }
) {
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
			{"icon" in props ? (
				<img
					tabIndex={0}
					draggable={false}
					src={props.icon}
					class="m-auto block cursor-pointer select-none max-md:h-4/5 md:w-1/2 lg:w-3/5"
					onClick={() => {
						setTooltipOpened(true)
					}}
				/>
			) : (
				props.children
			)}
			<SidebarChooser
				open={tooltipOpened}
				onfocusout={() => setTooltipOpened(false)}
				ref={onDialogMount}
			>
				Todo!
			</SidebarChooser>
		</div>
	)
}

export function Sidebar() {
	return (
		<div class="box flex h-full w-20 flex-col rounded-none p-0 max-md:h-20 max-md:w-full max-md:flex-row md:gap-4 md:py-2">
			<SidebarButton icon={leafIcon} />
			{/* TODO dynamic icon */}
			<SidebarButton icon={levelIcon} />
			<SidebarButton icon={floppyIcon} />
			<SidebarButton icon={clockIcon} />

			<SidebarButton icon={toolsIcon} />
			<SidebarButton icon={infoIcon} />
		</div>
	)
}
