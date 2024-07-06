import { KEY_INPUTS, KeyInputs, Level } from "@notcc/logic"
import { TimeoutTimer } from "./helpers"
import { useCallback, useLayoutEffect, useMemo, useRef } from "preact/hooks"

type RepeatKeyType = "released" | "held" | "repeated"

interface RepeatKeyEvent {
	code: KeyInputs
	player: number
	state: RepeatKeyType
}

export type RepeatKeyHandlerEventSource = (
	on: (code: KeyInputs, player: number) => void,
	off: (code: KeyInputs, player: number) => void
) => () => void
export type RepeatKeyListener = (ev: RepeatKeyEvent) => void

export class RepeatKeyHandler {
	repeatTimer: TimeoutTimer | null = null
	repeatCode: KeyInputs | null = null
	repeatPlayer: number | null = null
	unsubFuncs: (() => void)[] = []
	keyRepeatDelay = 0.25

	onListener(code: KeyInputs, player: number) {
		this.repeatTimer?.cancel()
		if (this.repeatCode) {
			this.listener({ code: this.repeatCode, state: "held", player })
			this.repeatCode = null
			this.repeatPlayer = null
		}
		this.repeatTimer = new TimeoutTimer(() => {
			this.repeatCode = code
			this.repeatPlayer = player
			this.listener({ state: "repeated", code, player })
		}, this.keyRepeatDelay)
		this.listener({ state: "held", code, player })
	}
	offListener(code: KeyInputs, player: number) {
		this.repeatTimer?.cancel()
		if (
			this.repeatCode &&
			!(this.repeatCode === code && this.repeatPlayer === player)
		) {
			this.listener({ code: this.repeatCode, state: "held", player })
		}
		this.repeatCode = null
		this.repeatPlayer = null
		this.listener({ code, state: "released", player })
	}
	constructor(public listener: RepeatKeyListener) {}
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

export function keyDemux(listeners: RepeatKeyListener[]) {
	return (ev: RepeatKeyEvent) => {
		const listener = listeners[ev.player]
		listener(ev)
	}
}

export class KeyReleaser {
	inputs: KeyInputs = 0
	repeatedInputs: KeyInputs = 0
	constructor() {}
	feedEvent(ev: RepeatKeyEvent) {
		if (ev.state === "repeated") {
			this.repeatedInputs |= ev.code
			this.inputs |= ev.code
		} else if (ev.state === "held") {
			this.repeatedInputs &= ~ev.code
			this.inputs |= ev.code
		} else {
			this.repeatedInputs &= ~ev.code
			this.inputs &= ~ev.code
		}
	}
	releaseKeys(keys: number) {
		this.inputs &= ~(keys & ~this.repeatedInputs)
	}
	getInputs(): KeyInputs {
		return this.inputs
	}
}

export function keyboardEventSource(
	keys: Record<string, KeyInputs>,
	player: number
): RepeatKeyHandlerEventSource {
	return (on, off) => {
		const onHandler = (ev: KeyboardEvent) => {
			if (ev.repeat || ev.shiftKey || ev.ctrlKey || ev.altKey || ev.metaKey)
				return
			const inputType = keys[ev.code]
			if (inputType === undefined) return
			on(inputType, player)
		}
		const offHandler = (ev: KeyboardEvent) => {
			if (ev.repeat || ev.shiftKey || ev.ctrlKey || ev.altKey || ev.metaKey)
				return
			const inputType = keys[ev.code]
			if (inputType === undefined) return
			off(inputType, player)
		}
		document.addEventListener("keydown", onHandler)
		document.addEventListener("keyup", offHandler)
		return () => {
			document.removeEventListener("keydown", onHandler)
			document.removeEventListener("keyup", offHandler)
		}
	}
}

// FIXME: Keep this private, use config for keys (currently needed for ExaCC)
export const DEFAULT_KEY_MAP = {
	ArrowUp: KEY_INPUTS.up,
	ArrowRight: KEY_INPUTS.right,
	ArrowDown: KEY_INPUTS.down,
	ArrowLeft: KEY_INPUTS.left,
	KeyZ: KEY_INPUTS.dropItem,
	KeyX: KEY_INPUTS.cycleItems,
	KeyC: KEY_INPUTS.switchPlayer,
}

export function useGameInputs(level: Level) {
	// TODO: Multiplayer
	const seat0Releaser = useMemo(() => new KeyReleaser(), [])
	const anyInputRef = useRef<() => void>()
	const handlerCallback = useCallback(
		(ev: RepeatKeyEvent) => {
			anyInputRef.current?.()
			seat0Releaser.feedEvent(ev)
		},
		[seat0Releaser]
	)
	const handler = useMemo(
		() => new RepeatKeyHandler(handlerCallback),
		[handlerCallback]
	)
	useLayoutEffect(() => {
		handler.addEventSource(keyboardEventSource(DEFAULT_KEY_MAP, 0))
		return () => handler.remove()
	}, [handler])

	const inputMan = useMemo(
		() => ({
			handler,
			anyInputRef,
			setLevelInputs() {
				const seat0 = level.playerSeats[0]
				seat0.inputs = seat0Releaser.getInputs()
			},
			setReleasedInputs() {
				const seat0 = level.playerSeats[0]
				seat0Releaser.releaseKeys(seat0.releasedInputs)
			},
		}),
		[handler, level, seat0Releaser]
	)
	return inputMan
}
