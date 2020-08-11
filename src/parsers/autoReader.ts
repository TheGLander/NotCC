export default class AutoReadDataView extends DataView {
	offset: number = 0
	smallEndian = true
	getUint8(): number {
		const ret = super.getUint8(this.offset)
		this.offset += 1
		return ret
	}
	getUint8UntilNull(): number[] {
		const ret: number[] = []
		while (super.getUint8(this.offset) !== 0 && this.offset < this.byteLength) {
			ret.push(this.getUint8())
		}
		if (this.offset < this.byteLength) this.offset++
		return ret
	}
	getUint16(): number {
		const ret = super.getUint16(this.offset, this.smallEndian)
		this.offset += 2
		return ret
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
