import { AsyncZippable, unzip, unzlib, zip, zlib } from "fflate"
import { Getter, Setter, useStore } from "jotai"
import { Ref } from "preact"
import { useCallback, useEffect, useState } from "preact/hooks"

export type EffectFn = (get: Getter, set: Setter) => void | (() => void)
type AnyFunction = (...args: any[]) => any

export function ignorantAtomEffectHook(effectFn: EffectFn) {
	return () => {
		const { get, set } = useStore()
		useEffect(() => effectFn(get, set), [])
	}
}

export function unzlibAsync(buf: Uint8Array): Promise<Uint8Array> {
	return new Promise((res, rej) => {
		unzlib(buf, (err, data) => {
			if (err) rej(err)
			else res(data)
		})
	})
}
export function zlibAsync(buf: Uint8Array): Promise<Uint8Array> {
	return new Promise((res, rej) => {
		zlib(buf, (err, data) => {
			if (err) rej(err)
			else res(data)
		})
	})
}
export function zipAsync(data: AsyncZippable): Promise<Uint8Array> {
	return new Promise((res, rej) => {
		zip(data, (err, data) => {
			if (err) rej(err)
			else res(data)
		})
	})
}
export function uzipAsync(data: Uint8Array): Promise<AsyncZippable> {
	return new Promise((res, rej) => {
		unzip(data, (err, data) => {
			if (err) rej(err)
			else res(data)
		})
	})
}
export function latin1ToBuffer(str: string): Uint8Array {
	return Uint8Array.from(str, c => c.charCodeAt(0))
}
export function bufferToLatin1(bytes: ArrayBuffer): string {
	return Array.from(new Uint8Array(bytes), byte =>
		String.fromCharCode(byte)
	).join("")
}
export function decodeBase64(str: string): Uint8Array {
	return latin1ToBuffer(atob(str.replace(/-/g, "+").replace(/_/g, "/")))
}
export function encodeBase64(bytes: ArrayBuffer): string {
	return btoa(bufferToLatin1(bytes)).replace(/\+/g, "-").replace(/\//g, "_")
}

export function applyRef<T>(ref: Ref<T> | undefined, val: T | null): void {
	if (typeof ref === "function") ref(val)
	else if (ref) ref.current = val
}

export function readImage(buf: ArrayBuffer): Promise<HTMLImageElement> {
	const blob = new Blob([buf])
	return makeImagefromBlob(blob)
}

export async function makeImagefromBlob(
	imageBlob: Blob
): Promise<HTMLImageElement> {
	const url = URL.createObjectURL(imageBlob)
	return fetchImage(url).finally(() => URL.revokeObjectURL(url))
}

export function canvasToBin(img: HTMLCanvasElement) {
	return new Promise<ArrayBuffer>(res => {
		img.toBlob(blob => {
			res(blob!.arrayBuffer())
		}, "image/png")
	})
}

export function fetchImage(link: string): Promise<HTMLImageElement> {
	return new Promise((res, rej) => {
		const img = new Image()
		img.addEventListener("load", () => res(img))
		img.addEventListener("error", err => rej(err.error))
		img.src = link
	})
}

export function reencodeImage(image: HTMLImageElement): HTMLCanvasElement {
	const canvas = document.createElement("canvas")
	canvas.width = image.naturalWidth
	canvas.height = image.naturalHeight
	const ctx = canvas.getContext("2d")!
	ctx.drawImage(image, 0, 0)
	return canvas
}

export class TimeoutTimer {
	id: number
	constructor(callback: AnyFunction, time: number) {
		this.id = setTimeout(callback, time * 1000)
	}
	cancel(): void {
		clearTimeout(this.id)
	}
}

export class CompensatingIntervalTimer {
	id: number
	timeToProcess: number = 0
	lastCallTime: number = performance.now()
	constructor(
		public callback: AnyFunction,
		public time: number
	) {
		this.nextCall = this.nextCall.bind(this)
		this.id = setInterval(this.nextCall, time * 1000) as unknown as number
	}
	nextCall(): void {
		const time = performance.now()
		const dt = time - this.lastCallTime
		this.lastCallTime = time
		this.timeToProcess += dt / 1000
		while (this.timeToProcess > 0) {
			this.callback()
			this.timeToProcess -= this.time
		}
	}
	adjust(newTime: number) {
		clearInterval(this.id)
		this.time = newTime
		this.id = setInterval(this.nextCall, newTime * 1000) as unknown as number
	}
	cancel(): void {
		clearInterval(this.id)
	}
}

export class AnimationTimer {
	id: number
	constructor(public callback: AnyFunction) {
		this.nextCall = this.nextCall.bind(this)
		this.id = requestAnimationFrame(this.nextCall)
	}
	nextCall(): void {
		this.id = requestAnimationFrame(this.nextCall)
		this.callback()
	}
	cancel(): void {
		cancelAnimationFrame(this.id)
	}
}

export function useJotaiFn<A extends unknown[], R>(
	fn: (get: Getter, set: Setter, ...args: A) => R
): (...args: A) => R {
	const { get, set } = useStore()
	return (...args) => fn(get, set, ...args)
}

export function sleep(s: number): Promise<void> {
	return new Promise(res => {
		setTimeout(() => res(), s * 1000)
	})
}

export function formatTimeLeft(timeLeft: number, padding = false) {
	let sign = ""
	if (timeLeft < 0) {
		timeLeft = -timeLeft
		sign = "-"
	}
	const subtickStr = [padding ? " " : "", "⅓", "⅔"]
	const subtick = timeLeft % 3
	const int = Math.ceil(timeLeft / 60)
	let decimal = (Math.floor((timeLeft / 3) % 20) * 5)
		.toString()
		.padStart(2, "0")
	if (decimal === "00" && subtick === 0) {
		decimal = "100"
	}
	return `${sign}${int}.${decimal}${
		decimal === "100" ? "" : subtickStr[subtick]
	}`
}

export function formatTicks(timeLeft: number) {
	let sign = ""
	if (timeLeft < 0) {
		timeLeft = -timeLeft
		sign = "-"
	}
	const subtickStr = ["", "⅓", "⅔"]
	const subtick = timeLeft % 3
	const int = Math.floor(timeLeft / 60)
	let decimal = (Math.floor((timeLeft / 3) % 20) * 5)
		.toString()
		.padStart(2, "0")
	return `${sign}${int}.${decimal}${subtickStr[subtick]}`
}

export function isDesktop(): boolean {
	return import.meta.env.VITE_BUILD_PLATFORM === "desktop"
}

// Semaphore to limit eg. concurrent requests to N at a time
export class BasicSemaphore {
	releaseQueue: (() => void)[] = []
	locks: number = 0
	constructor(public limit: number) {}
	enter(): Promise<void> {
		// If this semaphore has any capacity left, use one of the locks
		if (this.locks < this.limit) {
			this.locks += 1
			return Promise.resolve()
		}
		// Otherwise, wait until another user has left
		return new Promise(res => {
			this.releaseQueue.push(res)
		})
	}
	leave(): void {
		if (this.locks <= 0)
			throw new Error("Left a semaphore despite there being no locks left")
		if (this.locks === this.limit) {
			// We're making new capacity, let a waiting user through if there are any
			const releaseFn = this.releaseQueue.shift()
			if (releaseFn) {
				releaseFn()
				return
			}
		}
		this.locks -= 1
	}
}

export async function resErrorToString(res: Response): Promise<string> {
	return `${res.status} ${res.statusText}: ${await res.text()}`
}

export function usePromise<T>(
	maker: () => Promise<T>,
	deps: unknown[]
): {
	value?: T
	error?: Error
	state: "working" | "done" | "error"
	repeat: () => void
} {
	const [value, setValue] = useState<T | undefined>(undefined)
	const [error, setError] = useState<Error | undefined>(undefined)
	const doPromise = useCallback(() => {
		setError(undefined)
		setValue(undefined)
		maker()
			.then(val => {
				setValue(val)
			})
			.catch(err => {
				setError(err)
			})
	}, [maker])
	useEffect(() => {
		doPromise()
	}, deps)
	return {
		value,
		error,
		state: value ? "done" : error ? "error" : "working",
		repeat: doPromise,
	}
}

export async function aiGather<T>(ai: AsyncIterable<T>): Promise<T[]> {
	const items = []
	for await (const item of ai) {
		items.push(item)
	}
	return items
}
export async function aiFind<T>(
	ai: AsyncIterable<T>,
	func: (item: T, idx: number) => boolean
): Promise<T | null> {
	let idx = 0
	for await (const item of ai) {
		if (func(item, idx)) return item
		idx += 1
	}
	return null
}
export async function* aiFilter<T>(
	ai: AsyncIterable<T>,
	func: (item: T, idx: number) => boolean
): AsyncIterableIterator<T> {
	let idx = 0
	for await (const item of ai) {
		if (func(item, idx)) yield item
		idx += 1
	}
}
export function formatBytes(bytes: number) {
	let suffix: string = "bytes"
	let suffixDiv: number = 1
	if (bytes > 1024 ** 3) {
		suffix = "gibibytes"
		suffixDiv = 1024 ** 3
	} else if (bytes > 1024 ** 2) {
		suffix = "mebibytes"
		suffixDiv = 1024 ** 2
	} else if (bytes > 1024) {
		suffix = "kibibytes"
		suffixDiv = 1024
	}
	return `${(bytes / suffixDiv).toFixed(3)} ${suffix}`
}
