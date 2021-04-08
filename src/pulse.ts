import { GameState, LevelState } from "./level"
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

const checkIfRelevant = (key: string): key is keyof typeof keymap =>
	key in keymap

const fpsCounter = document.querySelector<HTMLElement>("#fpsCounter")
const delayCounter = document.querySelector<HTMLElement>("#delayCounter")
export class PulseManager {
	keysPressed: KeyInputs = {
		up: false,
		down: false,
		left: false,
		right: false,
		drop: false,
		rotateInv: false,
		switchPlayable: false,
	}
	renderer: Renderer
	ready: Promise<void>
	lastLevelGameState = GameState.PLAYING
	protected countFps = stabilizeFactory()
	protected countDelay = stabilizeFactory()
	protected keyDownFunc(ev: KeyboardEvent): void {
		const key = keycode(ev)
		if (!checkIfRelevant(key)) return
		this.keysPressed[keymap[key]] = true
	}
	protected keyUpFunc(ev: KeyboardEvent): void {
		const key = keycode(ev)
		if (!checkIfRelevant(key)) return
		this.keysPressed[keymap[key]] = false
	}
	constructor(
		public level: LevelState,
		public renderSpace?: HTMLElement | null,
		public itemSpace?: HTMLElement | null
	) {
		this.renderer = new Renderer(level, renderSpace, itemSpace)
		this.ready = this.renderer.ready
		window.addEventListener("keydown", this.keyDownFunc.bind(this))
		window.addEventListener("keyup", this.keyUpFunc.bind(this))
		setInterval(this.renderFrame.bind(this), 1000 / 60)
	}
	lastPulse = Date.now()
	trackFps(): void {
		const thisPulse = Date.now()
		if (fpsCounter)
			fpsCounter.innerText = `FPS: ${Math.round(
				this.countFps((1 / (thisPulse - this.lastPulse)) * 1000)
			)}`
		this.lastPulse = thisPulse
	}
	renderFrame(): void {
		this.trackFps()
		this.tickLevel()
		if (delayCounter)
			delayCounter.innerText = `Calculation delay: ${
				Math.round(this.countDelay(Date.now() - this.lastPulse) * 1000) / 1000
			}ms`
		if (this.renderer.readyBool) this.renderer.frame()
	}
	setNewLevel(level: LevelState): void {
		this.renderer.destroy()
		this.level = level
		this.renderer = new Renderer(level, this.renderSpace, this.itemSpace)
	}
	tickLevel(): void {
		this.level.giveInput(this.keysPressed)
		this.level.tick()
		switch (this.level.gameState) {
			case GameState.LOST:
				if (this.lastLevelGameState === GameState.PLAYING) alert("Bummer")
				break
			case GameState.WON:
				if (this.lastLevelGameState === GameState.PLAYING) alert("You won!")
				break
		}
		this.lastLevelGameState = this.level.gameState
	}
}
