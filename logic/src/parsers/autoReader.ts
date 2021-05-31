export default class AutoReadDataView extends DataView {
	offset = 0
	smallEndian = true
	autoAllocate = true
	allocateSize = 1000
	getUint8(): number
	getUint8(amount: number): number[]
	getUint8(amount: number | null = null): number | number[] {
		if (amount === null) return super.getUint8(this.offset++)
		const rets: number[] = []
		for (let i = 0; i < amount; i++) {
			rets.push(super.getUint8(this.offset))
			this.offset++
		}
		return rets
	}
	getUint8UntilNull(): number[] {
		const ret: number[] = []
		while (super.getUint8(this.offset) !== 0 && this.offset < this.byteLength) {
			ret.push(this.getUint8())
		}
		if (this.offset < this.byteLength) this.offset++
		return ret
	}
	pushUint8(...values: number[]): void {
		for (const i in values) {
			super.setUint8(this.offset, values[i] & 0xff)
			this.offset++
		}
	}
	pushInt32(...values: number[]): void {
		for (const i in values) {
			super.setInt32(this.offset, values[i] & 0xff)
			this.offset += 4
		}
	}
	getUint16(): number
	getUint16(amount: number): number[]
	getUint16(amount: number | null = null): number | number[] {
		if (amount === null) {
			const retValue = super.getUint16(this.offset, this.smallEndian)
			this.offset += 2
			return retValue
		}
		const rets: number[] = []
		for (let i = 0; i < amount; i++) {
			rets.push(super.getUint16(this.offset, this.smallEndian))
			this.offset += 2
		}
		return rets
	}
	getUint32(): number {
		const ret = super.getUint32(this.offset, this.smallEndian)
		this.offset += 4
		return ret
	}
	getString(amount: number): string {
		let ret = ""
		for (let i = 0; i < amount; i++) {
			ret += String.fromCharCode(super.getUint8(this.offset))
			this.offset += 1
		}
		return ret
	}
	getStringUntilNull(): string {
		let ret = ""
		while (super.getUint8(this.offset) !== 0 && this.offset < this.byteLength) {
			ret += this.getString(1)
		}
		if (this.offset < this.byteLength) this.offset++
		return ret
	}
	skipBytes(amount: number): void {
		this.offset += amount
	}
}
