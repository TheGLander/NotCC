let moduleInstance: WebAssembly.Instance | null = null
export function getModuleInstance() {
	if (!moduleInstance) {
		throw new Error(
			"`initWasm` must be called before the rest of the library can be used!"
		)
	}
	return moduleInstance
}
export const wasmFuncs: Record<string, Function> = {}
export async function initWasm(): Promise<void> {
	let instSource: WebAssembly.WebAssemblyInstantiatedSource
	// Use different Wasm download method for Nodejs and bundlers
	if (typeof Buffer !== "undefined") {
		// Node: Just read the file using the FS lib
		// The weird `+ "s"` is to prevent Vite from complaining about Node modules in the browser
		const fs = await import(/* @vite-ignore */ "node:fs/promise" + "s")
		const data = await fs.readFile(new URL("./libnotcc.wasm", import.meta.url))
		instSource = await WebAssembly.instantiate(data)
	} else {
		// Vite: use ?url imports to get a URL to `fetch`
		const url = await import("./libnotcc.wasm?url")
		instSource = await WebAssembly.instantiateStreaming(fetch(url.default))
	}
	moduleInstance = instSource.instance
	Object.setPrototypeOf(wasmFuncs, instSource.instance.exports)
	wasmFuncs.__wasm_call_ctors()
}
