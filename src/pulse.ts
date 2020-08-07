import { LevelState } from "./level"
import { l } from "./helpers"
import { Config } from "./config"
import { Direction } from "./helpers"
import keycode from "keycode"
import Renderer from "./visuals"

enum keymap {
	up = "up",
	down = "down",
	left = "left",
	right = "right",
	z = "drop",
	x = "rotateInv",
	c = "switchPlayable",
}
export interface KeyInputs {
	up: boolean
	down: boolean
	left: boolean
	right: boolean
	drop: boolean
	rotateInv: boolean
	switchPlayable: boolean
}
export async function initPulse(level: LevelState, config: Config) {
	const buttonsPressed: KeyInputs = {
		up: false,
		down: false,
		left: false,
		right: false,
		drop: false,
		rotateInv: false,
		switchPlayable: false,
	}

	const renderer = new Renderer(level)

	await renderer.ready

	/**
	 * Renders and updates devtool stuff
	 */
	function devtools() {
		trackFps()
		if (config.debugMode) l("devTools").classList.remove("hidden")
		else l("devTools").classList.add("hidden")
		;(l("inputsDisplay") as HTMLInputElement).value = JSON.stringify(
			buttonsPressed
		)
	}
	/**
	 * Tracks Fps
	 */
	function trackFps() {
		const thisPulse = new Date().getTime()
		//Add new FPS measure to the array
		fpsRecords.push((1 / (thisPulse - lastPulse)) * 1000)
		fpsRecords.shift()
		//Find medium from all the elements
		l("fps").innerText = Math.round(
			fpsRecords.reduce((acc, val) => acc + val) / fpsRecords.length
		).toString()
		lastPulse = thisPulse
	}

	function tickLevel(force: boolean = false): void {
		if (level.lost && !force) {
			alert("Bummer")
			return
		}
		level.giveInput(buttonsPressed)
		level.tick()
	}
	//Pulse stuff
	let lastPulse = new Date().getTime()
	let pulseI = 0
	const fpsRecords: number[] = []
	for (let i = 0; i < config.framePulseModulo * config.pulsesPerSecond; i++) {
		fpsRecords.push(0)
	}
	function pulse(): void {
		devtools()
		if (pulseI % config.tickPulseModulo === 0) tickLevel()
		if (pulseI % config.framePulseModulo === 0) renderer.frame()
		pulseI = (pulseI + 1) % (config.pulsesPerSecond + 1)
	}
	//Devtools
	l("forceTick").addEventListener("click", () => {
		tickLevel(true)
		renderer.frame()
	})
	l("forceRender").addEventListener("click", renderer.frame.bind(renderer))

	//Key things
	window.addEventListener("keydown", ev => {
		if (keycode(ev) in keymap) buttonsPressed[keymap[keycode(ev)]] = true
	})
	window.addEventListener("keyup", ev => {
		if (keycode(ev) in keymap) buttonsPressed[keymap[keycode(ev)]] = false
	})
	renderer.frame()
	setInterval(pulse, 1000 / config.pulsesPerSecond)
}
