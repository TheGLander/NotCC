import { GameState, LevelState } from "./level"
import keycode from "keycode"
import Renderer from "./visuals"

export interface KeyInputs {
	up: boolean
	down: boolean
	left: boolean
	right: boolean
	drop: boolean
	rotateInv: boolean
	switchPlayable: boolean
}

type InputType = keyof KeyInputs

const isSmartTV = /smart-tv|smarttv|googletv|appletv|hbbtv|pov_tv|netcast.tv/.test(
	navigator.userAgent.toLowerCase()
)

function stabilizeFactory(bufferLength = 60): (val: number) => number {
	const buffer: number[] = []
	return num => {
		buffer.push(num)
		if (buffer.length === bufferLength) buffer.shift()
		return buffer.reduce((acc, val) => acc + val) / buffer.length
	}
}

const keymap: Record<string, InputType> = isSmartTV
	? {
			2: "up",
			4: "left",
			6: "right",
			8: "down",
			1: "drop",
			3: "rotateInv",
			5: "switchPlayable",
	  }
	: {
			up: "up",
			down: "down",
			left: "left",
			right: "right",
			z: "drop",
			x: "rotateInv",
			c: "switchPlayable",
	  }

const checkIfRelevant = (key: string): key is keyof typeof keymap =>
	key in keymap

const fpsCounter = document.querySelector<HTMLElement>("#fpsCounter")
const delayCounter = document.querySelector<HTMLElement>("#delayCounter")

type EventNames = "stateChange" | "win" | "lose"

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
	eventsRegistered: Record<EventNames, (() => void)[]> = {
		lose: [],
		win: [],
		stateChange: [],
	}

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
	updateFrame(): void {
		requestAnimationFrame(this.updateFrame)
		this.renderer.frame()
		this.trackFps()
	}
	logicIntervalId: number
	constructor(
		public level: LevelState,
		public renderSpace?: HTMLElement | null,
		public itemSpace?: HTMLElement | null,
		public textStats?: HTMLElement | null
	) {
		this.renderer = new Renderer(level, renderSpace, itemSpace)
		this.updateFrame = this.updateFrame.bind(this)
		this.ready = this.renderer.ready
		window.addEventListener("keydown", this.keyDownFunc.bind(this))
		window.addEventListener("keyup", this.keyUpFunc.bind(this))
		// This is not node.js
		this.logicIntervalId = (setInterval(
			() => this.tickLevel(),
			1000 / 60
		) as unknown) as number
		this.updateFrame()
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
	async setNewLevel(level: LevelState): Promise<void> {
		this.renderer.level = this.level = level
		this.keysPressed = {
			up: false,
			down: false,
			left: false,
			right: false,
			drop: false,
			rotateInv: false,
			switchPlayable: false,
		}
		await this.renderer.updateFillerData()
	}
	updateTextStats(): void {
		if (!this.textStats) return
		this.textStats.innerText = `Time left: ${Math.ceil(
			this.level.timeLeft / 20
		)}s
Chips left: ${this.level.chipsLeft}`
	}
	tickLevel(): void {
		const oldTime = Date.now()
		this.level.giveInput(this.keysPressed)
		this.level.tick()
		this.updateTextStats()
		switch (this.level.gameState) {
			case GameState.LOST:
				if (
					this.lastLevelGameState === GameState.PLAYING ||
					this.level.currentTick === 0
				) {
					this.renderer.frame()
					alert("Bummer")
					this.eventsRegistered.lose.forEach(val => val())
					this.eventsRegistered.stateChange.forEach(val => val())
				}
				break
			case GameState.WON:
				if (this.lastLevelGameState === GameState.PLAYING) {
					alert("You won!")
					this.eventsRegistered.win.forEach(val => val())
					this.eventsRegistered.stateChange.forEach(val => val())
				}
				break
		}
		this.lastLevelGameState = this.level.gameState
		if (delayCounter)
			delayCounter.innerText = `Calculation delay: ${
				Math.round(this.countDelay(Date.now() - oldTime) * 1000) / 1000
			}ms`
	}
}
