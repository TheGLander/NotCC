import {
	actorDB,
	createLevelFromData,
	GameState,
	Item,
	KeyInputs,
	Layer,
	LevelState,
} from "@notcc/logic"
import { Pager } from "../pager"
import { Renderer } from "../renderer"
import { protobuf } from "@notcc/logic"

// TODO Smart TV inputs
// TODO Customizable inputs in general
export const keyToInputMap: Record<string, keyof KeyInputs> = {
	ArrowUp: "up",
	ArrowRight: "right",
	ArrowDown: "down",
	ArrowLeft: "left",
	KeyZ: "drop",
	KeyX: "rotateInv",
	KeyC: "switchPlayable",
}

export function isValidKey(code: string): boolean {
	return code in keyToInputMap
}

export function isValidStartKey(code: string): boolean {
	return isValidKey(code) || code === "Space"
}

export interface TextOutputs {
	chips: HTMLElement
	time: HTMLElement
	bonusPoints: HTMLElement
}

const KnownGlitches = protobuf.GlitchInfo.KnownGlitches
export const glitchNames: Record<protobuf.GlitchInfo.KnownGlitches, string> = {
	[KnownGlitches.INVALID]: "???",
	[KnownGlitches.DESPAWN]: "Despawn",
	[KnownGlitches.SIMULTANEOUS_CHARACTER_MOVEMENT]:
		"Simultaneous character movement",
	[KnownGlitches.DYNAMITE_EXPLOSION_SNEAKING]: "Dynamite explosion sneaking",
}

export const nonLegalGlitches: protobuf.GlitchInfo.KnownGlitches[] = [
	KnownGlitches.SIMULTANEOUS_CHARACTER_MOVEMENT,
	KnownGlitches.DYNAMITE_EXPLOSION_SNEAKING,
]

