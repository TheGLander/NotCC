import { createLevelFromData, KeyInputs, LevelState } from "@notcc/logic"
import { Pager } from "../pager"
import Renderer from "../visuals"
import { AnimationTimer, IntervalTimer } from "../timers"

const heldKeys: Partial<Record<string, true>> = {}

// TODO Smart TV inputs
// TODO Customizable inputs in general
const keyToInputMap: Record<string, keyof KeyInputs> = {
	ArrowUp: "up",
	ArrowRight: "right",
	ArrowDown: "down",
	ArrowLeft: "left",
	KeyZ: "drop",
	KeyX: "rotateInv",
	KeyC: "switchPlayable",
}

function setupKeyListener(): void {
	document.addEventListener("keydown", ev => {
		heldKeys[ev.code] = true
	})
	document.addEventListener("keyup", ev => {
		delete heldKeys[ev.code]
	})
}

interface TextOutputs {
	chips: HTMLElement
	time: HTMLElement
	bonusPoints: HTMLElement
}

export const levelPlayerPage = {
	pageId: "levelPlayerPage",
	renderer: null as Renderer | null,
	currentLevel: null as LevelState | null,
	logicTimer: null as IntervalTimer | null,
	renderTimer: null as AnimationTimer | null,
	textOutputs: null as TextOutputs | null,
	restart(pager: Pager): void {
		if (!pager.loadedLevel) return
		this.currentLevel = createLevelFromData(pager.loadedLevel)

		if (!this.renderer)
			throw new Error(
				"The level player page cannot start without the renderer."
			)
		this.renderer.level = this.currentLevel
		this.renderer.cameraSize = this.currentLevel.cameraType
		this.renderer.updateTileSize()
	},
	setupPage(pager: Pager, page: HTMLElement): void {
		setupKeyListener()
		if (!pager.tileset)
			throw new Error("The level player page cannot be opened with no tileset.")
		const viewportCanvas = page.querySelector<HTMLCanvasElement>(".viewport")!
		const inventoryCanvas = page.querySelector<HTMLCanvasElement>(".inventory")!
		this.renderer = new Renderer(pager.tileset, viewportCanvas, inventoryCanvas)
		this.textOutputs = {
			chips: page.querySelector("#chipsText")!,
			time: page.querySelector("#timeLeftText")!,
			bonusPoints: page.querySelector("#bonusPointsText")!,
		}
		if (
			!this.textOutputs.chips ||
			!this.textOutputs.time ||
			!this.textOutputs.bonusPoints
		)
			throw new Error("Could not find the text output elements.")
	},
	getInput(): KeyInputs {
		const keyInputs: Partial<KeyInputs> = {}
		for (const [key, val] of Object.entries(keyToInputMap)) {
			keyInputs[val] = !!heldKeys[key]
		}
		return keyInputs as KeyInputs
	},
	updateLogic(): void {
		if (!this.currentLevel)
			throw new Error("Cannot update the level without a level.")
		this.currentLevel.gameInput = this.getInput()
		this.currentLevel.tick()
		if (this.textOutputs) {
			this.textOutputs.chips.textContent =
				this.currentLevel.chipsLeft.toString()
			this.textOutputs.bonusPoints.textContent =
				this.currentLevel.bonusPoints.toString()
			this.textOutputs.time.textContent = `${
				this.currentLevel.timeFrozen ? "❄" : ""
			}${Math.ceil(this.currentLevel.timeLeft / 60)}s`
		}
	},
	updateRender(): void {
		this.renderer!.frame()
	},
	open(pager: Pager): void {
		this.logicTimer = new IntervalTimer(this.updateLogic.bind(this), 1 / 60)
		this.renderTimer = new AnimationTimer(this.updateRender.bind(this))
		this.restart(pager)
	},
	close(): void {
		if (this.logicTimer) {
			this.logicTimer.cancel()
			this.logicTimer = null
		}
		if (this.renderTimer) {
			this.renderTimer.cancel()
			this.renderTimer = null
		}
		this.currentLevel = null
	},
}
