import {
	AttemptTracker,
	createLevelFromData,
	GameState,
	KeyInputs,
	LevelState,
	ScriptLegalInventoryTool,
	protobuf,
} from "@notcc/logic"
import { Pager } from "../pager"
import Renderer from "../visuals"
import { AnimationTimer, TimeoutIntervalTimer } from "../timers"
import { KeyListener } from "../keyListener"
import { setSelectorPage } from "./setSelector"

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

function isValidStartKey(code: string): boolean {
	if (code in keyToInputMap) return true
	if (code === "Space") return true
	return false
}

function setupKeyListener(): void {
	new KeyListener(
		ev => {
			heldKeys[ev.code] = true
		},
		ev => {
			delete heldKeys[ev.code]
		}
	)
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
	// Binding HTML stuff
	basePage: null as HTMLElement | null,
	renderer: null as Renderer | null,
	textOutputs: null as TextOutputs | null,
	completionButtons: null as CompletionButton | null,
	gameOverlay: null as HTMLElement | null,
	overlayLevelName: null as HTMLElement | null,
	viewportArea: null as HTMLElement | null,
	hintBox: null as HTMLElement | null,
	setupPage(pager: Pager, page: HTMLElement): void {
		setupKeyListener()
		if (!pager.tileset)
			throw new Error("The level player page cannot be opened with no tileset.")
		this.basePage = page
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
			this.openNextLevel(pager)
		})
		this.completionButtons.restart.addEventListener("click", async () => {
			pager.resetLevel()
		})
		this.gameOverlay = page.querySelector<HTMLElement>("#levelViewportOverlay")!
		this.viewportArea = page.querySelector<HTMLElement>(".viewportArea")
		this.overlayLevelName = page.querySelector<HTMLElement>("#overlayLevelName")
		this.hintBox = page.querySelector<HTMLElement>("#hintBox")
		this.submitAttempt = this.submitAttemptUnbound.bind(this, pager)
	},
	// Setting up level state and the game state machine
	//    Load ->
	// -> Preplay ->
	// -> Play .. (one of:)
	// -> Pause -> Play
	// -> Win -> Load or Preplay
	// -> Lose -> Preplay
	currentLevel: null as LevelState | null,
	gameState: GameState.PLAYING,
	isPaused: false,
	isPreplay: false,
	isGz: false,
	preplayKeyListener: null as KeyListener | null,
	loadLevel(pager: Pager): void {
		this.basePage!.classList.remove("solutionPlayback")
		if (pager.loadedSet?.inPostGame) return
		const level = pager.loadedLevel
		if (!level)
			throw new Error("Can't open the page since there isn't a loaded level.")

		this.currentLevel = createLevelFromData(level)

		if (!this.renderer)
			throw new Error(
				"The level player page cannot start without the renderer."
			)
		this.renderer.level = this.currentLevel
		this.gameState = GameState.PLAYING
		this.isPaused = false
		this.isGz = false
		this.isPreplay = true
		this.updateOverlayState()
		this.renderer.cameraSize = this.currentLevel.cameraType
		this.renderer.updateTileSize()
		if (!this.viewportArea)
			throw new Error(
				"Cannot set the level camera without knowing where the viewport is."
			)

		this.preplayKeyListener = new KeyListener((ev: KeyboardEvent) => {
			if (isValidStartKey(ev.code)) this.endPreplay()
		})
		if (this.overlayLevelName) {
			const levelN = pager.getLevelNumber()
			this.overlayLevelName.textContent = `${levelN ? `#${levelN}: ` : ""}${
				level.name ?? "Unnamed level"
			}`
		}
		this.attemptTracker = new AttemptTracker(
			this.currentLevel.blobPrngValue,
			pager.loadedSet?.scriptRunner.state
		)

		this.viewportArea.style.setProperty(
			"--level-camera-width",
			this.currentLevel.cameraType.width.toString()
		)
		this.viewportArea.style.setProperty(
			"--level-camera-height",
			this.currentLevel.cameraType.height.toString()
		)
		this.updateTextOutputs()
	},
	updateOverlayState(): void {
		this.gameOverlay!.setAttribute(
			"data-game-state",
			GameState[this.gameState].toLowerCase()
		)
		setAttributeExistence(this.gameOverlay!, "data-paused", this.isPaused)
		setAttributeExistence(this.gameOverlay!, "data-preplay", this.isPreplay)
		setAttributeExistence(this.gameOverlay!, "data-gz", this.isGz)
	},
	endPreplay(): void {
		this.isPreplay = false
		this.updateOverlayState()
		this.preplayKeyListener?.remove()
		this.preplayKeyListener = null
	},
	togglePaused(): void {
		if (this.gameState !== GameState.PLAYING || this.isPreplay || this.isGz)
			return

		this.isPaused = !this.isPaused
		this.updateOverlayState()
	},
	// Transition from win

	async openNextLevel(pager: Pager): Promise<void> {
		if (!pager.loadedSet) {
			alert("Congratulations on clearing the level!")
			pager.openPage(setSelectorPage)
			return
		}
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

		if (!pager.loadedLevel) return
		this.loadLevel(pager)
	},
	startPostPlay(state: GameState): void {
		this.gameState = state
		this.updateOverlayState()
		this.findCurrentMainButton()?.focus()
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
	// Managing the live level state
	attemptTracker: null as AttemptTracker | null,
	submitAttemptUnbound(pager: Pager): void {
		if (!this.attemptTracker) return
		const level = this.currentLevel!
		pager.saveAttempt(this.attemptTracker.endAttempt(level))
	},
	submitAttempt: null as (() => void) | null,
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
		this.hintBox!.textContent = this.currentLevel!.getHint() ?? ""
	},
	updateLogic(): void {
		const level = this.currentLevel
		if (!level) throw new Error("Cannot update the level without a level.")
		if (
			this.gameState === GameState.TIMEOUT ||
			this.isPaused ||
			this.isPreplay ||
			this.isGz
		)
			return
		level.gameInput = this.getInput()
		this.attemptTracker?.recordAttemptStep(level.gameInput)
		level.tick()
		this.updateTextOutputs()
		if (
			this.gameState === GameState.PLAYING &&
			level.gameState !== GameState.PLAYING
		) {
			this.startPostPlay(level.gameState)
			this.submitAttempt?.()
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
	logicTimer: null as TimeoutIntervalTimer | null,
	renderTimer: null as AnimationTimer | null,
	open(pager: Pager, page: HTMLElement): void {
		this.updateTileset(pager, page)
		if (!pager.loadedLevel)
			throw new Error("Cannot open the level player page with a level to play.")
		this.loadLevel(pager)
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
		this.preplayKeyListener?.remove()
		this.preplayKeyListener = null
		this.currentLevel = null
	},
	showInterlude(_pager: Pager, text: string): Promise<void> {
		// TODO Use a text script page?
		alert(text)
		return Promise.resolve()
	},
	showGz(): void {
		this.isGz = true
		this.isPaused = false
		this.isPreplay = false
		this.gameState = GameState.PLAYING
		this.updateOverlayState()
	},
	async loadSolution(pager: Pager, sol: protobuf.ISolutionInfo): Promise<void> {
		this.loadLevel(pager)
		this.attemptTracker = null
		this.currentLevel!.playbackSolution(sol)
		this.basePage!.classList.add("solutionPlayback")
		this.endPreplay()
	},
}
