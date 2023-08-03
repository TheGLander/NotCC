import { Direction, GameState, KeyInputs, LevelState } from "@notcc/logic"
import clone from "clone"
import { Pager } from "../pager"
import { showLoadPrompt, showSavePrompt } from "../saveData"
import { KeyListener, sleep, TimeoutTimer } from "../utils"
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

function areKeyInputsMoving(input: KeyInputs): boolean {
	return input.up || input.right || input.down || input.left
}

function keyInputToChar(
	input: KeyInputs,
	uppercase: boolean,
	composeOnly = false
): string {
	let char = ""
	for (const keyInput of composingInputs) {
		if (input[keyInput]) {
			char += keyInputToCharMap[keyInput]
		}
	}
	if (composeOnly) return char
	if (input.up && input.right) char += uppercase ? "⇗" : "↗"
	else if (input.right && input.down) char += uppercase ? "⇘" : "↘"
	else if (input.down && input.left) char += uppercase ? "⇙" : "↙"
	else if (input.left && input.up) char += uppercase ? "⇖" : "↖"
	else if (input.up) char += uppercase ? "U" : "u"
	else if (input.right) char += uppercase ? "R" : "r"
	else if (input.down) char += uppercase ? "D" : "d"
	else if (input.left) char += uppercase ? "L" : "l"
	else char += "-"
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

function splitCharString(charString: string): string[] {
	return charString.split(/(?<![pcs])/)
}

// Wait for a tick for diagonal inputs
const AUTO_DIAGONALS_TIMEOUT = 1 / 20

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

interface RouteFor {
	Set?: string
	LevelName?: string
	LevelNumber?: number
}

interface Route {
	Moves: string
	Rule: string
	Encode?: "UTF-8"
	"Initial Slide"?: Direction
	/**
	 * Not the same as "Seed", as Blobmod only affects blobs and nothing else, unlilke the seed in TW, which affects all randomness
	 */
	Blobmod?: number
	// Unused in CC2
	Step?: never
	Seed?: never
	// NotCC-invented metadata
	For?: RouteFor
	ExportApp?: string
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
	applyInput(input: KeyInputs): void {
		const level = this.currentLevel!
		level.gameInput = input
		do {
			level.tick()
			level.gameInput = emptyKeys
			level.tick()
			level.tick()
			this.movePosition += 1
			this.autoAddSnapshot()
		} while (
			level.gameState === GameState.PLAYING &&
			level.selectedPlayable!.cooldown > 0
		)
	},
	// An alternative version of `updateLogic` which operates on ticks instead of subticks
	// We don't use the native `updateLogic`.
	appendInput(input: KeyInputs): void {
		const level = this.currentLevel!
		level.gameInput = input
		const couldMoveFirstTick = level.selectedPlayable!.getCanMove()
		this.cropToMovePosition()
		let ticksApplied = 0
		do {
			level.tick()
			level.gameInput = emptyKeys
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
		if (couldMoveFirstTick && areKeyInputsMoving(input) && ticksApplied === 4) {
			this.visualMoves.push(keyInputToChar(input, true), "", "", "")
		} else {
			this.visualMoves.push(...recordedInput)
		}
		this.recordedMoves.push(...recordedInput)
		this.areMovesPlayerInput.push(
			true,
			...new Array<boolean>(ticksApplied - 1).fill(false)
		)
	},
	// Automatically skip in time until *something* can be done
	autoSkip(): void {
		const level = this.currentLevel!
		while (
			level.gameState === GameState.PLAYING &&
			!level.selectedPlayable!.canDoAnything()
		) {
			this.appendInput(emptyKeys)
		}
		this.updateRecordedMovesArea()
		this.updateTextOutputs()
		this.updateRender()
	},
	snapshots: [] as LevelSnapshot[],
	autoAddSnapshot(): void {
		const level = this.currentLevel
		if (level === null) throw new Error("Current level must be set")
		const currentTime = level!.currentTick * 3 + level!.subtick
		const lastSnapshot = this.snapshots[this.snapshots.length - 1]
		const lastSnapshotTime =
			lastSnapshot.level.currentTick * 3 + lastSnapshot.level.subtick

		if (currentTime - lastSnapshotTime < LEVEL_SNAPSHOT_PERIOD) return
		this.snapshots.push({
			level: cloneLevel(level),
			movePosition: this.movePosition,
		})
	},
	seekTo(newPosition: number, snapToMove = true): void {
		if (snapToMove) {
			this.movePosition = this.areMovesPlayerInput.lastIndexOf(
				true,
				newPosition
			)
		} else {
			this.movePosition = newPosition
		}
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
			this.currentLevel.gameInput = emptyKeys
			this.currentLevel.tick()
			this.currentLevel.tick()
			actualPosition += 1
		}
		this.movePosition = actualPosition
		this.updateRecordedMovesArea()
		this.updateRender()
		this.updateTextOutputs()
	},
	undo(): void {
		if (this.movePosition <= 0) return
		this.seekTo(this.movePosition - 1)
	},
	redo(): void {
		if (this.movePosition >= this.recordedMoves.length) return
		const level = this.currentLevel
		if (level === null) throw new Error("Current level required")
		this.applyInput(charToKeyInput(this.recordedMoves[this.movePosition]))
		this.updateRecordedMovesArea()
		this.updateTextOutputs()
		this.updateRender()
	},
	// TODO Use a single struct instead Python-esqe billion arrays?
	recordedMoves: [] as string[],
	visualMoves: [] as string[],
	areMovesPlayerInput: [] as boolean[],
	cropToMovePosition(): void {
		this.recordedMoves = this.recordedMoves.slice(0, this.movePosition)
		this.visualMoves = this.visualMoves.slice(0, this.movePosition)
		this.areMovesPlayerInput = this.areMovesPlayerInput.slice(
			0,
			this.movePosition
		)
		this.snapshots = this.snapshots.filter(
			snap => snap.movePosition <= this.movePosition
		)
	},
	async importRoute(pager: Pager): Promise<void> {
		const file = (
			await showLoadPrompt("Import route", {
				filters: [{ extensions: ["json", "route"], name: "Route file" }],
			})
		)[0]
		const routeData = await file.text()
		const route: Route = JSON.parse(routeData)
		if (route.Rule === undefined) {
			alert("This doesn't seem like a route file")
			return
		}
		if (route.Rule === "LYNX" || route.Rule === "MS") {
			alert(
				"Warning: Adapting a Lynx or MS route to Steam. Best effort, so don't expect it to work..."
			)
		} else if (route.Rule !== "STEAM") {
			alert("Unknown ruleset")
			return
		}
		this.loadLevel(pager)
		// TODO compare route.For metadata
		const level = this.currentLevel!
		level.blobPrngValue = route.Blobmod ?? 0x55
		level.randomForceFloorDirection = route["Initial Slide"] ?? Direction.UP
		const moves = splitCharString(route.Moves)
		let moveCount = 0
		while (moves.length > this.movePosition) {
			this.appendInput(charToKeyInput(moves[this.movePosition]))
			if (level.gameState !== GameState.PLAYING) break
			moveCount += 1
			if (moveCount % 100 === 0) {
				this.updateRecordedMovesArea()
				this.updateRender()
				this.updateTextOutputs()
				// Have a breather every 100 moves
				await sleep(0)
			}
		}
		this.updateRecordedMovesArea()
		this.updateRender()
		this.updateTextOutputs()
	},
	async exportRoute(pager: Pager): Promise<void> {
		const level = this.snapshots[0].level
		const levelN = pager.getLevelNumber()
		const levelTitle = pager.loadedLevel!.name
		if (levelN === "not in level") throw new Error("Can't be happening")
		const route: Route = {
			Rule: "STEAM",
			Encode: "UTF-8",
			Moves: this.recordedMoves.join(""),
			ExportApp: "ExaCC",
			For:
				levelN === "not in set"
					? { LevelName: levelTitle }
					: {
							LevelName: levelTitle,
							LevelNumber: levelN,
							Set: pager.loadedSet!.scriptRunner.state.scriptTitle!,
					  },
			Blobmod: level.blobPrngValue,
			"Initial Slide": this.snapshots[0].level.randomForceFloorDirection,
		}
		const routeString = JSON.stringify(route)
		const routeBin = new TextEncoder().encode(routeString)
		await showSavePrompt(routeBin, "Save route", {
			filters: [{ extensions: ["route"], name: "Route file" }],
			defaultPath: `./${levelTitle}.route`,
		})
	},
	movePosition: 0,
	currentInput: clone(emptyKeys),
	keyListener: null as KeyListener | null,
	autoDiagonalsTimer: null as TimeoutTimer | null,
	updateCompositingPreview(): void {
		this.composingPreviewArea!.textContent = keyInputToChar(
			this.currentInput,
			false,
			true
		)
	},
	commitCurrentInput(): void {
		this.autoDiagonalsTimer = null
		this.appendInput(this.currentInput)
		this.updateRecordedMovesArea()
		this.updateRender()
		this.updateTextOutputs()
		this.currentInput = clone(emptyKeys)
		this.updateCompositingPreview()
	},
	setupKeyListener(): void {
		this.keyListener = new KeyListener(ev => {
			if (!isValidStartKey(ev.code)) return
			if (this.currentLevel?.gameState !== GameState.PLAYING) return
			let inputType = keyToInputMap[ev.code]
			if (inputType in this.currentInput) {
				inputType = inputType as keyof KeyInputs
				// Holding a cardinal direction should always move in that direction, so thus we shouldn't be able
				// to flip if that input is actually gonna be a part of the keyinputs.
				if (
					inputType === "up" ||
					inputType === "right" ||
					inputType === "down" ||
					inputType === "left"
				) {
					this.currentInput[inputType] = true
				} else {
					this.currentInput[inputType] = !this.currentInput[inputType]
				}
			}
			if (
				!composingInputs.includes(inputType) &&
				this.autoDiagonalsTimer === null
			) {
				this.autoDiagonalsTimer = new TimeoutTimer(
					() => this.commitCurrentInput(),
					AUTO_DIAGONALS_TIMEOUT
				)
			}
			this.updateCompositingPreview()
		})
	},
	open(pager: Pager): void {
		if (!pager.loadedLevel)
			throw new Error("Cannot open the level player page with a level to play.")
		this.loadLevel(pager)
		this.updateSettings(pager)
		this.updateRender()
		this.setupKeyListener()
	},
	close(): void {
		this.keyListener?.remove()
		this.keyListener = null
		this.autoDiagonalsTimer?.cancel()
		this.autoDiagonalsTimer = null
	},
	extraTileScale: [
		0.5 + // Padding
			// Camera
			0.5 + // Padding
			0.25 + // Gap
			16, // Stats
		0.5 + // Padding
			// Camera
			0.5, // Padding
	] as [number, number],
}
