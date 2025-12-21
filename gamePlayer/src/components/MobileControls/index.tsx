import dpadImage from "./dpad.svg"
import { InputControls } from "@/inputs"
import { KEY_INPUTS, KeyInputs } from "@notcc/logic"
import { RefObject, memo } from "preact/compat"
import { useEffect, useRef } from "preact/hooks"
import dropActiveImage from "./drop-active.svg"
import dropInactiveImage from "./drop-inactive.svg"
import cycleActiveImage from "./cycle-active.svg"
import cycleInactiveImage from "./cycle-inactive.svg"
import switchActiveImage from "./switch-active.svg"
import switchInactiveImage from "./switch-inactive.svg"
import { applyRef } from "@/helpers"

const DIRECTIONS = ["up", "right", "down", "left"]
export const MOBILE_SOURCE_ID = "touch"

export const MobileControls = memo(function MobileControls(props: {
	inputsRef: RefObject<InputControls | undefined>
	possibleActionsRef: RefObject<(actions: KeyInputs) => void>
}) {
	const inputsRef = useRef([false, false, false, false])
	function updateDpadDeltas(inputs: [boolean, boolean, boolean, boolean]) {
		const oldInputs = inputsRef.current
		for (const [idx, dir] of DIRECTIONS.entries()) {
			if (inputs[idx] && !oldInputs[idx])
				props.inputsRef.current?.on({ source: MOBILE_SOURCE_ID, code: dir })

			if (!inputs[idx] && oldInputs[idx])
				props.inputsRef.current?.off({ source: MOBILE_SOURCE_ID, code: dir })
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
		updateDpadDeltas([y < 1 / 3, x > 2 / 3, y > 2 / 3, x < 1 / 3])
	}
	function handleDpadRelease() {
		updateDpadDeltas([false, false, false, false])
	}

	const secondaryRefs = {
		drop: useRef<HTMLImageElement>(null),
		cycle: useRef<HTMLImageElement>(null),
		switch: useRef<HTMLImageElement>(null),
	}
	function updatePossibleActions(actions: KeyInputs) {
		if (secondaryRefs.drop.current) {
			secondaryRefs.drop.current.src =
				actions & KEY_INPUTS.dropItem ? dropActiveImage : dropInactiveImage
		}
		if (secondaryRefs.cycle.current) {
			secondaryRefs.cycle.current.src =
				actions & KEY_INPUTS.cycleItems ? cycleActiveImage : cycleInactiveImage
		}
		if (secondaryRefs.switch.current) {
			secondaryRefs.switch.current.src =
				actions & KEY_INPUTS.switchPlayer
					? switchActiveImage
					: switchInactiveImage
		}
	}
	useEffect(() => {
		applyRef(props.possibleActionsRef, updatePossibleActions)
	}, [props.possibleActionsRef])

	function handleSecondaryDown(
		code: "dropItem" | "cycleItems" | "switchPlayer"
	) {
		return () => props.inputsRef.current?.on({ source: MOBILE_SOURCE_ID, code })
	}
	function handleSecondaryUp(code: "dropItem" | "cycleItems" | "switchPlayer") {
		return () =>
			props.inputsRef.current?.off({ source: MOBILE_SOURCE_ID, code })
	}

	return (
		<div class="pointer-events-none fixed bottom-0 left-0 right-0 top-0 portrait:bottom-[theme(spacing.20)] landscape:left-[theme(spacing.20)]">
			<img
				class="pointer-events-auto absolute bottom-[25vmin] left-[5vmin] w-[12vmin] landscape:bottom-[25vmin]"
				draggable={false}
				ref={secondaryRefs.drop}
				src={dropInactiveImage}
				onTouchStart={handleSecondaryDown("dropItem")}
				onTouchEnd={handleSecondaryUp("dropItem")}
			/>
			<img
				class="pointer-events-auto absolute bottom-[25vmin] left-[22vmin] w-[12vmin] landscape:bottom-[25vmin]"
				draggable={false}
				ref={secondaryRefs.cycle}
				src={cycleInactiveImage}
				onTouchStart={handleSecondaryDown("cycleItems")}
				onTouchEnd={handleSecondaryUp("cycleItems")}
			/>
			<img
				class="pointer-events-auto absolute bottom-[6vmin] left-[13vmin] w-[12vmin] landscape:bottom-[6vmin]"
				draggable={false}
				ref={secondaryRefs.switch}
				src={switchInactiveImage}
				onTouchStart={handleSecondaryDown("switchPlayer")}
				onTouchEnd={handleSecondaryUp("switchPlayer")}
			/>
			<img
				class="pointer-events-auto absolute bottom-[4vmin] right-[5vmin] w-[40vmin] landscape:bottom-[5vmin]"
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
