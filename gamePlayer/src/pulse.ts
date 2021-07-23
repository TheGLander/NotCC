import {
	GameState,
	LevelState,
	InputType,
	KeyInputs,
	decodeSolutionStep,
	encodeSolutionStep,
} from "./logic/level"
import keycode from "keycode"
import Renderer from "./visuals"
import { SolutionStep } from "./logic/encoder"
import rfdc from "rfdc"

const clone = rfdc({ circles: true })

const isSmartTV =
	/smart-tv|smarttv|googletv|appletv|hbbtv|pov_tv|netcast.tv/.test(
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

type EventNames = "stateChange" | "win" | "lose" | "newLevel"

export class PulseManager {
	ticksPerSecond = 60
	keysPressed: KeyInputs = {
		up: false,
		down: false,
		left: false,
		right: false,
		drop: false,
		rotateInv: false,
		switchPlayable: false,
	}
	recordedSteps: SolutionStep[] = []
	renderer: Renderer
	ready: Promise<void>
	lastLevelGameState = GameState.PLAYING
	eventsRegistered: Record<EventNames, (() => void)[]> = {
		lose: [],
		win: [],
		stateChange: [],
		newLevel: [],
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
	oldLevelStates: LevelState[] = []
	constructor(
		public level: LevelState,
		public renderSpace?: HTMLElement | null,
		public itemSpace?: HTMLElement | null,
		public textStats?: HTMLTextAreaElement | null
	) {
		this.renderer = new Renderer(level, renderSpace, itemSpace)
		this.updateFrame = this.updateFrame.bind(this)
		this.ready = this.renderer.ready
		window.addEventListener("keydown", this.keyDownFunc.bind(this))
		window.addEventListener("keyup", this.keyUpFunc.bind(this))
		this.updateFrame()
		this.tickLevel = this.tickLevel.bind(this)
		this.tickLevel()
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
		this.renderer.updateCameraSizes()

		this.eventsRegistered.newLevel.forEach(val => val())
		this.recordedSteps = []
		this.oldLevelStates = []
	}
	updateTextStats(): void {
		if (!this.textStats) return
		this.textStats.value = `Time left: ${Math.ceil(this.level.timeLeft / 60)}s
Chips left: ${this.level.chipsLeft}${
			this.level.bonusPoints > 0
				? `
Bonus: ${this.level.bonusPoints}pts`
				: ""
		}`
	}
	tickLevel(): void {
		const oldTime = Date.now()
		this.level.gameInput = this.keysPressed
		let ticksProcessed = 0
		for (; ticksProcessed < this.ticksPerSecond / 60; ticksProcessed++)
			this.level.tick()
		if (
			this.recordedSteps[this.recordedSteps.length - 1]?.[0] !==
			encodeSolutionStep(this.keysPressed)[0]
		)
			this.recordedSteps.push(encodeSolutionStep(this.keysPressed))
		this.recordedSteps[this.recordedSteps.length - 1][1]++
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
		/*if (
			this.level.currentTick >= 300 &&
			this.level.currentTick % 300 === 0 &&
			this.level.subtick === 2
		)
			this.oldLevelStates.push(clone(this.level))*/
		setTimeout(
			this.tickLevel,
			1000 / (this.ticksPerSecond / ticksProcessed) - (Date.now() - oldTime)
		)
	}
}
