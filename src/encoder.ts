import { Field, Direction } from "./helpers"
//import Actor from "./actor"

export interface LevelData {
	field: Field<[string, Direction, string?][]>
	width: number
	height: number
	camera: {
		width: number
		height: number
		screens: number
	}
	extUsed: string[]
	timeLimit: number
	blobMode: number | "true"
	name: string
}
const manifestVer = 0
/*
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
	const storage: (string[] | string[][])[] = []
	//Write metadata
	const metadata: number[] = [
		manifestVer,
		level.width,
		level.height,
		level.timeLimit,
		level.camera.width,
		level.camera.height,
		level.camera.screens,
	]
	storage.push(metadata.map(val => val.toString()))
	//Write archive data
	const archiveStorage = []
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

export function decode(srcData: string): LevelData {
	let level: LevelData
	const data: (string[] | string[][])[] = JSON.parse(srcData)
	level = {
		field: [],
		width: parseInt(data[0][1] as string),
		height: parseInt(data[0][2] as string),
		camera: {
			width: parseInt(data[0][4] as string),
			height: parseInt(data[0][5] as string),
			screens: parseInt(data[0][6] as string),
		},
		extUsed: [],
		timeLimit: parseInt(data[0][3] as string),
	}
	const archived = data[1] as string[]
	
}
*/
