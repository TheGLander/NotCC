import { Direction, KeyInputs } from "@notcc/logic"
import clone from "clone"
import { parseHotkey } from "is-hotkey"
import { IntervalTimer, KeyListener } from "./utils"

// TODO Smart TV inputs
// TODO Customizable inputs in general
export const keyToInputMap: Record<string, keyof KeyInputs> = {
	ArrowUp: "up",
	ArrowRight: "right",
	ArrowDown: "down",
	ArrowLeft: "left",
	KeyZ: "drop",
	KeyX: "rotateInv",
	KeyC: "switchPlayable",
}

export function isValidKey(code: string): boolean {
	return code in keyToInputMap
}

export function isValidStartKey(code: string): boolean {
	return isValidKey(code) || code === "Space"
}

export type ControlMode = "controller" | "keyboard"
type GamepadDirectionMode = "left stick" | "d-pad"

const dirKeys = {
	UP: ["up", "ArrowUp"],
	RIGHT: ["right", "ArrowRight"],
	DOWN: ["down", "ArrowDown"],
	LEFT: ["left", "ArrowLeft"],
} as const

const buttonToKeyMap: Record<number, readonly [string, string]> = {
	0: ["space", "Space"],
	1: ["c", "KeyC"],
	2: ["z", "KeyZ"],
	3: ["x", "KeyX"],
	4: ["shift+p", "KeyP"],
	5: ["shift+n", "KeyN"],
	6: ["shift+r", "KeyR"],
	8: ["esc", "Escape"],
	9: ["p", "KeyP"],
	12: dirKeys.UP,
	13: dirKeys.DOWN,
	14: dirKeys.LEFT,
	15: dirKeys.RIGHT,
}

const STICK_HOLD_THRESHOLD = 0.5

function determineStickDirections(x: number, y: number): Direction[] {
	const dirs: Direction[] = []
	if (x < -STICK_HOLD_THRESHOLD) dirs.push(Direction.LEFT)
	if (x > STICK_HOLD_THRESHOLD) dirs.push(Direction.RIGHT)
	if (y < -STICK_HOLD_THRESHOLD) dirs.push(Direction.UP)
	if (y > STICK_HOLD_THRESHOLD) dirs.push(Direction.DOWN)
	return dirs
}

export class GamepadInputHandler {
	constructor() {}
	controlMode: ControlMode | null = null
	inSession = false
	gamepadControlMode: GamepadDirectionMode | null = null
	newSession() {
		this.inSession = true
		this.controlMode = null
		this.gamepadControlMode = null
	}
	exitSession() {
		this.inSession = false
	}

	keyListener: KeyListener = new KeyListener(this.keyListenerHandler.bind(this))
	keyListenerHandler(ev: KeyboardEvent) {
		if (this.inSession && this.controlMode === null) {
			this.controlMode = "keyboard"
		}
		if (ev.isTrusted && this.inSession && this.controlMode === "controller") {
			ev.preventDefault()
			ev.stopImmediatePropagation()
		}
	}

	doKeyPress(
		codeStr: readonly [string, string],
		pressed: boolean,
		lastPressed: boolean
	) {
		const keyInit: KeyboardEventInit = parseHotkey(codeStr[0])
		keyInit.keyCode = keyInit.which
		keyInit.code = codeStr[1]

		if (pressed && !lastPressed) {
			this.controlMode = "controller"
			document.dispatchEvent(new KeyboardEvent("keydown", keyInit))
		}
		if (!pressed && lastPressed) {
			document.dispatchEvent(new KeyboardEvent("keyup", keyInit))
		}
	}

	gamepadPoller: IntervalTimer = new IntervalTimer(
		this.gamepadPoll.bind(this),
		1 / 60
	)
	lastGamepadState: Gamepad | null = null

	gamepadPoll() {
		if (this.inSession && this.controlMode === "keyboard") return
		const gamepad = navigator.getGamepads()[0]
		if (!gamepad || gamepad.mapping !== "standard") return

		for (const [buttonIdx, codeStr] of Object.entries(buttonToKeyMap)) {
			if (
				this.gamepadControlMode === "left stick" &&
				codeStr[1].startsWith("Arrow")
			)
				continue
			const pressed = gamepad.buttons[buttonIdx as unknown as number].pressed
			const lastPressed =
				this.lastGamepadState?.buttons[buttonIdx as unknown as number]
					.pressed ?? false
			this.doKeyPress(codeStr, pressed, lastPressed)
			if (pressed && codeStr[1].startsWith("Arrow")) {
				this.gamepadControlMode = "d-pad"
			}
		}

		if (this.gamepadControlMode !== "d-pad") {
			const pressedDirs = determineStickDirections(
				gamepad.axes[0],
				gamepad.axes[1]
			)
			if (pressedDirs.length !== 0) {
				this.gamepadControlMode = "left stick"
			}
			const lastPressedDirs = determineStickDirections(
				this.lastGamepadState?.axes[0] ?? 0,
				this.lastGamepadState?.axes[1] ?? 0
			)
			for (let dir = Direction.UP; dir <= Direction.LEFT; dir += 1) {
				this.doKeyPress(
					dirKeys[Direction[dir] as "UP"],
					pressedDirs.includes(dir),
					lastPressedDirs.includes(dir)
				)
			}
		}

		this.lastGamepadState = clone(gamepad, false, Infinity, null)
	}

	remove() {
		this.keyListener.remove()
		this.gamepadPoller.cancel()
	}
}
