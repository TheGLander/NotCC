import { AsyncZippable, unzip, unzlib, zip, zlib } from "fflate"
import { Getter, Setter, useStore } from "jotai"
import { Ref } from "preact"
import { useEffect } from "preact/hooks"

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

export class IntervalTimer {
	id: number
	constructor(
		public callback: AnyFunction,
		public time: number
	) {
		this.id = setInterval(callback, time * 1000)
	}
	adjust(newTime: number) {
		clearInterval(this.id)
		this.time = newTime
		this.id = setInterval(this.callback, newTime * 1000)
	}
	cancel(): void {
		clearInterval(this.id)
	}
}

export class TimeoutIntervalTimer {
	id: number
	constructor(
		public callback: AnyFunction,
		public time: number
	) {
		this.nextCall = this.nextCall.bind(this)
		this.id = setTimeout(this.nextCall, time * 1000) as unknown as number
	}
	nextCall(): void {
		this.id = setTimeout(this.nextCall, this.time * 1000) as unknown as number
		this.callback()
	}
	adjust(newTime: number) {
		this.time = newTime
	}
	cancel(): void {
		clearTimeout(this.id)
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

// TODO Neutralino prompts
export async function showLoadPrompt(
	extensions?: string[],
	multiSelections: boolean = false,
	dir: boolean = false
): Promise<File[]> {
	const fileLoader = document.createElement("input")
	fileLoader.type = "file"
	if (extensions !== undefined) {
		fileLoader.accept = extensions.map(ext => `.${ext}`).join(",")
	}
	fileLoader.multiple = multiSelections
	fileLoader.webkitdirectory = dir
	return new Promise((res, rej) => {
		fileLoader.addEventListener("change", () => {
			if (fileLoader.files === null || fileLoader.files.length === 0) {
				rej(new Error("No files specified"))
			} else {
				res(Array.from(fileLoader.files))
			}
			fileLoader.remove()
		})
		fileLoader.click()
	})
}
