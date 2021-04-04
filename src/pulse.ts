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

function stabilizeFactory(bufferLength = 60): (val: number) => number {
	const buffer: number[] = []
	return num => {
		buffer.push(num)
		if (buffer.length === bufferLength) buffer.shift()
		return buffer.reduce((acc, val) => acc + val) / buffer.length
	}
}

const fpsCounter = document.querySelector<HTMLElement>("#fpsCounter")
const delayCounter = document.querySelector<HTMLElement>("#delayCounter")

export async function initPulse(
	level: LevelState,
	renderSpace?: HTMLElement | null,
	itemSpace?: HTMLElement | null
) {
	const buttonsPressed: KeyInputs = {
		up: false,
		down: false,
		left: false,
		right: false,
		drop: false,
		rotateInv: false,
		switchPlayable: false,
	}

	const renderer = new Renderer(level, renderSpace, itemSpace)

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

	let lastPulse = Date.now()
	/**
	 * Tracks Fps
	 */
	const stabilizeFps = stabilizeFactory()
	const stabilizeDelay = stabilizeFactory()
	function trackFps() {
		const thisPulse = Date.now()
		if (fpsCounter)
			fpsCounter.innerText = `FPS: ${Math.round(
				stabilizeFps((1 / (thisPulse - lastPulse)) * 1000)
			)}`
		lastPulse = thisPulse
	}

	let isDead = false
	function tickLevel(force = false): void {
		if (level.lost && !force) {
			if (!isDead) {
				alert("Bummer")
				isDead = true
			}
			return
		}
		level.giveInput(buttonsPressed)
		level.tick()
	}
	//Pulse stuff

	function pulse(): void {
		devtools()
		tickLevel()
		if (delayCounter)
			delayCounter.innerText = `Calculation delay: ${
				Math.round(stabilizeDelay(Date.now() - lastPulse) * 1000) / 1000
			}ms`
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
	const pulseId = setInterval(pulse, 1000 / 60)
	function stopPulsing(): void {
		renderer.destroy()
		clearInterval(pulseId)
	}
	return { stopPulsing }
}
