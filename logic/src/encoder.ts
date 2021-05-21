import { Field, Direction } from "./helpers"

export interface CameraType {
	width: number
	height: number
	screens: number
}

export interface LevelData {
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
	name?: string
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
	 * The password used to access the level. Not supported in vanilla CC2
	 */
	password?: string
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
 * `waitBeforeInput` is the amount of subticks to wait before doing this step (the last input is sticky, so in the wait the input is not 0!)
 */
export type SolutionStep = [moveNumber: number, waitBeforeInput: number]

export interface SolutionData {
	/**
	 * The steps needed to reach the exit, for each player
	 */
	steps: SolutionStep[][]
	blobModSeed?: number
	rffDirection?: Direction
}
