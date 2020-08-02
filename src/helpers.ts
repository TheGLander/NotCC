export type Field<T> = T[][]
import libClone from "deepclone"
/**
 * All the directions, clockwise
 */
export enum Direction {
	UP,
	RIGHT,
	DOWN,
	LEFT,
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
	let neighbors = []
	if (radius > 0) neighbors = [...findNeighbors(center, field, radius - 1)]
	for (let turnAt = radius; turnAt >= -radius; turnAt--) {
		neighbors.push(field[y + turnAt][x + Math.abs(turnAt) - radius])
		//To avoid cases when we get duplicate values, when turnAt and radius compromise eachother
		if (Math.abs(turnAt) !== radius)
			neighbors.push(field[y + turnAt][x - Math.abs(turnAt) + radius])
	}
	return neighbors
}
/**
 * A simple function to get an HTML element, by either ID or query selector
 * @param id The ID of the element or a query selector
 */
export function l(id: string): HTMLElement {
	return document.getElementById(id) ?? document.querySelector(id)
}

/**
 * Recursively join arrays
 * @param array The array to join
 * @param separator The separator to use
 */
export function joinRecursively(
	array: (string[] | string[][])[],
	separator: string
): string {
	let maxLayer = 1
	function findLayer(val: any) {
		if (val instanceof Array) {
			maxLayer++
			val.forEach(findLayer)
		}
	}
	array.forEach(findLayer)
	let depth = -1
	let output = ""
	function joinArray(val: any) {
		depth++
		if (val instanceof Array) {
			val.forEach(joinArray)
			output.substring(0, output.length - (maxLayer - depth - 1))
		} else output += val
		for (let i = 0; i < maxLayer - depth; i++) output += separator
		depth--
	}
	array.forEach(joinArray)
	return output
}

export function clone<T>(oldObj: T & object): T {
	return libClone(oldObj)
}
