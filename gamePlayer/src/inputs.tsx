import { KEY_INPUTS, KeyInputs, Level } from "@notcc/logic"
import { TimeoutTimer, dedup, iterMapFind, keypressIsFocused } from "./helpers"
import { useLayoutEffect } from "preact/hooks"
import { preferenceAtom } from "./preferences"

export interface Input {
	source: string
	code: string
}

function inputEq(a: Input, b: Input) {
	return a.code === b.code && a.source === b.source
}

export type RepeatState = "released" | "held" | "repeated"

export type InputSource = (controls: InputControls) => () => void

export interface InputControls {
	on(input: Input): boolean
	off(input: Input): boolean
}

export class InputRepeater {
	repeatTimer: TimeoutTimer | null = null
	repeatInput: Input | null = null
	unsubFuncs: (() => void)[] = []
	keyRepeatDelay = 0.25

	on(input: Input): boolean {
		this.repeatTimer?.cancel()
		if (this.repeatInput) {
			this.listener(this.repeatInput, "held")
			this.repeatInput = null
		}
		const timer = new TimeoutTimer(() => {
			if (this.repeatTimer !== timer) return
			this.repeatInput = input
			this.listener(this.repeatInput, "repeated")
		}, this.keyRepeatDelay)
		this.repeatTimer = timer
		return this.listener(input, "held")
	}
	off(input: Input): boolean {
		this.repeatTimer?.cancel()
		this.repeatTimer = null
		if (this.repeatInput && !inputEq(this.repeatInput, input)) {
			this.listener(this.repeatInput, "held")
			this.repeatInput = null
		}
		return this.listener(input, "released")
	}
	constructor(public listener: (input: Input, state: RepeatState) => boolean) {}
}

export class InputBuffer {
	inputs: KeyInputs = 0
	repeatedInputs: KeyInputs = 0
	constructor() {}
	feedEvent(input: KeyInputs, state: RepeatState) {
		if (state === "repeated") {
			this.repeatedInputs |= input
			this.inputs |= input
		} else if (state === "held") {
			this.repeatedInputs &= ~input
			this.inputs |= input
		} else {
			this.repeatedInputs &= ~input
			this.inputs &= ~input
		}
	}
	releaseInputs(keys: number) {
		this.inputs &= ~(keys & ~this.repeatedInputs)
	}
	getInputs(): KeyInputs {
		return this.inputs
	}
}

export interface InputMapping {
	label?: string
	enabled: boolean
	source: string
	codes: Record<string, number>
}

export interface SeatConfig {
	mappings: InputMapping[]
}

export interface InputConfig {
	seats: SeatConfig[]
}

export const DEFAULT_INPUT_CONFIG: InputConfig = {
	seats: [
		{
			mappings: [
				{
					label: "NotCC",
					enabled: true,
					source: "keyboard",
					codes: {
						ArrowUp: KEY_INPUTS.up,
						ArrowRight: KEY_INPUTS.right,
						ArrowDown: KEY_INPUTS.down,
						ArrowLeft: KEY_INPUTS.left,
						KeyZ: KEY_INPUTS.dropItem,
						KeyX: KEY_INPUTS.cycleItems,
						KeyC: KEY_INPUTS.switchPlayer,
						Space: 0,
					},
				},
				{
					label: "CC2",
					enabled: true,
					source: "keyboard",
					codes: {
						KeyW: KEY_INPUTS.up,
						KeyA: KEY_INPUTS.left,
						KeyS: KEY_INPUTS.down,
						KeyD: KEY_INPUTS.right,
						KeyQ: KEY_INPUTS.dropItem,
						KeyE: KEY_INPUTS.cycleItems,
						KeyC: KEY_INPUTS.switchPlayer,
					},
				},
			],
		},
	],
}

export const inputConfigAtom = preferenceAtom("inputs", DEFAULT_INPUT_CONFIG)

