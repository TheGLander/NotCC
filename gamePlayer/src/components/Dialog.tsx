import { applyRef } from "@/helpers"
import { ComponentChildren, Ref } from "preact"
import { ReactNode, forwardRef, useRef } from "preact/compat"
import Draggable from "react-draggable"
import { twJoin } from "tailwind-merge"

export const Dialog = forwardRef(function (
	props: {
		header: ReactNode
		children: ComponentChildren
		notModal?: boolean
		buttons: [string, () => void | Promise<void>][]
		onResolve?: () => void
		onClose?: () => void
	},
	ref: Ref<HTMLDialogElement>
) {
	const normalSubmitRef = useRef(false)
	return (
		<Draggable handle=".dialog-handle">
			<dialog
				class={twJoin(
					"box fixed bottom-0 top-0 flex max-h-[75vh] max-w-[75vw] flex-col p-0 backdrop:bg-black/50 max-sm:max-w-[95vw]",
					!props.notModal && "min-w-[33vw]"
				)}
				ref={refVal => {
					if (props.notModal) {
						refVal?.show()
					} else {
						refVal?.showModal()
					}
					applyRef(ref, refVal)
				}}
				onClose={ev => {
					ev.preventDefault()
					if (props.onClose) {
						props.onClose()
						return
					}
					if (normalSubmitRef.current) return
					props.onResolve?.()
				}}
			>
				<header class="bg-theme-950 dialog-handle cursor-move px-2 py-1">
					{props.header}
				</header>
				<section class="overflow-scroll px-2 py-1">{props.children}</section>
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
		</Draggable>
	)
})
