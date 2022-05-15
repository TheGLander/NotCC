export function iterableReduce<T, R>(
	iterable: Iterable<T>,
	func: (acc: R, val: T, i: number) => R,
	defaultValue: R
): R {
	let acc = defaultValue,
		i = 0
	for (const value of iterable) acc = func(acc, value, i++)
	return acc
}

export function* iterableMap<S, T>(
	iterable: Iterable<S>,
	func: (val: S, i: number) => T
): IterableIterator<T> {
	let i = 0
	for (const value of iterable) yield func(value, i++)
}

export function* iterableFilter<T>(
	iterable: Iterable<T>,
	func: (val: T, i: number) => boolean
): IterableIterator<T> {
	let i = 0
	for (const value of iterable) if (func(value, i++)) yield value
}

export function iterableIncludes<T>(
	iterable: Iterable<T>,
	searchValue: T
): boolean {
	for (const value of iterable) if (value === searchValue) return true
	return false
}

export function iterableFind<T>(
	iterable: Iterable<T>,
	func: (val: T, i: number) => boolean
): T | null {
	let i = 0
	for (const value of iterable) if (func(value, i++)) return value
	return null
}

export function iterableFindIndex<T>(
	iterable: Iterable<T>,
	func: (val: T, i: number) => boolean
): number {
	let i = 0
	for (const value of iterable) if (func(value, i++)) return i
	return -1
}

export function iterableIndexOf<T>(
	iterable: Iterable<T>,
	searchValue: T
): number {
	let i = 0
	for (const value of iterable) {
		if (value === searchValue) return i
		i++
	}
	return -1
}

export function iterableSome<T>(
	iterable: Iterable<T>,
	func: (val: T, i: number) => boolean
): boolean {
	let i = 0
	for (const value of iterable) if (func(value, i++)) return true
	return false
}
