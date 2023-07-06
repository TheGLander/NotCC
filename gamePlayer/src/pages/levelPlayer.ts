import {
	AttemptTracker,
	GameState,
	KeyInputs,
	ScriptLegalInventoryTool,
	protobuf,
} from "@notcc/logic"
import { Pager } from "../pager"
import {
	AnimationTimer,
	TimeoutIntervalTimer,
	KeyListener,
	setAttributeExistence,
} from "../utils"
import { setSelectorPage } from "./setSelector"
import { AudioSfxManager } from "../sfx"
import {
	isValidKey,
	isValidStartKey,
	keyToInputMap,
	playerPageBase,
	glitchNames,
	nonLegalGlitches,
} from "./basePlayer"

const heldKeys: Partial<Record<string, true>> = {}

function setupKeyListener(): void {
	new KeyListener(
		ev => {
			if (isValidKey(ev.code)) {
				ev.preventDefault()
				ev.stopPropagation()
				heldKeys[ev.code] = true
			}
		},
		ev => {
			if (isValidKey(ev.code)) {
				ev.preventDefault()
				ev.stopPropagation()
				delete heldKeys[ev.code]
			}
		}
	)
}

interface OverlayButtons {
	restart: HTMLElement
	nonLegalRestart: HTMLElement
	nextLevel: HTMLElement
	scores: HTMLElement
	explodeJupiter: HTMLElement
	unpause: HTMLElement
	gzLeveList: HTMLElement
	gzSetSelector: HTMLElement
}

