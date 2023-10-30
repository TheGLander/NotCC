import {
	calculateLevelPoints,
	GameState,
	InputProvider,
	KeyInputs,
	keyInputToChar,
	LevelState,
	makeEmptyInputs,
	Route,
	RouteFileInputProvider,
	secondaryActions,
	protobuf,
	SolutionInfoInputProvider,
	Direction,
} from "@notcc/logic"
import clone from "clone"
import { Pager } from "../pager"
import { showAlert } from "../simpleDialogs"
import { showLoadPrompt, showSavePrompt } from "../saveData"
import { KeyListener, sleep, TimeoutTimer } from "../utils"
import { isValidStartKey, keyToInputMap, playerPageBase } from "./basePlayer"
import { registerPage } from "../const"
import { getRRRoutes, identifyRRPack } from "../railroad"

// Wait for a tick for diagonal inputs
const AUTO_DIAGONALS_TIMEOUT = 1 / 20

// Make a snapshot every second
const LEVEL_SNAPSHOT_PERIOD = 60

interface LevelSnapshot {
	level: LevelState
}

// TODO move this to @notcc/logic maybe?
function cloneLevel(level: LevelState): LevelState {
	// Don't clone the static level data
	// TODO Maybe don't always have a copy of the whole level map in the level state?
	// What's it doing there, anyways?
	const levelData = level.levelData
	delete level.levelData
	const inputProvider = level.inputProvider
	delete level.inputProvider
	const newLevel = clone(level, true)
	newLevel.levelData = levelData
	newLevel.inputProvider = inputProvider
	level.levelData = levelData
	level.inputProvider = inputProvider
	return newLevel
}

