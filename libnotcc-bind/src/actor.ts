import { TileType } from "./cell.js"
import { wasmFuncs } from "./module.js"
import { Struct } from "./struct.js"

export class Inventory extends Struct {
	get item1() {
		const ptr = wasmFuncs.Inventory_get_item1(this._ptr)
		if (ptr === 0) return null
		return new TileType(ptr)
	}
	get item2() {
		const ptr = wasmFuncs.Inventory_get_item2(this._ptr)
		if (ptr === 0) return null
		return new TileType(ptr)
	}
	get item3() {
		const ptr = wasmFuncs.Inventory_get_item3(this._ptr)
		if (ptr === 0) return null
		return new TileType(ptr)
	}
	get item4() {
		const ptr = wasmFuncs.Inventory_get_item4(this._ptr)
		if (ptr === 0) return null
		return new TileType(ptr)
	}
	get keysRed(): number {
		return wasmFuncs.Inventory_get_keys_red(this._ptr)
	}
	get keysGreen(): number {
		return wasmFuncs.Inventory_get_keys_green(this._ptr)
	}
	get keysBlue(): number {
		return wasmFuncs.Inventory_get_keys_blue(this._ptr)
	}
	get keysYellow(): number {
		return wasmFuncs.Inventory_get_keys_yellow(this._ptr)
	}
}

export enum Direction {
	NONE = 0,
	UP = 1,
	RIGHT = 2,
	DOWN = 3,
	LEFT = 4,
}

export enum SlidingState {
	NONE = 0,
	WEAK = 1,
	STRONG = 2,
}

export class Actor extends Struct {
	get type() {
		return new TileType(wasmFuncs.Actor_get_type(this._ptr))
	}
	get customData(): bigint {
		return wasmFuncs.Actor_get_custom_data(this._ptr)
	}
	set customData(val: bigint) {
		wasmFuncs.Actor_set_custom_data(this._ptr, val)
	}
	get inventory() {
		return new Inventory(wasmFuncs.Actor_get_inventory_ptr(this._ptr))
	}
	get position(): [number, number] {
		const pos = wasmFuncs.Actor_get_position_xy(this._ptr)
		return [pos & 0xff, pos >> 8]
	}
	get direction(): Direction {
		return wasmFuncs.Actor_get_direction(this._ptr)
	}
	get pendingDecision(): Direction {
		return wasmFuncs.Actor_get_pending_decision(this._ptr)
	}
	get pendingDecisionLockedIn(): boolean {
		return wasmFuncs.Actor_get_pending_move_locked_in(this._ptr)
	}
	get moveProgress(): number {
		return wasmFuncs.Actor_get_move_progress(this._ptr)
	}
	get moveLength(): number {
		return wasmFuncs.Actor_get_move_length(this._ptr)
	}
	getVisualOffset(): [number, number] {
		if (this.moveProgress === 0) return [0, 0]
		const offset = 1 - this.moveProgress / this.moveLength
		const pos: [number, number] = [0, 0]
		const dir = this.direction
		if (dir === Direction.UP) {
			pos[1] += offset
		} else if (dir === Direction.RIGHT) {
			pos[0] -= offset
		} else if (dir === Direction.DOWN) {
			pos[1] -= offset
		} else if (dir === Direction.LEFT) {
			pos[0] += offset
		}
		return pos
	}
	get slidingState(): SlidingState {
		return wasmFuncs.Actor_get_sliding_state(this._ptr)
	}
	get bonked(): boolean {
		return !!wasmFuncs.Actor_get_bonked(this._ptr)
	}
	get frozen(): boolean {
		return !!wasmFuncs.Actor_get_frozen(this._ptr)
	}
	get pulled(): boolean {
		return !!wasmFuncs.Actor_get_pulled(this._ptr)
	}
	get pulling(): boolean {
		return !!wasmFuncs.Actor_get_pulling(this._ptr)
	}
	get pushing(): boolean {
		return !!wasmFuncs.Actor_get_pushing(this._ptr)
	}
}
