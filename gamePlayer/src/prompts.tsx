import { atom, useAtomValue } from "jotai"
import { ComponentType } from "preact"
import { ReactNode } from "preact/compat"

interface Prompt<R> {
	el: ReactNode
	promise: Promise<R>
	ident?: unknown
}

export type PromptComponent<R> = ComponentType<{
	onResolve: (val: R) => void
	onReject: (err: unknown) => void
}>

const promptsAtom = atom<Prompt<unknown>[]>([])

export function showPrompt<T>(
	get: (atom: typeof promptsAtom) => Prompt<unknown>[],
	set: (atom: typeof promptsAtom, val: Prompt<unknown>[]) => void,
	Prompt: PromptComponent<T>,
	ident?: unknown
): Promise<T> {
	let el: ReactNode
	let prompt: Prompt<T>
	let removed = false
	function removePrompt() {
		if (removed) return
		removed = true
		const prompts = get(promptsAtom).concat()
		prompts.splice(prompts.indexOf(prompt), 1)
		set(promptsAtom, prompts)
	}
	if (ident) {
		const prompts = get(promptsAtom).concat()
		const idx = prompts.findIndex(
			prompt => prompt.ident && prompt.ident === ident
		)
		if (idx !== -1) {
			prompts.splice(idx, 1)
			set(promptsAtom, prompts)
		}
	}
	const promise = new Promise<T>((res, rej) => {
		el = (
			<Prompt
				onResolve={val => {
					res(val)
					removePrompt()
				}}
				onReject={val => {
					rej(val)
					removePrompt()
				}}
			/>
		)
	})
	prompt = { el, promise, ident }
	set(promptsAtom, get(promptsAtom).concat(prompt))
	return promise
}

export function hidePrompt(
	get: (atom: typeof promptsAtom) => Prompt<unknown>[],
	set: (atom: typeof promptsAtom, val: Prompt<unknown>[]) => void,
	ident: unknown
): void {
	const prompts = get(promptsAtom).concat()
	const idx = prompts.findIndex(
		prompt => prompt.ident && prompt.ident === ident
	)
	if (idx !== -1) {
		prompts.splice(idx, 1)
		set(promptsAtom, prompts)
	}
}

export function Prompts() {
	const prompts = useAtomValue(promptsAtom)
	return (
		<div class="isolate z-10">
			{prompts
				.concat()
				.reverse()
				.map(prompt => prompt.el)}
		</div>
	)
}
