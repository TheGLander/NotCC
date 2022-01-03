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

const absoluteEnums = [
	{ FORWARD: 0, RIGHT: 1, BACKWARD: 2, LEFT: 3 },
	{ FORWARD: 1, RIGHT: 2, BACKWARD: 3, LEFT: 0 },
	{ FORWARD: 2, RIGHT: 3, BACKWARD: 0, LEFT: 1 },
	{ FORWARD: 3, RIGHT: 0, BACKWARD: 1, LEFT: 2 },
] as const

/**
 * Creates an enum of relative directions from an absolute one
 * @param direction The direction to convert
 */
export function relativeToAbsolute(
	direction: Direction
): Record<"FORWARD" | "BACKWARD" | "LEFT" | "RIGHT", Direction> {
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

export function hasOwnProperty<X extends object, Y extends PropertyKey>(
	obj: X,
	prop: Y
): obj is X & Record<Y, unknown> {
	// eslint-disable-next-line no-prototype-builtins
	return prop in obj
}