export const playerPageBase = {
	requiresLoaded: "level" as const,
	basePage: null as HTMLElement | null,
	textOutputs: null as TextOutputs | null,
	renderer: null as Renderer | null,
	viewportArea: null as HTMLElement | null,
	setupPage(pager: Pager, page: HTMLElement): void {
		if (pager.tileset === null) throw new Error("Tileset required")
		this.basePage = page
		const viewportCanvas =
			page.querySelector<HTMLCanvasElement>(".viewportCanvas")!
		const inventoryCanvas =
			page.querySelector<HTMLCanvasElement>(".inventoryCanvas")!
		this.renderer = new Renderer(pager.tileset, viewportCanvas, inventoryCanvas)
		this.textOutputs = {
			chips: page.querySelector(".chipsText")!,
			time: page.querySelector(".timeLeftText")!,
			bonusPoints: page.querySelector(".bonusPointsText")!,
		}
		if (
			!this.textOutputs.chips ||
			!this.textOutputs.time ||
			!this.textOutputs.bonusPoints
		)
			throw new Error("Could not find the text output elements.")
		this.viewportArea = page.querySelector<HTMLElement>(".viewportArea")
		window.addEventListener("resize", () => {
			this.updateTileScale()
		})
	},
	currentLevel: null as LevelState | null,
	loadLevel(pager: Pager): void {
		pager.updatePageUrl()
		const level = pager.loadedLevel
		if (!level) throw new Error("No level to load")
		if (!this.renderer) throw new Error("No renderer set")

		this.currentLevel = createLevelFromData(level)
		this.currentLevel.randomForceFloorDirection = pager.startingRffDirection
		this.initScriptLevelState(pager)
		this.renderer.level = this.currentLevel
		this.renderer.cameraSize = this.currentLevel.cameraType
		// Internal viewport size (unaffected by scale, but depends on the camera size)
		this.renderer.updateTileSize()
		// Tile scale, automatically make things bigger if the page size allows
		this.updateTileScale()
		// External viewport camera size, affected by eg. the legal player overlays
		this.updateViewportCameraSize()
		this.updateTextOutputs()
	},
	initScriptLevelState(pager: Pager) {
		const state = pager.loadedSet?.scriptRunner.getMapInitState()
		const level = this.currentLevel
		if (!state || !level) return
		if (state.timeLeft !== undefined) {
			level.timeLeft = state.timeLeft * 60
		}
		let player = level.selectedPlayable
		if (state.playableEnterN !== undefined) {
			player = level.playables[state.playableEnterN]
			for (const removedPlayer of level.playables) {
				if (removedPlayer !== player) {
					removedPlayer.destroy(null, null)
				}
			}
			player.respawn()
			level.gameState = GameState.PLAYING
		}
		function giveItem(id: string) {
			if (!player) return
			const tile = level!.field[0][0]
			const ogItem = tile[Layer.ITEM]
			ogItem?.despawn()
			const item = new actorDB[id](level!, [0, 0]) as Item
			item.pickup(player)
			ogItem?.respawn()
		}
		if (!player) return
		for (const [color, n] of Object.entries(state.inventoryKeys ?? {})) {
			const id = `key${color[0].toUpperCase()}${color.substring(1)}`
			giveItem(id)
			const ent = player.inventory.keys[id]
			ent.amount = n
		}
		for (const id of state.inventoryTools ?? []) {
			giveItem(id!)
		}
	},
	extraTileScale: [0, 0] as [number, number],
	determineTileScale(): number {
		if (!this.renderer || !this.renderer.cameraSize)
			throw new Error("Can't determine the tile scale without the renderer.")

		const bodySize = document.body.getBoundingClientRect()
		let availableWidth = bodySize.width,
			// eslint-disable-next-line prefer-const
			availableHeight = bodySize.height

		const tileSize = this.renderer.tileset.tileSize

		const sidebarWidth = document
			.querySelector(".sidebar")!
			.getBoundingClientRect().width

		availableWidth -= sidebarWidth

		const playerTWidth =
				this.renderer.cameraSize.width + this.extraTileScale[0],
			playerTHeight = this.renderer.cameraSize.height + this.extraTileScale[1]
		const playerBaseWidth = playerTWidth * tileSize,
			playerBaseHeight = playerTHeight * tileSize

		let scale = Math.min(
			availableWidth / playerBaseWidth,
			availableHeight / playerBaseHeight
		)
		scale *= 0.95
		if (scale < 0.25) {
			// If we can't fit the camera at *quarter scale*, just do whatever fits
		} else if (scale < 1) {
			// Snap to nearest quarter if we can't fit the camera
			scale = scale - (scale % 0.25)
		} else {
			scale = Math.floor(scale)
		}
		return scale
	},
	updateTileScale(): void {
		const page = this.basePage
		page!.style.setProperty(
			"--tile-scale",
			this.determineTileScale().toString()
		)
		this.isRenderDirty = true
		this.updateRender()
	},
	updateViewportCameraSize(): void {
		if (!this.viewportArea) throw new Error("Viewport missing")
		if (!this.currentLevel) throw new Error("Current level missing")
		this.viewportArea.style.setProperty(
			"--level-camera-width",
			this.renderer!.cameraSize!.width.toString()
		)
		this.viewportArea.style.setProperty(
			"--level-camera-height",
			this.renderer!.cameraSize!.height.toString()
		)
	},
	updateTextOutputs(): void {
		if (!this.textOutputs) return
		this.textOutputs.chips.textContent = this.currentLevel!.chipsLeft.toString()
		this.textOutputs.bonusPoints.textContent =
			this.currentLevel!.bonusPoints.toString()
		const currentTime = this.currentLevel!.timeLeft
		this.textOutputs.time.textContent = `${
			this.currentLevel!.timeFrozen ? "❄" : ""
		}${Math.ceil(currentTime / 60)}s`
	},
	getInput(): KeyInputs {
		throw new Error("Sorry for the antipattern, but please implement this!")
	},
	updateLogic(): void {
		const level = this.currentLevel
		if (level === null)
			throw new Error("Can't update the level without a level.")
		level.gameInput = this.getInput()
		level.tick()
		this.updateTextOutputs()
	},
	isRenderDirty: false,
	updateRender(): void {
		if (!this.isRenderDirty) return
		this.isRenderDirty = false
		this.renderer!.frame()
	},
	preventNonLegalGlitches: true,
	preventSimultaneousMovement: true,
	updateSettings(pager: Pager): void {
		if (!pager.tileset)
			throw new Error("Can't update the tileset without a tileset.")
		if (!this.renderer)
			throw new Error("Can't update the tileset without a renderer.")
		const page = this.basePage
		if (!page)
			throw new Error("Can't update the tileset wihout being opened first.")

		this.renderer.tileset = pager.tileset
		this.renderer.updateTileSize()
		page.style.setProperty(
			"--base-tile-size",
			`${pager.tileset.tileSize.toString()}px`
		)
		this.updateTileScale()
		this.preventNonLegalGlitches = pager.settings.preventNonLegalGlitches
		this.preventSimultaneousMovement =
			pager.settings.preventSimultaneousMovement
	},
}
