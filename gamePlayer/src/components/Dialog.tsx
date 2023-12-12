import { ReactNode } from "preact/compat"

export function Dialog(props: {
	header: ReactNode
	section: ReactNode
	buttons: [string, () => void | Promise<void>][]
	onResolve?: () => void
}) {
	return (
		<dialog
			class="box fixed bottom-0 top-0 p-0 backdrop:bg-black/50"
			ref={ref => {
				ref?.showModal()
			}}
		>
			<header class="bg-theme-950 px-2 py-1">{props.header}</header>
			<section class="px-2 py-1">{props.section}</section>
			<footer class="bg-theme-950 flex flex-row justify-end gap-1 p-1">
				{props.buttons.map(([label, action]) => (
					<button
						onClick={async ev => {
							ev.preventDefault()
							await action()
							props.onResolve?.()
						}}
					>
						{label}
					</button>
				))}
			</footer>
		</dialog>
	)
}
