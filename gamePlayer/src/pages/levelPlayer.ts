import {
	createLevelFromData,
	GameState,
	KeyInputs,
	LevelData,
	LevelState,
} from "@notcc/logic"
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

interface CompletionButton {
	restart: HTMLElement
	nextLevel: HTMLElement
	scores: HTMLElement
	explodeJupiter: HTMLElement
}

export const levelPlayerPage = {
	pageId: "levelPlayerPage",
	renderer: null as Renderer | null,
	currentLevel: null as LevelState | null,
	logicTimer: null as IntervalTimer | null,
	renderTimer: null as AnimationTimer | null,
	textOutputs: null as TextOutputs | null,
	completionButtons: null as CompletionButton | null,
	gameOverlay: null as HTMLElement | null,
	viewportArea: null as HTMLElement | null,
	completionMomentTime: null as number | null,
	gameState: GameState.PLAYING,
	loadLevel(level: LevelData): void {
		this.currentLevel = createLevelFromData(level)

		if (!this.renderer)
			throw new Error(
				"The level player page cannot start without the renderer."
			)
		this.renderer.level = this.currentLevel
		this.completionMomentTime = null
		this.gameState = GameState.PLAYING
		this.gameOverlay?.setAttribute(
			"data-game-state",
			GameState[this.gameState].toLowerCase()
		)
		this.renderer.cameraSize = this.currentLevel.cameraType
		this.renderer.updateTileSize()
		if (!this.viewportArea)
			throw new Error(
				"Cannot set the level camera without knowing where the viewport is."
			)

		this.viewportArea.style.setProperty(
			"--level-camera-width",
			this.currentLevel.cameraType.width.toString()
		)
		this.viewportArea.style.setProperty(
			"--level-camera-height",
			this.currentLevel.cameraType.height.toString()
		)
	},
	findCurrentMainButton(): HTMLButtonElement | null {
		if (!this.gameOverlay)
			throw new Error("The game overlay must be set to find the main button.")

		return (
			Array.from(
				this.gameOverlay.querySelectorAll<HTMLButtonElement>(".mainButton")
			).find(button => button.getBoundingClientRect().height !== 0) ?? null
		)
	},
	setupPage(pager: Pager, page: HTMLElement): void {
		setupKeyListener()
		if (!pager.tileset)
			throw new Error("The level player page cannot be opened with no tileset.")
		const viewportCanvas = page.querySelector<HTMLCanvasElement>(
			"#levelViewportCanvas"
		)!
		const inventoryCanvas = page.querySelector<HTMLCanvasElement>(
			"#levelInventoryCanvas"
		)!
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
		this.completionButtons = {
			restart: page.querySelector("#restartButton")!,
			explodeJupiter: page.querySelector("#explodeJupiterButton")!,
			nextLevel: page.querySelector("#nextLevelButton")!,
			scores: page.querySelector("#scoresButton")!,
		}

		if (
			!this.completionButtons.scores ||
			!this.completionButtons.explodeJupiter ||
			!this.completionButtons.restart ||
			!this.completionButtons.nextLevel
		)
			throw new Error("Could not find the completion button elements.")
		this.completionButtons.nextLevel.addEventListener("click", () => {
			alert("Oops, sets aren't implemented yet.")
			this.loadLevel(pager.loadedLevel!)
		})
		this.completionButtons.restart.addEventListener("click", () => {
			this.loadLevel(pager.loadedLevel!)
		})
		this.gameOverlay = document.querySelector<HTMLElement>(
			"#levelViewportOverlay"
		)!
		this.viewportArea = page.querySelector<HTMLElement>(".viewportArea")
	},
	getInput(): KeyInputs {
		const keyInputs: Partial<KeyInputs> = {}
		for (const [key, val] of Object.entries(keyToInputMap)) {
			keyInputs[val] = !!heldKeys[key]
		}
		return keyInputs as KeyInputs
	},
	updateTextOutputs(): void {
		if (!this.textOutputs) return
		this.textOutputs.chips.textContent = this.currentLevel!.chipsLeft.toString()
		this.textOutputs.bonusPoints.textContent =
			this.currentLevel!.bonusPoints.toString()
		const currentTime = this.completionMomentTime ?? this.currentLevel!.timeLeft
		this.textOutputs.time.textContent = `${
			this.currentLevel!.timeFrozen ? "❄" : ""
		}${Math.ceil(currentTime / 60)}s`
	},
	updateLogic(): void {
		const level = this.currentLevel
		if (!level) throw new Error("Cannot update the level without a level.")
		if (this.gameState === GameState.TIMEOUT) return
		level.gameInput = this.getInput()
		level.tick()
		this.updateTextOutputs()
		if (
			this.gameState === GameState.PLAYING &&
			level.gameState !== GameState.PLAYING
		) {
			this.gameState = level.gameState
			this.gameOverlay?.setAttribute(
				"data-game-state",
				GameState[this.gameState].toLowerCase()
			)
			this.completionMomentTime = level.timeLeft
			this.findCurrentMainButton()?.focus()
		}
	},
	updateRender(): void {
		this.renderer!.frame()
	},
	updateTileset(pager: Pager, page: HTMLElement): void {
		if (!pager.tileset)
			throw new Error("Can't update the tileset without a tileset.")
		if (!this.renderer) throw new Error("Can't update ")
		page.style.setProperty(
			"--base-tile-size",
			`${pager.tileset.tileSize.toString()}px`
		)
		// TODO Make this dynamic, line in LL
		page.style.setProperty("--tile-scale", "2")
	},
	open(pager: Pager, page: HTMLElement): void {
		this.updateTileset(pager, page)
		const loadedLevel = pager.loadedLevel
		if (!loadedLevel)
			throw new Error("Cannot open the level player page with a level to play.")
		this.loadLevel(loadedLevel)
		this.updateTextOutputs()
		this.logicTimer = new IntervalTimer(this.updateLogic.bind(this), 1 / 60)
		this.renderTimer = new AnimationTimer(this.updateRender.bind(this))
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
