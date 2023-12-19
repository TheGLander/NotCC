import { unzlib } from "fflate"
import { Getter, Setter, useStore } from "jotai"
import { useEffect } from "preact/hooks"

export type EffectFn = (get: Getter, set: Setter) => void | (() => void)

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
export function latin1ToBuffer(str: string): Uint8Array {
	return Uint8Array.from(str, c => c.charCodeAt(0))
}
export function decodeBase64(str: string): Uint8Array {
	return latin1ToBuffer(atob(str.replace(/-/g, "+").replace(/_/g, "/")))
}
