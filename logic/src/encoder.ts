import { Field, Direction } from "./helpers"

export interface CameraType {
	width: number
	height: number
	screens: number
}

/**
 * Level data which can be used to identify this level
 */
export interface IdentifyingLevelData {
	/**
	 * The filename of this level (or the level set, if a DAT)
	 */
	filename?: string
	/**
	 * The name of the set this belongs to (not present in C2Ms or DATs)
	 */
	setName?: string
	/**
	 * Name of the level, can be absent
	 */
	name?: string
	/**
	 * The password used to access the level. Not supported in vanilla CC2
	 */
	password?: string
}

export interface LevelOutcome {
	/**
	 * The amount of subticks left on the clock. 0 if the level is untimed
	 */
	timeLeft?: number
	/**
	 * The score from bonus flags and such
	 */
	bonusScore?: number
	/**
	 * The total score from a level, including time left * 10, bonus score, and base level score
	 */
	totalScore?: number
}

export interface LevelData extends IdentifyingLevelData {
	/**
	 * The field which contains all actors
	 */
	field: Field<[string, Direction?, string?][]>
	playablesRequiredToExit: number | "all"
	width: number
	height: number
	/**
	 * The viewport width/height
	 */
	camera: CameraType
	timeLimit: number
	/**
	 * The blob pattern setting in CC2, 1 by default
	 */
	blobMode?: 1 | 4 | 256
	hints?: string[]
	/**
	 * If the hint tile didn't get a custom hint, it gets this
	 */
	defaultHint?: string
	note?: string
	/**
	 * The amount of chips to add to the required count beyond the default chip amount.
	 * Is designed to mostly troll people into thinking there are more chips than there really are
	 */
	extraChipsRequired?: number
	/**
	 * The clone machine/trap custom connections. Not supported in vanilla CC2
	 */
	connections?: [[number, number], [number, number]][]
	/**
	 * The solution for this level
	 */
	associatedSolution?: SolutionData
	// Random misc custom data
	customData?: Record<string, string>
}

export type PartialLevelData = Omit<
	LevelData,
	"field" | "width" | "height" | "playablesRequiredToExit"
> &
	Partial<LevelData>

export function isPartialDataFull(
	partial: PartialLevelData
): partial is LevelData {
	return (
		!!partial.field &&
		!!partial.height &&
		!!partial.width &&
		!!partial.playablesRequiredToExit
	)
}

// TODO C2G Scripting
export interface LevelSetData {
	name: string
	// Note that this isn't in array, this can have holes and such
	levels: Record<number, LevelData>
}

export function levelAsSet(level: LevelData): LevelSetData {
	return { name: level.name ?? "UNNAMED", levels: { 1: level } }
}

/**
 * A single input of the solution, the move number is:
 * `up + right * 0x2 + down * 0x4 + left * 0x8 + drop * 0x10 + cycle * 0x20 + switch * 0x40`
 * `holdLength` is the amount of subticks to hold this step for
 */
export type SolutionStep = [moveNumber: number, holdLength: number]

export interface SolutionData {
	/**
	 * The steps needed to reach the exit, for each player
	 */
	steps?: SolutionStep[][]
	blobModSeed?: number
	rffDirection?: Direction
	associatedLevel?: IdentifyingLevelData
	expectedOutcome?: LevelOutcome
	c2gState?: C2GState
}

export type SolutionDataWithSteps = SolutionData & { steps: SolutionStep[][] }

export function hasSteps(sol: SolutionData): sol is SolutionDataWithSteps {
	return !!sol.steps
}

export interface C2GState {
	enter: number
	exit: number
	flags: number
	gender: number
	keys: number
	level: number
	line: number
	menu: number
	reg1: number
	reg2: number
	reg3: number
	reg4: number
	result: number
	speed: number
	tleft: number
	tools: number
}