class InputsDemux {
	seatsAssigned: boolean[]
	mappedInputs: Record<string, Record<string, [KeyInputs, number] | null>> = {}
	constructor(public config: InputConfig) {
		this.seatsAssigned = config.seats.map(() => false)
	}
	matchPlayerInput(input: Input): [input: KeyInputs, playerN: number] | null {
		if (!(input.source in this.mappedInputs)) {
			this.mappedInputs[input.source] = {}
		}
		const codesMap = this.mappedInputs[input.source]
		if (input.code in codesMap) {
			return codesMap[input.code]
		}
		const seatMap: [InputMapping, number] | null = iterMapFind(
			this.config.seats.filter((_, idx) => !this.seatsAssigned[idx]),
			(v, idx) => {
				const mapping = v.mappings.find(
					m => m.enabled && m.source === input.source && input.code in m.codes
				)
				return mapping ? [mapping, idx] : null
			}
		)
		if (!seatMap) {
			codesMap[input.code] = null
			return null
		}
		const seatIdx = seatMap[1]
		this.seatsAssigned[seatIdx] = true
		for (const [code, input] of Object.entries(seatMap[0].codes)) {
			codesMap[code] = [input, seatIdx]
		}
		return codesMap[input.code]
	}
}

const INPUT_SOURCES: Record<string, InputSource> = {
	keyboard(controls) {
		const onHandler = (ev: KeyboardEvent) => {
			if (ev.repeat || ev.shiftKey || ev.ctrlKey || ev.altKey || ev.metaKey)
				return
			if (keypressIsFocused(ev)) return
			const accepted = controls.on({ source: "keyboard", code: ev.code })
			if (accepted) {
				ev.preventDefault()
				ev.stopImmediatePropagation()
			}
		}
		const offHandler = (ev: KeyboardEvent) => {
			if (ev.repeat || ev.shiftKey || ev.ctrlKey || ev.altKey || ev.metaKey)
				return
			if (keypressIsFocused(ev)) return
			const accepted = controls.off({ source: "keyboard", code: ev.code })
			if (accepted) {
				ev.preventDefault()
				ev.stopImmediatePropagation()
			}
		}
		document.addEventListener("keydown", onHandler)
		document.addEventListener("keyup", offHandler)
		return () => {
			document.removeEventListener("keydown", onHandler)
			document.removeEventListener("keyup", offHandler)
		}
	},
}

export type InputCallback = (
	input: KeyInputs,
	player: number,
	state: RepeatState
) => void

export function makeInputCollector(
	config: InputConfig,
	callback: InputCallback,
	extraSources: InputSource[] = []
): () => void {
	// input sources -> input repeater -> anyInput and demux -> buffer (done manually)
	// Need to do this in reverse to connect things together

	const demux = new InputsDemux(config)

	function feedDemux(input: Input, state: RepeatState): boolean {
		const playerInput = demux.matchPlayerInput(input)
		if (playerInput === null) return false
		callback(...playerInput, state)
		return true
	}

	const repeater = new InputRepeater(feedDemux)

	const inputSourceStrings: string[] = dedup(
		config.seats.flatMap(s => s.mappings.map(m => m.source))
	)
	const unsubscribeFuncs = inputSourceStrings.map(sourceStr => {
		const source = INPUT_SOURCES[sourceStr]
		if (source) {
			return source(repeater)
		} else {
			return () => {}
		}
	})
	unsubscribeFuncs.push(...extraSources.map(source => source(repeater)))

	function unsubcribe() {
		for (const unsub of unsubscribeFuncs) {
			unsub()
		}
	}

	return unsubcribe
}

export function setLevelInputs(level: Level, buffers: InputBuffer[]) {
	for (const [idx, buffer] of buffers.entries()) {
		if (idx >= level.playerSeats.length) break
		const seat = level.playerSeats[idx]
		seat.inputs = buffer.getInputs()
	}
}

export function releaseLevelInputs(level: Level, buffers: InputBuffer[]) {
	for (const [idx, buffer] of buffers.entries()) {
		if (idx >= level.playerSeats.length) break
		const seat = level.playerSeats[idx]
		seat.inputs = buffer.getInputs()
		buffer.releaseInputs(seat.releasedInputs)
	}
}

export function useInputCollector(
	inputConfig: InputConfig,
	callback: InputCallback,
	extraSources: InputSource[] = []
) {
	useLayoutEffect(
		() => makeInputCollector(inputConfig, callback, extraSources),
		[inputConfig, callback, extraSources]
	)
}
