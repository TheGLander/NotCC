import { LevelState } from "./level"
import { l } from "./helpers"
import config from "./config"
import { Direction } from "./helpers"
import keycode from "keycode"

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
export function initPulse(level: LevelState) {
	const buttonsPressed: KeyInputs = {
		up: false,
		down: false,
		left: false,
		right: false,
		drop: false,
		rotateInv: false,
		switchPlayable: false,
	}
	/**
	 * Draws the visuals
	 */
	function drawFrame() {
		l("renderSpace").innerHTML = ""
		for (const x in level.field) {
			const column = document.createElement("td")
			for (const y in level.field[x]) {
				const row = document.createElement("tr")
				row.innerText = `${level.field[x][y][0]?.name || "None"} `
				row.innerText += level.field[x][y][0]
					? Direction[level.field[x][y][0].direction]
					: ""
				column.appendChild(row)
			}
			l("renderSpace").appendChild(column)
		}
	}
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
		if (level.lost) {
			alert("Bummer")
			return
		}
		level.giveInput(buttonsPressed)
		level.tick()
	}
	//Pulse stuff
	let lastPulse = new Date().getTime()
	let pulseI = 0
	const fpsRecords = new Array(config.framesPerSecond)
	function pulse(): void {
		devtools()
		if (pulseI % config.tickPulseModulo === 0) tickLevel()
		if (pulseI % config.framePulseModulo === 0) drawFrame()
		pulseI = (pulseI + 1) % (config.pulsesPerSecond + 1)
	}
	//Devtools
	l("forceTick").addEventListener("click", () => {
		tickLevel(true)
		drawFrame()
	})
	l("forceRender").addEventListener("click", () => drawFrame())

	//Key things
	window.addEventListener("keydown", ev => {
		if (keycode(ev) in keymap) buttonsPressed[keymap[keycode(ev)]] = true
	})
	window.addEventListener("keyup", ev => {
		if (keycode(ev) in keymap) buttonsPressed[keymap[keycode(ev)]] = false
	})
	drawFrame()
	setInterval(pulse, 1000 / config.pulsesPerSecond)
}
