import { Getter, Setter, atom, useAtomValue } from "jotai"
import { useJotaiFn } from "./helpers"
export interface Toast {
	title: string
	autoHideAfter?: number
	keyIdent?: symbol
}

const toastAtom = atom<Toast[]>([])

export function addToastGs(get: Getter, set: Setter, toast: Toast) {
	const toasts = get(toastAtom)
	const curToastIdx =
		toast.keyIdent === undefined
			? -1
			: toasts.findIndex(tst => tst.keyIdent === toast.keyIdent)
	if (curToastIdx !== -1) {
		toasts.splice(curToastIdx, 1, toast)
	} else {
		toasts.push(toast)
	}
	set(toastAtom, toasts.concat())
}

export function adjustToastGs(get: Getter, set: Setter) {
	set(toastAtom, get(toastAtom).concat())
}

export function removeToastGs(get: Getter, set: Setter, ident: Toast | symbol) {
	const toasts = get(toastAtom)
	let idx: number
	if (typeof ident === "symbol") {
		idx = toasts.findIndex(tst => tst.keyIdent === ident)
	} else {
		idx = toasts.findIndex(tst => tst === ident)
	}
	if (idx !== -1) {
		toasts.splice(idx, 1)
		set(toastAtom, toasts.concat())
	}
}

export function ToastDisplay() {
	const toases = useAtomValue(toastAtom)
	const removeToast = useJotaiFn(removeToastGs)
	return (
		<div class="absolute bottom-1 right-1 flex flex-col gap-1">
			{toases.map(toast => (
				<div
					class="box cursor-pointer"
					onClick={() => {
						removeToast(toast)
					}}
				>
					{toast.title}
				</div>
			))}
		</div>
	)
}
