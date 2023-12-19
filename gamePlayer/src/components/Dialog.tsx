import { ReactNode, useRef } from "preact/compat"

export function Dialog(props: {
	header: ReactNode
	section: ReactNode
	buttons: [string, () => void | Promise<void>][]
	onResolve?: () => void
}) {
	const normalSubmitRef = useRef(false)
	return (
		<dialog
			class="box fixed bottom-0 top-0 p-0 backdrop:bg-black/50"
			ref={ref => {
				ref?.showModal()
			}}
			onClose={ev => {
				ev.preventDefault()
				if (normalSubmitRef.current) return
				props.onResolve?.()
			}}
		>
			<header class="bg-theme-950 px-2 py-1">{props.header}</header>
			<section class="px-2 py-1">{props.section}</section>
			<footer class="bg-theme-950 flex flex-row justify-end gap-1 p-1">
				{props.buttons.map(([label, action]) => (
					<button
						onClick={async ev => {
							ev.preventDefault()
							normalSubmitRef.current = true
							await action()?.catch(() => {
								normalSubmitRef.current = false
							})
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
