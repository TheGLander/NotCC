import AutoReadDataView from "./autoReader"
import cc1Data from "./datData"
import { LevelData, LevelSetData } from "../encoder"

/**
 * Numbers which NotCC should accept as the magic number
 */
const GOOD_MAGIC_NUMBERS = [0x0002aaac, 0x0102aaac, 0x0003aaac]

export function parseDAT(buff: ArrayBuffer, fileName: string): LevelSetData {
	const view = new AutoReadDataView(buff)
	const setData: LevelSetData = {
		name: /(.+)\.(?:dat|ccl)$/.exec(fileName)?.[1] ?? "UNNAMED",
		levels: {},
	}
	let chipsLeft = 0
	function addLayer(upper: boolean, levelData: LevelData): void {
		if (!levelData.field) throw new Error("This should never happen")
		const targetOffset = view.getUint16() + view.offset
		let tileIndex = 0
		while (view.offset < targetOffset) {
			let actorByte = view.getUint8(),
				amount = 1

			if (actorByte === 0xff) {
				// RLE
				amount = view.getUint8()
				actorByte = view.getUint8()
			}
			if (!cc1Data[actorByte])
				throw new Error(
					`Invalid tile! (0x${actorByte.toString(16)} is invalid)`
				)
			for (let j = 0; j < amount; j++) {
				// If we are on the upper layer, initialize the field
				if (upper) {
					if (tileIndex < 32) levelData.field.push([])
					levelData.field[tileIndex & 31].push([])
				}
				if (actorByte !== 0x02 || chipsLeft > 0)
					levelData.field[tileIndex & 31][(tileIndex & ~31) / 32].push(
						...cc1Data[actorByte]
					)
				// If we have fufilled the chip goal, use echipPlus instead
				else
					levelData.field[tileIndex & 31][(tileIndex & ~31) / 32].push([
						"echipPlus",
					])
				tileIndex++
			}
			if (tileIndex > 1024) throw new Error("Tile definitions go past 32x32!")
		}
	}
	if (!GOOD_MAGIC_NUMBERS.includes(view.getUint32()))
		throw new Error("Invalid file! (Magic number doesn't match)")
	const levelAmount = view.getUint16()
	for (let i = 0; i < levelAmount; i++) {
		const levelData: LevelData = {
			camera: { height: 9, width: 9, screens: 1 },
			timeLimit: 0,
			blobMode: 1,
			width: 32,
			height: 32,
			field: [],
		}
		// Do it like this so TS believes it exists
		levelData.connections = []

		const targetOffset = view.getUint16() + view.offset
		const levelNumber = view.getUint16()
		levelData.timeLimit = view.getUint16()
		chipsLeft = view.getUint16()
		// Unused thing
		view.getUint16()
		addLayer(true, levelData)
		addLayer(false, levelData)
		levelData.extraChipsRequired = chipsLeft // Any chips we can't normally
		const targetFieldOffset = view.getUint16() + view.offset
		while (view.offset < targetFieldOffset) {
			const fieldType = view.getUint8()
			const fieldTargetOffset = view.getUint8() + view.offset
			switch (fieldType) {
				// There is no point in checking fields 1, 2, 8 & 10
				case 3: // Level name
					levelData.name = view.getStringUntilNull()
					break
				case 4:
				case 5: // Button/machine connections
					while (view.offset < fieldTargetOffset) {
						levelData.connections.push([
							[view.getUint16(), view.getUint16()],
							[view.getUint16(), view.getUint16()],
						])
						if (fieldType === 4) view.getUint16() // This is never used
					}
					break
				case 6: // "Encrypted" password
					levelData.password = [...view.getStringUntilNull()]
						.map(val => String.fromCharCode(val.charCodeAt(0) ^ 0x99)) // "Decrypt" the password
						.join("")
					break
				case 7: // Level hint
					levelData.hints = [view.getStringUntilNull()]
					break
				default:
					// Ignore this field
					view.offset = fieldTargetOffset
					break
			}
			if (view.offset !== fieldTargetOffset)
				throw new Error("Fields are messed up!")
		}
		if (view.offset !== targetOffset)
			throw new Error("The offset is messed up!")
		setData.levels[levelNumber] = levelData
	}
	return setData
}
