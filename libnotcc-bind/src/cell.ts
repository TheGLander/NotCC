import { Actor, ItemIndex } from "./actor.js"
import { wasmFuncs } from "./module.js"
import { Struct, getStringAt, getWasmReader } from "./struct.js"

export class TileType extends Struct {
	get name() {
		return getStringAt(this.getPtr(0))
	}
	get itemIndex(): ItemIndex {
		return wasmFuncs.TileType_get_item_index(this._ptr)
	}
}

export class BasicTile extends Struct {
	get type() {
		return new TileType(wasmFuncs.BasicTile_get_type(this._ptr))
	}
	get customData(): bigint {
		return wasmFuncs.BasicTile_get_custom_data(this._ptr)
	}
	getCell(): Cell {
		// FIXME: AAA
		return new Cell(wasmFuncs.BasicTile_get_cell(this._ptr, 4))
	}
}

export enum Layer {
	SPECIAL = 0,
	ACTOR = 1,
	ITEM_MOD = 2,
	ITEM = 3,
	TERRAIN = 4,
}

export class Cell extends Struct {
	get special() {
		const ptr = wasmFuncs.Cell_get_layer(this._ptr, Layer.SPECIAL)
		if (getWasmReader().getUint32(ptr) === 0) return null
		return new BasicTile(ptr)
	}
	get actor() {
		const ptr = wasmFuncs.Cell_get_actor(this._ptr)
		if (ptr === 0) return null
		return new Actor(ptr)
	}
	get itemMod() {
		const ptr = wasmFuncs.Cell_get_layer(this._ptr, Layer.ITEM_MOD)
		if (getWasmReader().getUint32(ptr) === 0) return null
		return new BasicTile(ptr)
	}
	get item() {
		const ptr = wasmFuncs.Cell_get_layer(this._ptr, Layer.ITEM)
		if (getWasmReader().getUint32(ptr) === 0) return null
		return new BasicTile(ptr)
	}
	get terrain() {
		const ptr = wasmFuncs.Cell_get_layer(this._ptr, Layer.TERRAIN)
		if (getWasmReader().getUint32(ptr) === 0) return null
		return new BasicTile(ptr)
	}
	get poweredWires(): number {
		return wasmFuncs.Cell_get_powered_wires(this._ptr)
	}
	get isWired(): boolean {
		return !!wasmFuncs.Cell_get_is_wired(this._ptr)
	}
}
