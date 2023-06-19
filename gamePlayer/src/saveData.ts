import * as lsSave from "./saveData.localStorage"
import * as neuSave from "./saveData.neutralino"
import { isDesktop } from "./utils"

// Decide which save data method to use. Kinda hacky, but what are you gonna do?

export const initSaveData = isDesktop()
	? neuSave.initSaveData
	: lsSave.initSaveData
export const saveSetInfo = isDesktop()
	? neuSave.saveSetInfo
	: lsSave.saveSetInfo
export const loadSetInfo = isDesktop()
	? neuSave.loadSetInfo
	: lsSave.loadSetInfo
export const saveSettings = isDesktop()
	? neuSave.saveSettings
	: lsSave.saveSettings
export const loadSettings = isDesktop()
	? neuSave.loadSettings
	: lsSave.loadSettings
export const saveTileset = isDesktop()
	? neuSave.saveTileset
	: lsSave.saveTileset
export const loadTileset = isDesktop()
	? neuSave.loadTileset
	: lsSave.loadTileset
export const loadAllTilesets = isDesktop()
	? neuSave.loadAllTilesets
	: lsSave.loadAllTilesets
export const removeTileset = isDesktop()
	? neuSave.removeTileset
	: lsSave.removeTileset
export const showLoadPrompt = isDesktop()
	? neuSave.showLoadPrompt
	: lsSave.showLoadPrompt
export const showDirectotyPrompt = isDesktop()
	? neuSave.showDirectoryPrompt
	: lsSave.showDirectoryPrompt
