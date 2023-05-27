import { Direction } from "../helpers.js"

const cc2Tiles = [
	[["voodooTile", 0, "0"]],
	[],
	[["wall"]],
	[["ice"]],
	[["iceCorner", 2]],
	[["iceCorner", 3]],
	[["iceCorner"]],
	[["iceCorner", 1]],
	[["water"]],
	[["fire"]],
	[["forceFloor"]],
	[["forceFloor", 1]],
	[["forceFloor", 2]],
	[["forceFloor", 3]],
	[["toggleWall", 0, "on"]],
	[["toggleWall", 0, "off"]],
	[["teleportRed"]],
	[["teleportBlue"]],
	[["teleportYellow"]],
	[["teleportGreen"]],
	[["exit"]],
	[["slime"]],
	[["chip", null], null],
	[["dirtBlock", null], null],
	[["walker", null], null],
	[["glider", null], null],
	[["iceBlock", null], null],
	[["thinWall", 0, "D"], null],
	[["thinWall", 0, "R"], null],
	[["thinWall", 0, "RD"], null],
	[["gravel"]],
	[["buttonGreen"]],
	[["buttonBlue"]],
	[["tankBlue", null], null],
	[["doorRed"]],
	[["doorBlue"]],
	[["doorYellow"]],
	[["doorGreen"]],
	[["keyRed"], null],
	[["keyBlue"], null],
	[["keyYellow"], null],
	[["keyGreen"], null],
	[["echip"], null],
	[["echipPlus"], null],
	[["echipGate"]],
	[["popupWall"]],
	[["appearingWall"]],
	[["invisibleWall"]],
	[["blueWall", 0, "real"]],
	[["blueWall", 0, "fake"]],
	[["dirt"]],
	[["ant", null], null],
	[["centipede", null], null],
	[["ball", null], null],
	[["blob", null], null],
	[["teethRed", null], null],
	[["fireball", null], null],
	[["buttonRed"]],
	[["buttonBrown"]],
	[["bootIce"], null],
	[["bootForceFloor"], null],
	[["bootFire"], null],
	[["bootWater"], null],
	[["thiefTool"]],
	[["bomb"], null],
	[["trap", 0, "open"]],
	[["trap"]],
	[["cloneMachine", 0, "cc1"]],
	[["cloneMachine"]],
	[["hint"]],
	[["forceFloorRandom"]],
	[["buttonGray"]],
	[["swivel", 2]],
	[["swivel", 3]],
	[["swivel"]],
	[["swivel", 1]],
	[["timeBonus"], null],
	[["timeToggle"], null],
	[["transmogrifier"]],
	[["railroad"]], // Oh no
	[["steelWall"]],
	[["tnt"], null],
	[["helmet"], null],
	[["unknown"]],
	[["unknown"]],
	[["unknown"]],
	[["melinda", null], null],
	[["teethBlue", null], null],
	[["unknown"]],
	[["bootDirt"], null],
	[["noMelindaSign"]],
	[["noChipSign"]],
	[["notGate"]], // Custom stuff
	[["unknown"]],
	[["buttonPurple"]],
	[["flameJet", 0, "off"]],
	[["flameJet", 0, "on"]],
	[["buttonOrange"]],
	[["lightningBolt"], null],
	[["tankYellow", null], null],
	[["complexButtonYellow"]],
	[["mirrorChip", null], null],
	[["mirrorMelinda", null], null],
	[["unknown"]],
	[["bowlingBall"], null],
	[["rover", null], null],
	[["timePenalty"], null],
	[["customFloor", 0, null]],
	[["unknown"]],
	[["thinWall", 0, null], null],
	[["unknown"]],
	[["railroadSign"], null],
	[["customWall", 0, null]],
	[["letterTile", 0, null]],
	[["holdWall", 0, "off"]],
	[["holdWall", 0, "on"]],
	[["unknown"]],
	[["unknown"]],
	[["modifier8", 0, null]],
	[["modifier16", 0, null]],
	[["modifier32", 0, null]],
	[["unknown"]],
	[["bonusFlag", 0, "10"], null],
	[["bonusFlag", 0, "100"], null],
	[["bonusFlag", 0, "1000"], null],
	[["greenWall", 0, "real"]],
	[["greenWall", 0, "fake"]],
	[["noSign"], null],
	[["bonusFlag", 0, "*2"], null],
	[["directionalBlock", null, null], null],
	[["floorMimic", null], null],
	[["greenBomb", 0, "bomb"], null],
	[["greenBomb", 0, "echip"], null],
	[["unknown"]],
	[["unknown"]],
	[["buttonBlack"]],
	[["toggleSwitch", 0, "off"]],
	[["toggleSwitch", 0, "on"]],
	[["thiefKey"]],
	[["ghost", null], null],
	[["foil"], null],
	[["turtle"]],
	[["secretEye"], null],
	[["bribe"], null],
	[["bootSpeed"], null],
	[["unknown"]],
	[["hook"], null],
] as const

export type cc2TileNames =
	| Exclude<(typeof cc2Tiles)[number][0], undefined>[0]
	// Indirect tile additions
	| "canopy"
	| "andGate"
	| "orGate"
	| "xorGate"
	| "latchGate"
	| "counterGate"
	| "nandGate"
	| "latchGateMirror"
	| "combinationTile"
	| "voodooTile"
	// Yep, used for floor wires
	| null
export type cc2Tile = [cc2TileNames, Direction?, string?, number?]

export default cc2Tiles as unknown as cc2Tile[][]
