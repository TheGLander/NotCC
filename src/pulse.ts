import { LevelState } from "./level"
import { Direction } from "./helpers"
import keycode from "keycode"
import Renderer from "./visuals"

const keymap = {
	up: "up",
	down: "down",
	left: "left",
	right: "right",
	z: "drop",
	x: "rotateInv",
	c: "switchPlayable",
} as const
export interface KeyInputs {
	up: boolean
	down: boolean
	left: boolean
	right: boolean
	drop: boolean
	rotateInv: boolean
	switchPlayable: boolean
}
export async function initPulse(level: LevelState) {
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
		/*if (config.debugMode) l("devTools").classList.remove("hidden")
		else l("devTools").classList.add("hidden")
		;(l("inputsDisplay") as HTMLInputElement).value = JSON.stringify(
			buttonsPressed
		)*/
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
		/*l("fps").innerText = Math.round(
			fpsRecords.reduce((acc, val) => acc + val) / fpsRecords.length
		).toString()*/
		lastPulse = thisPulse
	}

	function tickLevel(force = false): void {
		if (level.lost && !force) {
			alert("Bummer")
			return
		}
		level.giveInput(buttonsPressed)
		level.tick()
	}
	//Pulse stuff
	let lastPulse = new Date().getTime()
	const fpsRecords: number[] = []
	for (let i = 0; i < 300; i++) {
		fpsRecords.push(0)
	}
	function pulse(): void {
		devtools()
		tickLevel()
		renderer.frame()
	}
	//Devtools
	/*l("forceTick").addEventListener("click", () => {
		tickLevel(true)
		renderer.frame()
	})
	l("forceRender").addEventListener("click", renderer.frame.bind(renderer))*/

	//Key things]

	const checkIfRelevant = (key: string): key is keyof typeof keymap =>
		key in keymap

	window.addEventListener("keydown", ev => {
		const key = keycode(ev)
		if (!checkIfRelevant(key)) return
		buttonsPressed[keymap[key]] = true
	})
	window.addEventListener("keyup", ev => {
		const key = keycode(ev)
		if (!checkIfRelevant(key)) return
		buttonsPressed[keymap[key]] = false
	})
	renderer.frame()
	setInterval(pulse, 1000 / 60)
}
