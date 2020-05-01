import { Field, joinRecursively } from "./helpers"
import Actor from "./actor"

interface LevelData {
	field: Field<Actor[]>
	width: number
	height: number
	extUsed: string[]
	timeLimit: number
}
const manifestVer = 0

export function encode(level: LevelData): string {
	//Get all appearances to find out what to archive
	const appearances: Map<string, number> = new Map()
	for (const x in level.field)
		for (const y in level.field[x])
			for (const i in level.field[x][y]) {
				if (!appearances.get(level.field[x][y][i].fullname))
					appearances.set(level.field[x][y][i].fullname, 0)
				appearances.set(
					level.field[x][y][i].fullname,
					appearances.get(level.field[x][y][i].fullname) + 1
				)
			}
	//Write them into a handy lookup object
	const archived: Record<string, number> = {}
	appearances.forEach((val, key) => {
		if (val > 1) archived[key] = Object.keys(archived).length + 1
	})

	//Initialize the storage
	let storage: (string[] | string[][])[] = []
	//Write metadata
	storage.push([
		manifestVer.toString(),
		level.width.toString(),
		level.height.toString(),
		level.timeLimit.toString(),
	])
	//Write archive data
	let archiveStorage = []
	for (const key in archived) {
		archiveStorage.push(key)
	}
	storage.push(archiveStorage)
	//Write normal tile data
	for (const x in level.field)
		for (const y in level.field[x]) {
			let tileStorage: string[][] = []
			for (const i in level.field[x][y]) {
				const actor = level.field[x][y][i]
				tileStorage.push([
					archived[actor.fullname]?.toString() || actor.fullname,
					actor.direction.toString(),
				])
			}
			storage.push(tileStorage)
		}

	return JSON.stringify(storage)
}
