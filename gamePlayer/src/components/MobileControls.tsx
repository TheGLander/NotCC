import dpadImage from "@/dpad.svg"
import { RepeatKeyHandler } from "@/inputs"
import { KEY_INPUTS, KeyInputs } from "@notcc/logic"
import { memo } from "preact/compat"
import { useEffect, useRef } from "preact/hooks"
import { useMediaQuery } from "react-responsive"

export function useShouldShowMobileControls(): boolean {
	const lessThanMd = !useMediaQuery({ query: "(min-width: 768px)" })
	if (lessThanMd) return true
	if ("ontouchstart" in document.body) return true
	return false
}

const MOBILE_CONTROLS_PLAYER_N = 0

export const MobileControls = memo(function MobileControls(props: {
	handler: RepeatKeyHandler
}) {
	const onOffRef = useRef<
		| [
				(key: KeyInputs, player: number) => void,
				(key: KeyInputs, player: number) => void,
		  ]
		| null
	>(null)

	useEffect(() => {
		props.handler.addEventSource((on, off) => {
			onOffRef.current = [on, off]
			return () => {}
		})
	}, [props.handler])

	const inputsRef = useRef<KeyInputs>(0)
	function updateDpadDeltas(inputs: KeyInputs) {
		const oldInputs = inputsRef.current
		const [on, off] = onOffRef!.current!
		for (let input = KEY_INPUTS.up; input <= KEY_INPUTS.left; input <<= 1) {
			if (input & inputs && !(input & oldInputs)) {
				on(input, MOBILE_CONTROLS_PLAYER_N)
			}
			if (!(input & inputs) && input & oldInputs) {
				off(input, MOBILE_CONTROLS_PLAYER_N)
			}
		}
		inputsRef.current = inputs
	}

	const dpadRef = useRef<HTMLImageElement | null>(null)
	function handleDpadClick(ev: MouseEvent | TouchEvent) {
		if (!dpadRef.current) return
		ev.preventDefault()
		let x: number, y: number
		if (ev instanceof MouseEvent) {
			if (!ev.buttons) return
			x = ev.offsetX
			y = ev.offsetY
		} else {
			const dpadBox = dpadRef.current.getBoundingClientRect()
			const touches = Array.from(ev.targetTouches)
			const averageTouch = touches
				.map(touch => [touch.pageX - dpadBox.left, touch.pageY - dpadBox.top])
				.reduce((acc, val) => [acc[0] + val[0], acc[1] + val[1]], [0, 0])
			x = averageTouch[0] / touches.length
			y = averageTouch[1] / touches.length
		}
		x /= dpadRef.current.width
		y /= dpadRef.current.height
		updateDpadDeltas(
			0 |
				(x < 1 / 3 ? KEY_INPUTS.left : 0) |
				(x > 2 / 3 ? KEY_INPUTS.right : 0) |
				(y < 1 / 3 ? KEY_INPUTS.up : 0) |
				(y > 2 / 3 ? KEY_INPUTS.down : 0)
		)
	}
	function handleDpadRelease() {
		updateDpadDeltas(0)
	}

	return (
		<div class="pointer-events-none fixed left-0 top-0 h-full w-full">
			<img
				class="pointer-events-auto absolute bottom-[10%] right-[10%] w-[40%]"
				src={dpadImage}
				draggable={false}
				ref={dpadRef}
				onMouseDown={handleDpadClick}
				onMouseMove={handleDpadClick}
				onMouseUp={handleDpadRelease}
				onTouchStart={handleDpadClick}
				onTouchMove={handleDpadClick}
				onTouchEnd={handleDpadClick}
			/>
		</div>
	)
})
