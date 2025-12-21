import {
	Direction,
	LevelModifiers,
	Route,
	RouteDirection,
	RouteFor,
	applyLevelModifiers,
	splitRouteCharString,
} from "@notcc/logic"
import { GraphModel, SerializedGraph } from "./models/graph"
import { exists } from "@/fs"
import { join } from "path"
import { LinearModel } from "./models/linear"
import { LevelData } from "@/levelData"
import { DEFAULT_HASH_SETTINGS, ExaNewEvent } from "./OpenExaPrompt"

export type Model = LinearModel | GraphModel

export interface ExaProj {
	For?: RouteFor
	ExportApp?: string
	Blobmod?: number
	"Initial Slide"?: RouteDirection
	Model: { Type: "graph"; Contents: SerializedGraph }
}

export type AnyProjectSave = Route | ExaProj

export interface RouteLocation {
	setIdent: string
	setName: string
	levelN: number
	path?: string
}

export function makeModelSave(
	model: Model,
	modifiers: LevelModifiers,
	location?: RouteLocation
): AnyProjectSave {
	let fileContents: AnyProjectSave
	let levelName: string | null
	if (model instanceof LinearModel) {
		const initLevel = model.moveSeq.findSnapshot(0)!.level
		levelName = initLevel.metadata.title
		fileContents = {
			Moves: model.moveSeq.moves.join(""),
			Rule: "Steam",
		}
	} else {
		levelName = model.rootNode.level.metadata.title
		fileContents = { Model: { Type: "graph", Contents: model.serialize() } }
	}

	fileContents.Blobmod = modifiers.blobMod
	fileContents["Initial Slide"] =
		modifiers.randomForceFloorDirection === undefined
			? undefined
			: (Direction[modifiers.randomForceFloorDirection] as RouteDirection)

	fileContents.For = {
		LevelName: levelName ?? undefined,
	}
	if (location) {
		fileContents.For.Set = location.setName
		fileContents.For.LevelNumber = location.levelN
	}
	fileContents.ExportApp = `ExaCC v2.0`

	return fileContents
}

export async function findModelSavePath(
	levelName: string,
	isRoute: boolean,
	location: RouteLocation
): Promise<string> {
	let filePath: string
	if (location.path) {
		filePath = location.path
	} else {
		let fileQualifier = 0
		do {
			filePath = join(
				"/routes",
				location.setIdent,
				`${location.levelN} - ${levelName}${fileQualifier !== 0 ? ` ${fileQualifier}` : ""}.${isRoute ? "route" : "exaproj"}`
			)
			fileQualifier += 1
		} while (await exists(filePath))
	}
	return filePath
}

export function levelModifiersFromSave(save: AnyProjectSave): LevelModifiers {
	return {
		randomForceFloorDirection:
			save["Initial Slide"] && Direction[save["Initial Slide"]],
		blobMod: save["Blobmod"],
	}
}

export function modelFromSave(
	levelData: LevelData,
	save: AnyProjectSave
): { model: Model; modifiers: LevelModifiers; config: ExaNewEvent } {
	const level = levelData.initLevel()
	const modifiers = levelModifiersFromSave(save)
	applyLevelModifiers(level, modifiers)
	level.tick()
	level.tick()

	let model: Model
	let config: ExaNewEvent

	if ("Moves" in save) {
		model = new LinearModel(level)
		model.loadMoves(splitRouteCharString(save.Moves))
		config = { type: "new", model: "linear" }
	} else if (save.Model.Type === "graph") {
		model = new GraphModel(level, save.Model.Contents.hashSettings)
		model.loadSerialized(save.Model.Contents)
		config = {
			type: "new",
			model: "graph",
			hashSettings: save.Model.Contents.hashSettings,
		}
	} else {
		throw new Error("Unrecognized routefile type!")
	}

	return { model, modifiers, config }
}

export function makeModel(
	levelData: LevelData,
	conf: ExaNewEvent,
	modifiers: LevelModifiers
): Model {
	const level = levelData.initLevel()
	if (modifiers) {
		applyLevelModifiers(level, modifiers)
	}
	level.tick()
	level.tick()

	let model: Model
	if (conf.model === "linear") {
		model = new LinearModel(level)
	} else if (conf.model === "graph") {
		model = new GraphModel(level, conf.hashSettings ?? DEFAULT_HASH_SETTINGS)
	} else {
		throw new Error("Unsupported model :(")
	}
	return model
}