export const levelPlayerPage = {
	...playerPageBase,
	pageId: "levelPlayerPage",
	// Binding HTML stuff
	overlayButtons: null as OverlayButtons | null,
	gameOverlay: null as HTMLElement | null,
	overlayLevelName: null as HTMLElement | null,
	viewportArea: null as HTMLElement | null,
	hintBox: null as HTMLElement | null,
	nonLegalGlitchName: null as HTMLElement | null,
	setupPage(pager: Pager, page: HTMLElement): void {
		playerPageBase.setupPage.call(this, pager, page)
		setupKeyListener()
		this.basePage = page
		this.overlayButtons = {
			restart: page.querySelector("#restartButton")!,
			nonLegalRestart: page.querySelector("#nonLegalRestartButton")!,
			explodeJupiter: page.querySelector("#explodeJupiterButton")!,
			nextLevel: page.querySelector("#nextLevelButton")!,
			scores: page.querySelector("#scoresButton")!,
			unpause: page.querySelector("#unpauseButton")!,
			gzLeveList: page.querySelector("#gzLevelListButton")!,
			gzSetSelector: page.querySelector("#gzSetSelectorButton")!,
		}

		if (
			!this.overlayButtons.scores ||
			!this.overlayButtons.explodeJupiter ||
			!this.overlayButtons.restart ||
			!this.overlayButtons.nonLegalRestart ||
			!this.overlayButtons.nextLevel ||
			!this.overlayButtons.unpause ||
			!this.overlayButtons.gzLeveList ||
			!this.overlayButtons.gzSetSelector
		)
			throw new Error("Could not find the completion button elements.")
		this.overlayButtons.nextLevel.addEventListener("click", () => {
			this.openNextLevel(pager)
		})
		this.overlayButtons.restart.addEventListener("click", async () => {
			pager.resetLevel()
		})
		this.overlayButtons.nonLegalRestart.addEventListener("click", async () => {
			pager.resetLevel()
		})
		this.overlayButtons.unpause.addEventListener("click", async () => {
			this.togglePaused()
		})
		this.gameOverlay = page.querySelector<HTMLElement>("#levelViewportOverlay")!
		this.overlayLevelName = page.querySelector<HTMLElement>("#overlayLevelName")
		this.hintBox = page.querySelector<HTMLElement>("#hintBox")
		this.nonLegalGlitchName = page.querySelector<HTMLElement>(
			"#nonLegalGlitchName"
		)
		this.submitAttempt = this.submitAttemptUnbound.bind(this, pager)
		this.sfxManager = new AudioSfxManager()
		// TODO Pre-fetch sfx and sfx customization
		this.sfxManager.fetchDefaultSounds("./defoSfx")
	},
	// Setting up level state and the game state machine
	//    Load ->
	// -> Preplay ->
	// -> Play .. (one of:)
	// -> Pause -> Play
	// -> Win -> Load or Preplay
	// -> Lose -> Preplay
	gameState: GameState.PLAYING,
	isPaused: false,
	isPreplay: false,
	isGz: false,
	isNonLegal: false,
	preplayKeyListener: null as KeyListener | null,
	sfxManager: null as AudioSfxManager | null,
	loadLevel(pager: Pager): void {
		playerPageBase.loadLevel.call(this, pager)
		this.basePage!.classList.remove("solutionPlayback")
		if (pager.loadedSet?.inPostGame) return
		if (this.renderer === null || this.currentLevel === null)
			throw new Error(
				"Looks like the base player page didn't set the level correctly."
			)

		this.currentLevel.sfxManager = this.sfxManager
		this.sfxManager?.stopAllSfx()
		this.gameState = GameState.PLAYING
		this.isPaused = false
		this.isGz = false
		this.isPreplay = true
		this.isNonLegal = false
		this.updateOverlayState()
		this.preplayKeyListener?.remove()
		this.preplayKeyListener = new KeyListener((ev: KeyboardEvent) => {
			if (isValidStartKey(ev.code)) {
				ev.preventDefault()
				ev.stopPropagation()
				this.endPreplay()
			}
		})
		if (this.overlayLevelName) {
			const levelN = pager.getLevelNumber()
			this.overlayLevelName.textContent = `${
				levelN !== "not in set" ? `#${levelN}: ` : ""
			}${pager.loadedLevel!.name ?? "Unnamed level"}`
		}
		this.attemptTracker = new AttemptTracker(
			this.currentLevel.blobPrngValue,
			this.currentLevel.randomForceFloorDirection,
			pager.loadedSet?.scriptRunner.state
		)
		this.currentLevel.onGlitch = glitch => {
			if (!this.preventNonLegalGlitches) return
			if (glitch.glitchKind && nonLegalGlitches.includes(glitch.glitchKind)) {
				this.isNonLegal = true
				this.nonLegalGlitchName!.textContent = glitchNames[glitch.glitchKind]
				this.updateOverlayState()
				this.findCurrentMainButton()?.focus()
			}
		}
	},
	updateOverlayState(): void {
		this.gameOverlay!.setAttribute(
			"data-game-state",
			GameState[this.gameState].toLowerCase()
		)
		setAttributeExistence(this.gameOverlay!, "data-paused", this.isPaused)
		setAttributeExistence(this.gameOverlay!, "data-preplay", this.isPreplay)
		setAttributeExistence(this.gameOverlay!, "data-gz", this.isGz)
		setAttributeExistence(this.gameOverlay!, "data-nonlegal", this.isNonLegal)
	},
	endPreplay(): void {
		this.isPreplay = false
		this.updateOverlayState()
		this.preplayKeyListener?.remove()
		this.preplayKeyListener = null
	},
	togglePaused(): void {
		if (
			this.gameState !== GameState.PLAYING ||
			this.isPreplay ||
			this.isGz ||
			this.isNonLegal
		)
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
			if (
				this.preventSimultaneousMovement &&
				val === "switchPlayable" &&
				heldKeys[key]
			) {
				return {
					up: false,
					right: false,
					down: false,
					left: false,
					drop: false,
					rotateInv: false,
					switchPlayable: true,
				}
			}
			keyInputs[val] = !!heldKeys[key]
		}
		return keyInputs as KeyInputs
	},
	updateTextOutputs(): void {
		if (this.gameState !== GameState.PLAYING) return
		playerPageBase.updateTextOutputs.call(this)
		this.hintBox!.textContent = this.currentLevel!.getHint() ?? ""
	},
	updateLogic(): void {
		const level = this.currentLevel
		if (!level) throw new Error("Cannot update the level without a level.")
		if (
			this.gameState === GameState.TIMEOUT ||
			this.isPaused ||
			this.isPreplay ||
			this.isGz ||
			this.isNonLegal
		)
			return
		playerPageBase.updateLogic.call(this)
		this.attemptTracker?.recordAttemptStep(level.gameInput)
		if (
			this.gameState === GameState.PLAYING &&
			level.gameState !== GameState.PLAYING
		) {
			this.startPostPlay(level.gameState)
			this.submitAttempt?.()
		}
	},
	logicTimer: null as TimeoutIntervalTimer | null,
	renderTimer: null as AnimationTimer | null,
	open(pager: Pager): void {
		if (!pager.loadedLevel)
			throw new Error("Cannot open the level player page with a level to play.")
		this.loadLevel(pager)
		this.updateSettings(pager)
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
		this.isNonLegal = false
		this.gameState = GameState.PLAYING
		this.updateOverlayState()
	},
	async loadSolution(pager: Pager, sol: protobuf.ISolutionInfo): Promise<void> {
		this.loadLevel(pager)
		this.attemptTracker = null
		this.currentLevel!.onGlitch = null
		this.currentLevel!.playbackSolution(sol)
		this.basePage!.classList.add("solutionPlayback")
		this.endPreplay()
	},
	extraTileScale: [
		0.25 + // Padding
			// Camera
			0.25 + // Gap
			4 + // Inventory
			0.25, // Padding
		0.25 + // Padding
			// Camera
			0.25, // Padding
	] as [number, number],
}
