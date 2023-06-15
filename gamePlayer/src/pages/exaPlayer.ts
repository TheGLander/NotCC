import { GameState, KeyInputs } from "@notcc/logic"
import clone from "clone"
import { Pager } from "../pager"
import { KeyListener } from "../utils"
import { isValidStartKey, keyToInputMap, playerPageBase } from "./basePlayer"

export type KeyInput = keyof KeyInputs

const emptyKeys: KeyInputs = {
	up: false,
	right: false,
	down: false,
	left: false,
	drop: false,
	rotateInv: false,
	switchPlayable: false,
}

// Input types which don't cause a new tick by their own
const composingInputs: KeyInput[] = ["drop", "rotateInv", "switchPlayable"]

const keyInputToCharMap: Record<KeyInput, string> = {
	up: "u",
	right: "r",
	down: "d",
	left: "l",
	switchPlayable: "s",
	rotateInv: "c",
	drop: "p",
}

function keyInputToChar(
	input: KeyInputs,
	fullMove: boolean,
	composeOnly = false
): string {
	let char = ""
	for (const keyInput of composingInputs) {
		if (input[keyInput]) {
			char += keyInputToCharMap[keyInput]
		}
	}
	if (composeOnly) return char
	if (input.up && input.right) char += fullMove ? "⇗" : "↗"
	else if (input.right && input.down) char += fullMove ? "⇘" : "↘"
	else if (input.down && input.left) char += fullMove ? "⇙" : "↙"
	else if (input.left && input.right) char += fullMove ? "⇖" : "↖"
	else if (input.up) char += fullMove ? "U" : "u"
	else if (input.right) char += fullMove ? "R" : "r"
	else if (input.down) char += fullMove ? "D" : "d"
	else if (input.left) char += fullMove ? "L" : "l"
	else char += fullMove ? "----" : "-"
	return char
}

export const exaPlayerPage = {
	...playerPageBase,
	pageId: "exaPlayerPage",
	recordedMovesArea: null as HTMLSpanElement | null,
	composingPreviewArea: null as HTMLSpanElement | null,
	setupPage(pager: Pager, page: HTMLElement): void {
		playerPageBase.setupPage.call(this, pager, page)
		this.recordedMovesArea =
			page.querySelector<HTMLSpanElement>(".recordedMoves")
		this.composingPreviewArea =
			page.querySelector<HTMLSpanElement>(".composingPreview")
	},
	loadLevel(pager: Pager): void {
		playerPageBase.loadLevel.call(this, pager)
		const level = this.currentLevel
		if (level === null)
			throw new Error("The player page base didn't set the level correctly")
		this.renderer!.cameraSize = {
			width: Math.min(level.width, 32),
			height: Math.min(level.height, 32),
			screens: 1,
		}
		this.recordedMoves = ""
		this.movePosition = 0
		while (level.subtick !== 1) {
			level.tick()
		}
		this.renderer!.updateTileSize()
		// Tile scale, automatically make things bigger if the page size allows
		this.updateTileScale()
		// External viewport camera size, affected by eg. the legal player overlays
		this.updateViewportCameraSize()
		// Advance the game by two subtics, so that we can input immediately
		this.updateRender()
		this.recordedMovesArea!.textContent = ""
	},
	// An alternative version of `updateLogic` which operates on ticks instead of subticks
	// We don't use the native `updateLogic`.
	applyInput(input: KeyInputs): void {
		const level = this.currentLevel!
		level.gameInput = input
		const couldMoveFirstTick = level.selectedPlayable!.getCanMove()
		let ticksApplied = 0
		do {
			level.tick()
			level.tick()
			level.tick()
			ticksApplied += 1
		} while (
			level.gameState === GameState.PLAYING &&
			level.selectedPlayable!.cooldown > 0
		)
		this.updateRender()
		const recordedInput =
			(couldMoveFirstTick
				? keyInputToChar(input, false)
				: keyInputToChar(input, false, true) + "-") +
			keyInputToChar(emptyKeys, false).repeat(ticksApplied - 1)

		this.recordedMovesArea!.textContent +=
			couldMoveFirstTick && ticksApplied === 4
				? keyInputToChar(input, true)
				: recordedInput
		this.recordedMoves += recordedInput
	},
	// Automatically skip in time until *something* can be done
	autoSkip(): void {
		const level = this.currentLevel!
		let ticksApplied = 0
		while (!level.selectedPlayable!.canDoAnything()) {
			level.tick()
			level.tick()
			level.tick()
			ticksApplied += 1
		}
		const recordedInput = "-".repeat(ticksApplied)
		this.recordedMovesArea!.textContent += recordedInput
		this.recordedMoves += recordedInput
		this.updateRender()
	},
	recordedMoves: "",
	movePosition: 0,
	currentInput: clone(emptyKeys),
	keyListener: null as KeyListener | null,
	setupKeyListener(): void {
		this.keyListener = new KeyListener(ev => {
			if (!isValidStartKey(ev.code)) return
			let inputType = keyToInputMap[ev.code]
			if (inputType in this.currentInput) {
				inputType = inputType as keyof KeyInputs
				this.currentInput[inputType] = !this.currentInput[inputType]
			}
			if (!composingInputs.includes(inputType)) {
				this.applyInput(this.currentInput)
				this.currentInput = clone(emptyKeys)
			}
			this.composingPreviewArea!.textContent = keyInputToChar(
				this.currentInput,
				false,
				true
			)
		})
	},
	open(pager: Pager): void {
		if (!pager.loadedLevel)
			throw new Error("Cannot open the level player page with a level to play.")
		this.loadLevel(pager)
		this.reloadTileset(pager)
		this.updateRender()
		this.setupKeyListener()
	},
	close(): void {
		this.keyListener?.remove()
		this.keyListener = null
	},
}
