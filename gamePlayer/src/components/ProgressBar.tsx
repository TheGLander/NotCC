export function ProgressBar(props: { progress: number }) {
	return (
		<div class="bg-theme-700 h-7 w-auto flex-1 rounded">
			<div
				class="bg-theme-800 h-full w-0 transition-transform"
				style={{ width: `${props.progress * 100}%` }}
			/>
		</div>
	)
}