export const exaPlayerPage = {
	...playerPageBase,
	pagePath: "exa",
	pageId: "exaPlayerPage",
	recordedMovesArea: null as HTMLSpanElement | null,
	composingPreviewArea: null as HTMLSpanElement | null,
	levelN: -1,
	setupPage(pager: Pager, page: HTMLElement): void {
		playerPageBase.setupPage.call(this, pager, page)
		this.recordedMovesArea =
			page.querySelector<HTMLSpanElement>(".recordedMoves")
		this.composingPreviewArea =
			page.querySelector<HTMLSpanElement>(".composingPreview")
		this.totalScoreText =
			page.querySelector<HTMLOutputElement>(".totalScoreText")
	},
	loadLevel(pager: Pager, inputProvider?: InputProvider): void {
		playerPageBase.loadLevel.call(this, pager)
		const level = this.currentLevel
		if (level === null)
			throw new Error("The player page base didn't set the level correctly")
		level.forcedPerspective = true
		this.renderer!.cameraSize = {
			width: Math.min(level.width, 32),
			height: Math.min(level.height, 32),
			screens: 1,
		}
		this.recordedMoves = []
		this.visualMoves = []
		this.areMovesPlayerInput = []
		level.inputProvider =
			inputProvider ?? new RouteFileInputProvider(this.recordedMoves)
		while (level.subtick !== 1) {
			level.tick()
		}
		this.updateTextOutputs()
		this.snapshots = [
			{
				level: cloneLevel(this.currentLevel!),
			},
		]
		this.levelN = pager.loadedSet?.currentLevel ?? 0
		this.renderer!.updateTileSize()
		// Tile scale, automatically make things bigger if the page size allows
		this.updateTileScale()
		// External viewport camera size, affected by eg. the legal player overlays
		this.updateViewportCameraSize()
		// Advance the game by two subtics, so that we can input immediately
		this.updateRender()
		this.updateRecordedMovesArea()
		this.updateTextOutputs()
	},
	updateRecordedMovesArea(): void {
		this.recordedMovesArea!.textContent = this.visualMoves
			.slice(0, this.currentLevel!.currentTick)
			.join("")
	},
	totalScoreText: null as HTMLOutputElement | null,
	updateTextOutputs(): void {
		playerPageBase.updateTextOutputs.call(this)
		const time = this.currentLevel!.timeLeft
		// Not the same as ceil(time / 60), since at the beginning it should be one higher than the actual time
		// Kidna silly, but I don't make the rules here
		const superTimeWhole = Math.floor(time / 60) + 1
		const superTimeDecimal = Math.floor(((time % 60) / 60) * 100)
		this.textOutputs!.time.textContent =
			time === 0
				? "0.00s"
				: `${superTimeWhole}.${superTimeDecimal.toString().padStart(2, "0")}s`
		this.totalScoreText!.textContent = calculateLevelPoints(
			this.levelN,
			Math.ceil(time / 60),
			this.currentLevel!.bonusPoints
		).toString()
	},
	applyInput(): void {
		const level = this.currentLevel!
		do {
			level.tick()
			level.tick()
			level.tick()
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
		const couldMoveFirstTick = level.selectedPlayable!.getCanMove()

		this.cropToMovePosition()

		const moves: string[] = []
		const addMove = (char: string) => {
			this.recordedMoves.push(char)
			moves.push(char)
		}

		addMove(
			couldMoveFirstTick
				? keyInputToChar(input, false)
				: keyInputToChar(input, false, true) + "-"
		)
		let ticksApplied = 0

		do {
			if (ticksApplied > 0) {
				addMove("-")
			}
			level.tick()
			level.tick()
			level.tick()
			ticksApplied += 1
			this.autoAddSnapshot()
		} while (
			level.gameState === GameState.PLAYING &&
			level.selectedPlayable!.cooldown > 0
		)
		if (moves.length === 4 && couldMoveFirstTick) {
			this.visualMoves.push(keyInputToChar(input, true), "", "", "")
		} else {
			this.visualMoves.push(...moves)
		}
		this.areMovesPlayerInput.push(
			true,
			...new Array(moves.length - 1).fill(false)
		)
		this.updateRender()
	},
	// Automatically skip in time until *something* can be done
	autoSkip(): void {
		const level = this.currentLevel!
		while (
			level.gameState === GameState.PLAYING &&
			!level.selectedPlayable!.canDoAnything()
		) {
			this.appendInput(makeEmptyInputs())
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
		})
	},
	seekTo(newPosition: number, snapToMove = true): void {
		let targetPosition: number
		if (snapToMove) {
			targetPosition = this.areMovesPlayerInput.lastIndexOf(true, newPosition)
		} else {
			targetPosition = newPosition
		}
		// There will always be the snapshot of the initial level, so don't worry about the non-null assertion
		const closestSnapshot = [...this.snapshots]
			.reverse()
			.find(snap => snap.level.currentTick <= targetPosition)!
		this.currentLevel = cloneLevel(closestSnapshot.level)
		const level = this.currentLevel
		this.renderer!.level = this.currentLevel
		while (targetPosition > level.currentTick) {
			this.currentLevel.tick()
			this.currentLevel.tick()
			this.currentLevel.tick()
		}
		this.updateRecordedMovesArea()
		this.updateRender()
		this.updateTextOutputs()
	},
	undo(): void {
		if (this.currentLevel!.currentTick <= 0) return
		this.seekTo(this.currentLevel!.currentTick - 1)
	},
	redo(): void {
		const level = this.currentLevel
		if (level === null) throw new Error("Current level required")
		if (level.currentTick >= this.recordedMoves.length) return
		this.applyInput()
		this.updateRecordedMovesArea()
		this.updateTextOutputs()
		this.updateRender()
	},
	// TODO Use a single struct instead Python-esqe billion arrays?
	recordedMoves: [] as string[],
	visualMoves: [] as string[],
	areMovesPlayerInput: [] as boolean[],
	cropToMovePosition(): void {
		const movePos = this.currentLevel!.currentTick
		this.recordedMoves.splice(movePos)
		this.visualMoves.splice(movePos)
		this.areMovesPlayerInput.splice(movePos)
		this.snapshots = this.snapshots.filter(
			snap => snap.level.currentTick <= movePos
		)
	},
	async transcribeInputs(ip: InputProvider) {
		const level = this.currentLevel!
		let moveCount = 0
		while (!ip.outOfInput(level)) {
			this.appendInput(ip.getInput(level))
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
	async loadSolution(pager: Pager, sol: protobuf.ISolutionInfo) {
		const ip = new SolutionInfoInputProvider(sol)
		this.loadLevel(pager, ip)
		await this.transcribeInputs(ip)
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
			showAlert("This doesn't seem like a route file")
			return
		}
		if (route.Rule === "LYNX" || route.Rule === "MS") {
			await showAlert(
				"Warning: Adapting a Lynx or MS route to Steam. Best effort, so don't expect it to work..."
			)
		} else if (route.Rule !== "STEAM") {
			showAlert("Unknown ruleset")
			return
		}
		const ip = new RouteFileInputProvider(route)
		this.loadLevel(pager, ip)
		// TODO compare route.For metadata
		await this.transcribeInputs(ip)
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
			// When importing and exporting, convert RFF direction to be a string enum value,
			// to keep compat with SuperCC
			"Initial Slide": Direction[
				this.snapshots[0].level.randomForceFloorDirection
			] as unknown as Direction,
		}
		const routeString = JSON.stringify(route)
		const routeBin = new TextEncoder().encode(routeString)
		await showSavePrompt(routeBin, "Save route", {
			filters: [{ extensions: ["route"], name: "Route file" }],
			defaultPath: `./${levelTitle}.route`,
		})
	},
	currentInput: makeEmptyInputs(),
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
		this.currentInput = makeEmptyInputs()
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
				!secondaryActions.includes(inputType) &&
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
	async setNavigationInfo(
		pager: Pager,
		_subpage: string,
		queryParams: Record<string, string>
	) {
		const solutionId = queryParams["load-solution"]
		if (!solutionId) return
		const setName = pager.loadedSet?.scriptRunner.state.scriptTitle!
		const packName = setName ? identifyRRPack(setName) : null
		const level = pager.loadedLevel!

		let ip: InputProvider | undefined

		if (solutionId === "builtin") {
			ip =
				level.associatedSolution &&
				new SolutionInfoInputProvider(level.associatedSolution)
		} else if (packName !== null && solutionId.startsWith("railroad-")) {
			const railroadId = solutionId.slice("railroad-".length)
			const levels = await getRRRoutes(packName)
			const rrRoute = levels
				.find(lvl => lvl.title.toLowerCase() === level.name?.toLowerCase())
				?.routes.find(route => route.id === railroadId)
			if (rrRoute) {
				ip = new RouteFileInputProvider(rrRoute.moves)
			}
		}

		if (ip) {
			this.loadLevel(pager, ip)
			await this.transcribeInputs(ip)
		}
	},
}

registerPage(exaPlayerPage)
