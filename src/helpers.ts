export type Field<T> = T[][]
/**
 * All the directions, clockwise
 */
export enum Direction {
	UP,
	RIGHT,
	DOWN,
	LEFT,
}

// #region Internal enums for `relativeToAbsolute`

enum AbsoluteUp {
	FORWARD,
	RIGHT,
	OPPOSITE,
	LEFT,
}

enum AbsoluteRight {
	LEFT,
	FORWARD,
	RIGHT,
	OPPOSITE,
}

enum AbsoluteDown {
	OPPOSITE,
	LEFT,
	FORWARD,
	RIGHT,
}

enum AbsoluteLeft {
	RIGHT,
	OPPOSITE,
	LEFT,
	FORWARD,
}

const absoluteEnums = [
	AbsoluteUp,
	AbsoluteRight,
	AbsoluteDown,
	AbsoluteRight,
] as const

//#endregion

/**
 * Creates an enum of relative directions from an absolute one
 * @param direction The direction to convert
 */
export function relativeToAbsolute(
	direction: Direction
): typeof absoluteEnums[Direction] {
	return absoluteEnums[direction]
}

/**
 * Find neighbors from a center and return them
 * @param center The center coordinates of the radius, 0-based
 * @param field The field to find neighbors on
 * @param radius The radius of range to look for for the neighbors
 */
export function findNeighbors<T>(
	center: [number, number],
	field: Field<T>,
	radius: number
): T[] {
	const x = center[0]
	const y = center[1]
	let neighbors: T[] = []
	if (radius > 0) neighbors = [...findNeighbors(center, field, radius - 1)]
	for (let turnAt = radius; turnAt >= -radius; turnAt--) {
		neighbors.push(field[y + turnAt][x + Math.abs(turnAt) - radius])
		//To avoid cases when we get duplicate values, when turnAt and radius compromise eachother
		if (Math.abs(turnAt) !== radius)
			neighbors.push(field[y + turnAt][x - Math.abs(turnAt) + radius])
	}
	return neighbors
}
