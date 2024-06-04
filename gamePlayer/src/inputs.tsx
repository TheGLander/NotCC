import { InputType, KeyInputs, makeEmptyInputs } from "@notcc/logic"
import { TimeoutTimer } from "./helpers"
import { useCallback, useEffect, useMemo, useRef } from "preact/hooks"

type RepeatKeyType = "released" | "held" | "repeated"

interface RepeatKeyEvent {
	code: InputType
	state: RepeatKeyType
}

const KEY_REPEAT_DELAY = 0.25

export type RepeatKeyHandlerEventSource = (
	on: (code: InputType) => void,
	off: (code: InputType) => void
) => () => void

export class RepeatKeyHandler {
	repeatTimer: TimeoutTimer | null = null
	repeatCode: InputType | null = null
	unsubFuncs: (() => void)[] = []

	onListener(code: InputType) {
		this.repeatTimer?.cancel()
		if (this.repeatCode) {
			this.listener({ code: this.repeatCode, state: "held" })
			this.repeatCode = null
		}
		this.repeatTimer = new TimeoutTimer(() => {
			this.repeatCode = code
			this.listener({ state: "repeated", code })
		}, KEY_REPEAT_DELAY)
		this.listener({ state: "held", code })
	}
	offListener(code: InputType) {
		this.repeatTimer?.cancel()
		if (this.repeatCode && this.repeatCode !== code) {
			this.listener({ code: this.repeatCode, state: "held" })
		}
		this.repeatCode = null
		this.listener({ code, state: "released" })
	}
	constructor(public listener: (ev: RepeatKeyEvent) => void) {}
	addEventSource(handler: RepeatKeyHandlerEventSource) {
		this.unsubFuncs.push(
			handler(this.onListener.bind(this), this.offListener.bind(this))
		)
	}
	remove() {
		for (const unsub of this.unsubFuncs) {
			unsub()
		}
		this.repeatTimer?.cancel()
	}
}

export function useKeyInputs(): {
	inputs: KeyInputs
	releaseKeys: (keys: KeyInputs) => void
	handler: RepeatKeyHandler
} {
	const { current: repeatInputs } = useRef<KeyInputs>(makeEmptyInputs())
	const { current: gameInputs } = useRef<KeyInputs>(makeEmptyInputs())
	const keyListener = useCallback((ev: RepeatKeyEvent) => {
		repeatInputs[ev.code] = ev.state === "repeated"
		gameInputs[ev.code] = ev.state !== "released"
	}, [])
	const handler = useMemo(
		() => new RepeatKeyHandler(keyListener),
		[keyListener]
	)
	const releaseKeys = useCallback((releaseInputs: KeyInputs) => {
		if (releaseInputs.up && !repeatInputs.up) gameInputs.up = false
		if (releaseInputs.right && !repeatInputs.right) gameInputs.right = false
		if (releaseInputs.down && !repeatInputs.down) gameInputs.down = false
		if (releaseInputs.left && !repeatInputs.left) gameInputs.left = false
		if (releaseInputs.drop && !repeatInputs.drop) gameInputs.drop = false
		if (releaseInputs.rotateInv && !repeatInputs.rotateInv)
			gameInputs.rotateInv = false
		if (releaseInputs.switchPlayable && !repeatInputs.switchPlayable)
			gameInputs.switchPlayable = false
	}, [])
	useEffect(
		() => () => {
			handler.remove()
		},
		[]
	)
	return {
		inputs: gameInputs,
		releaseKeys: releaseKeys,
		handler,
	}
}

export const keyToInputMap: Record<string, InputType> = {
	ArrowUp: "up",
	ArrowRight: "right",
	ArrowDown: "down",
	ArrowLeft: "left",
	KeyZ: "drop",
	KeyX: "rotateInv",
	KeyC: "switchPlayable",
}

export const keyboardEventSource: RepeatKeyHandlerEventSource = (on, off) => {
	const onHandler = (ev: KeyboardEvent) => {
		if (ev.repeat) return
		const inputType = keyToInputMap[ev.code]
		if (inputType === undefined) return
		on(inputType)
	}
	const offHandler = (ev: KeyboardEvent) => {
		const inputType = keyToInputMap[ev.code]
		if (inputType === undefined) return
		off(inputType)
	}
	document.addEventListener("keydown", onHandler)
	document.addEventListener("keyup", offHandler)
	return () => {
		document.removeEventListener("keydown", onHandler)
		document.removeEventListener("keyup", offHandler)
	}
}
