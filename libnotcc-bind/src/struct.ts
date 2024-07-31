import { getModuleInstance, wasmFuncs } from "./module.js"

let _reader: DataView | null = null

export function getWasmReader() {
	if (_reader === null || _reader.buffer.byteLength === 0) {
		_reader = new DataView(
			(getModuleInstance().exports.memory as WebAssembly.Memory).buffer
		)
	}
	return _reader
}

const decoder = new TextDecoder("utf-8")

export function getStringAt(ptr: number): string | null {
	if (ptr === 0) return null
	const bytes: number[] = []
	while (true) {
		const byte = getWasmReader().getUint8(ptr)
		if (byte === 0) break
		bytes.push(byte)
		ptr += 1
	}
	return decoder.decode(new Uint8Array(bytes))
}

export const PTR_SIZE = 4
export const U64_SIZE = 8
export const I64_SIZE = 8
export const U32_SIZE = 4
export const I32_SIZE = 4
export const U8_SIZE = 1
export const I8_SIZE = 1
export const BOOL_SIZE = 1

export class Struct {
	static finReg = new FinalizationRegistry<[number, (ptr: number) => void]>(
		([ptr, unalloc]) => {
			unalloc(ptr)
			wasmFuncs.free(ptr)
		}
	)
	_ptr: number
	_live = true
	_owned = false
	static size = 0
	static allocStruct<T extends Struct>(size: number): T {
		const ptr = wasmFuncs.malloc(size)
		const struct = new this(ptr)
		struct.own()
		return struct as T
	}
	_assert_live() {
		if (!this._live) throw new Error("Trying to access dead object")
	}
	own() {
		this._assert_live()
		if (this._owned) throw new Error("Trying to reown owned object")
		this._owned = true
		const proto: typeof Struct = Object.getPrototypeOf(this)
		Struct.finReg.register(this, [this._ptr, proto.unalloc], this)
	}
	static unalloc(ptr: number): void {}
	free() {
		this._assert_live()
		if (!this._owned) throw new Error("Trying to free borrowed object")
		this._live = false
		Struct.finReg.unregister(this)
		const proto: typeof Struct = Object.getPrototypeOf(this)
		proto.unalloc?.(this._ptr)
		wasmFuncs.free(this._ptr)
	}
	constructor(ptr: number) {
		this._ptr = ptr
	}
	protected getBool(offset: number): boolean {
		this._assert_live()
		return !!getWasmReader().getUint8(this._ptr + offset)
	}
	protected getU8(offset: number): number {
		this._assert_live()
		return getWasmReader().getUint8(this._ptr + offset)
	}
	protected getI8(offset: number): number {
		this._assert_live()
		return getWasmReader().getInt8(this._ptr + offset)
	}
	protected getU32(offset: number): number {
		this._assert_live()
		return getWasmReader().getUint32(this._ptr + offset, true)
	}
	protected getU64(offset: number): BigInt {
		this._assert_live()
		return getWasmReader().getBigUint64(this._ptr + offset, true)
	}
	protected getPtr(offset: number): number {
		this._assert_live()
		return this.getU32(offset)
	}
	protected getI32(offset: number): number {
		this._assert_live()
		return getWasmReader().getInt32(this._ptr + offset, true)
	}
	protected setBool(offset: number, val: boolean): void {
		this._assert_live()
		getWasmReader().setUint8(this._ptr + offset, val ? 1 : 0)
	}
	protected setU8(offset: number, val: number): void {
		this._assert_live()
		getWasmReader().setUint8(this._ptr + offset, val)
	}
	protected setI8(offset: number, val: number): void {
		this._assert_live()
		getWasmReader().setInt8(this._ptr + offset, val)
	}
	protected setU32(offset: number, val: number): void {
		this._assert_live()
		getWasmReader().setUint32(this._ptr + offset, val, true)
	}
	protected setI32(offset: number, val: number): void {
		this._assert_live()
		getWasmReader().setInt32(this._ptr + offset, val, true)
	}
}
