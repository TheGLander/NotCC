import { memo } from "preact/compat"

export const ErrorBox = memo(({ error: err }: { error: Error }) => (
	<div
		class="bg-theme-950 max-h-60 overflow-auto whitespace-pre-wrap p-1"
		tabIndex={0}
	>
		{err.name}: {err.message}
		<br />
		{err.stack && `Stack trace: ${err.stack}`}
	</div>
))
