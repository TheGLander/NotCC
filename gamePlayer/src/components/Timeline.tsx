import { ComponentChildren, ComponentProps } from "preact"
import { TargetedEvent } from "preact/compat"
import { useCallback } from "preact/hooks"
import { twMerge } from "tailwind-merge"

export const TIMELINE_PLAYBACK_SPEEDS = [0.05, 0.2, 0.75, 1, 1.25, 2, 5]

export function Timeline(props: {
	onScrub?: (progress: number) => void
	children?: ComponentChildren
}) {
	const onScrub = useCallback(
		(ev: TargetedEvent<HTMLDivElement, MouseEvent>) => {
			if (!(ev.buttons & 1)) return
			const clientLeft = ev.currentTarget.getBoundingClientRect().left
			if (ev.clientX < clientLeft) return
			const posFrac = (ev.clientX - clientLeft) / ev.currentTarget.offsetWidth
			props.onScrub?.(posFrac)
		},
		[props.onScrub]
	)
	return (
		<div
			class="relative mx-2.5 flex flex-1"
			onMouseDown={onScrub}
			onMouseMove={onScrub}
		>
			<div class="bg-theme-100 h-1 w-full self-center rounded" />
			<div class="absolute flex w-full self-center">{props.children}</div>
		</div>
	)
}

export function TimelineHead(
	props: ComponentProps<"div"> & { progress: number }
) {
	return (
		<div
			{...{ ...props, progress: undefined }}
			class={twMerge(
				"bg-theme-300 absolute -top-2.5 h-5 w-3 rounded-full",
				props.class as string
			)}
			style={{
				left: `calc(${props.progress * 100}% - 0.375rem)`,
			}}
		/>
	)
}

export const TIMELINE_DEFAULT_IDX = 3

export function TimelineBox(props: {
	children?: ComponentChildren
	playing: boolean
	onSetPlaying: (val: boolean) => void
	speedIdx: number
	onSetSpeed: (speedIdx: number) => void
}) {
	return (
		<div class="flex h-6 flex-row gap-2">
			<button
				onClick={() => props.onSetPlaying(!props.playing)}
				class="w-8 p-0 text-center font-mono"
			>
				{props.playing ? "⏸" : "︎⏵"}
			</button>
			<input
				class="w-16"
				type="range"
				min="0"
				defaultValue={TIMELINE_DEFAULT_IDX.toString()}
				max="6"
				step="1"
				onInput={ev => props.onSetSpeed(parseInt(ev.currentTarget.value))}
			/>
			{props.children}
		</div>
	)
}
