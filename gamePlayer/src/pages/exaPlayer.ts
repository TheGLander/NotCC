import { GameState, KeyInputs, LevelState } from "@notcc/logic"
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

const charToKeyInputMap: Record<string, KeyInput | KeyInput[]> = {
	u: "up",
	r: "right",
	d: "down",
	l: "left",
	p: "drop",
	c: "rotateInv",
	s: "switchPlayable",
	"↗": ["up", "right"],
	"↘": ["right", "down"],
	"↙": ["down", "left"],
	"↖": ["left", "up"],
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

function charToKeyInput(char: string): KeyInputs {
	const input = clone(emptyKeys)
	for (const modChar of char) {
		let keyInputs = charToKeyInputMap[modChar]
		if (!Array.isArray(keyInputs)) keyInputs = [keyInputs]
		for (const keyInput of keyInputs) {
			input[keyInput] = true
		}
	}
	return input
}

// Make a snapshot every second
const LEVEL_SNAPSHOT_PERIOD = 60

interface LevelSnapshot {
	level: LevelState
	movePosition: number
}

// TODO move this to @notcc/logic maybe?
function cloneLevel(level: LevelState): LevelState {
	// Don't clone the static level data
	// TODO Maybe don't always have a copy of the whole level map in the level state?
	// What's it doing there, anyways?
	const levelData = level.levelData
	delete level.levelData
	const newLevel = clone(level, true)
	newLevel.levelData = levelData
	level.levelData = levelData
	return newLevel
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
		this.recordedMoves = []
		this.visualMoves = []
		this.areMovesPlayerInput = []
		this.movePosition = 0
		while (level.subtick !== 1) {
			level.tick()
		}
		this.updateTextOutputs()
		this.snapshots = [
			{
				level: cloneLevel(this.currentLevel!),
				movePosition: 0,
			},
		]
		this.renderer!.updateTileSize()
		// Tile scale, automatically make things bigger if the page size allows
		this.updateTileScale()
		// External viewport camera size, affected by eg. the legal player overlays
		this.updateViewportCameraSize()
		// Advance the game by two subtics, so that we can input immediately
		this.updateRender()
		this.updateRecordedMovesArea()
	},
	updateRecordedMovesArea(): void {
		this.recordedMovesArea!.textContent = this.visualMoves
			.slice(0, this.movePosition)
			.join("")
	},
	updateTextOutputs(): void {
		playerPageBase.updateTextOutputs.call(this)
		const time = this.currentLevel!.timeLeft
		// Not the same as ceil(time / 60), since at the beginning it should be one higher than the actual time
		// Kidna silly, but I don't make the rules here
		const superTimeWhole = Math.floor(time / 60) + 1
		const superTimeDecimal = Math.floor(((time % 60) / 60) * 100)
		this.textOutputs!.time.textContent = `${superTimeWhole}.${superTimeDecimal
			.toString()
			.padEnd(2, "0")}s`
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
			this.movePosition += 1
			this.autoAddSnapshot()
		} while (
			level.gameState === GameState.PLAYING &&
			level.selectedPlayable!.cooldown > 0
		)
		this.updateRender()
		const recordedInput = [
			couldMoveFirstTick
				? keyInputToChar(input, false)
				: keyInputToChar(input, false, true) + "-",
			..."-".repeat(ticksApplied - 1),
		]
		if (couldMoveFirstTick && ticksApplied === 4) {
			this.visualMoves.push(keyInputToChar(input, true), "", "", "")
		} else {
			this.visualMoves.push(...recordedInput)
		}
		this.recordedMoves.push(...recordedInput)
		this.areMovesPlayerInput.push(
			true,
			...new Array<boolean>(ticksApplied - 1).fill(false)
		)

		this.updateRecordedMovesArea()
		this.updateTextOutputs()
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
			this.movePosition += 1
			this.autoAddSnapshot()
		}
		const recordedInput = "-".repeat(ticksApplied)
		this.visualMoves.push(...recordedInput)
		this.recordedMoves.push(...recordedInput)
		this.areMovesPlayerInput.push(
			...new Array<boolean>(ticksApplied).fill(false)
		)
		this.updateRender()
		this.updateRecordedMovesArea()
		this.updateTextOutputs()
	},
	snapshots: [] as LevelSnapshot[],
	autoAddSnapshot(): void {
		// return
		if (this.currentLevel === null) throw new Error("Current level must be set")
		const currentTime =
			this.currentLevel!.currentTick * 3 + this.currentLevel!.subtick
		const lastSnapshot = this.snapshots[this.snapshots.length - 1]
		const lastSnapshotTime =
			lastSnapshot.level.currentTick * 3 + lastSnapshot.level.subtick

		if (currentTime - lastSnapshotTime < LEVEL_SNAPSHOT_PERIOD) return
		this.snapshots.push({
			level: cloneLevel(this.currentLevel),
			movePosition: this.movePosition,
		})
	},
	undo(): void {
		if (this.movePosition <= 0) return
		this.movePosition = this.areMovesPlayerInput.lastIndexOf(true)
		// There will always be the snapshot of the initial level, so don't worry about the non-null assertion
		const closestSnapshot = [...this.snapshots]
			.reverse()
			.find(snap => snap.movePosition <= this.movePosition)!
		this.currentLevel = cloneLevel(closestSnapshot.level)
		this.renderer!.level = this.currentLevel
		let actualPosition = closestSnapshot.movePosition
		while (this.movePosition > actualPosition) {
			this.currentLevel.gameInput = charToKeyInput(
				this.recordedMoves[actualPosition]
			)
			this.currentLevel.tick()
			this.currentLevel.tick()
			this.currentLevel.tick()
			actualPosition += 1
		}
		this.movePosition = actualPosition
		// TODO Don't actually do this, preserve the moves in case the player will unrewind
		this.recordedMoves = this.recordedMoves.slice(0, this.movePosition)
		this.visualMoves = this.visualMoves.slice(0, this.movePosition)
		this.areMovesPlayerInput = this.areMovesPlayerInput.slice(
			0,
			this.movePosition
		)
		this.snapshots = this.snapshots.filter(
			snap => snap.movePosition <= this.movePosition
		)
		this.updateRecordedMovesArea()
		this.updateRender()
		this.updateTextOutputs()
	},
	// TODO Use a single struct instead Python-esqe billion arrays?
	recordedMoves: [] as string[],
	visualMoves: [] as string[],
	areMovesPlayerInput: [] as boolean[],
	movePosition: 0,
	currentInput: clone(emptyKeys),
	keyListener: null as KeyListener | null,
	setupKeyListener(): void {
		this.keyListener = new KeyListener(ev => {
			if (!isValidStartKey(ev.code)) return
			if (this.currentLevel?.gameState !== GameState.PLAYING) return
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
