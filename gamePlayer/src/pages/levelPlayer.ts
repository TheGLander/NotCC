import {
	createLevelFromData,
	GameState,
	KeyInputs,
	LevelData,
	LevelState,
	ScriptLegalInventoryTool,
} from "@notcc/logic"
import { Pager } from "../pager"
import Renderer from "../visuals"
import { AnimationTimer, TimeoutIntervalTimer } from "../timers"

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

function setAttributeExistence(
	node: HTMLElement,
	attrName: string,
	exists: boolean
): void {
	if (exists) {
		node.setAttribute(attrName, "")
	} else {
		node.removeAttribute(attrName)
	}
}

export const levelPlayerPage = {
	pageId: "levelPlayerPage",
	renderer: null as Renderer | null,
	currentLevel: null as LevelState | null,
	logicTimer: null as TimeoutIntervalTimer | null,
	renderTimer: null as AnimationTimer | null,
	textOutputs: null as TextOutputs | null,
	completionButtons: null as CompletionButton | null,
	gameOverlay: null as HTMLElement | null,
	viewportArea: null as HTMLElement | null,
	gameState: GameState.PLAYING,
	isPaused: false,
	loadLevel(level: LevelData): void {
		this.currentLevel = createLevelFromData(level)

		if (!this.renderer)
			throw new Error(
				"The level player page cannot start without the renderer."
			)
		this.renderer.level = this.currentLevel
		this.gameState = GameState.PLAYING
		this.gameOverlay!.setAttribute(
			"data-game-state",
			GameState[this.gameState].toLowerCase()
		)
		setAttributeExistence(this.gameOverlay!, "data-paused", this.isPaused)
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
	resetLevel(pager: Pager): void {
		this.loadLevel(pager.loadedLevel!)
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
		this.completionButtons.nextLevel.addEventListener("click", async () => {
			if (!pager.loadedSet) {
				alert("Congratulations on clearing the level!")
			} else {
				const level = this.currentLevel!
				const playable = level.selectedPlayable!
				const keys = playable.inventory.keys
				await pager.loadNextLevel({
					type: "win",
					inventoryKeys: {
						blue: keys.blueKey?.amount ?? 0,
						green: keys.greenKey?.amount ?? 0,
						red: keys.redKey?.amount ?? 0,
						yellow: keys.yellowKey?.amount ?? 0,
					},
					lastExitGender: playable.tags.includes("melinda") ? "female" : "male",
					timeLeft: level.timeLeft,
					lastExitN: 0, // TODO Track this
					inventoryTools: playable.inventory.items.map(
						item => item.id as ScriptLegalInventoryTool
					),
					totalScore: 0, // TODO Track this
				})
			}
			if (!pager.loadedLevel) return
			this.loadLevel(pager.loadedLevel)
		})
		this.completionButtons.restart.addEventListener("click", async () => {
			await pager.loadNextLevel({ type: "retry" })
			this.resetLevel(pager)
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
		if (this.gameState !== GameState.PLAYING) return
		this.textOutputs.chips.textContent = this.currentLevel!.chipsLeft.toString()
		this.textOutputs.bonusPoints.textContent =
			this.currentLevel!.bonusPoints.toString()
		const currentTime = this.currentLevel!.timeLeft
		this.textOutputs.time.textContent = `${
			this.currentLevel!.timeFrozen ? "❄" : ""
		}${Math.ceil(currentTime / 60)}s`
	},
	updateLogic(): void {
		const level = this.currentLevel
		if (!level) throw new Error("Cannot update the level without a level.")
		if (this.gameState === GameState.TIMEOUT || this.isPaused) return
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
		this.logicTimer = new TimeoutIntervalTimer(
			this.updateLogic.bind(this),
			1 / 60
		)
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
	togglePaused(): void {
		this.isPaused = !this.isPaused
		setAttributeExistence(this.gameOverlay!, "data-paused", this.isPaused)
	},
}