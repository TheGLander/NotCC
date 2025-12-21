import { Suspense, lazy, useEffect, useRef } from "preact/compat"
import type { LinearModel } from "./models/linear"
import type { GraphModel } from "./models/graph"
import { atom, useAtomValue, useSetAtom } from "jotai"
import { useJotaiFn } from "@/helpers"
import { openExaCC as openExaCCgs } from "./OpenExaPrompt"
import { preferenceAtom } from "@/preferences"
import { useSwrLevel } from "@/levelData"
import { pageAtom } from "@/routing"

export const modelAtom = atom<LinearModel | GraphModel | null>(null)
export const exaComplainAboutNonlegalGlitches = preferenceAtom(
	"exaPreventNonlegalGlitches",
	false
)
const RealExaPlayerPage = lazy(() =>
	import("./exaPlayer").then(mod => mod.RealExaPlayerPage)
)

function ExaPromptShower() {
	const levelData = useSwrLevel()
	const promptShown = useRef<boolean>(false)
	const openExaCC = useJotaiFn(openExaCCgs)
	const setPage = useSetAtom(pageAtom)
	useEffect(() => {
		if (promptShown.current) return
		if (!levelData) return
		promptShown.current = true
		openExaCC(levelData).then(opened => {
			if (!opened) {
				setPage("")
			}
		})
	}, [levelData])
	return <></>
}

export function ExaPlayerPage() {
	const model = useAtomValue(modelAtom)
	if (model === null) {
		return <ExaPromptShower />
	}
	return (
		<Suspense fallback={<div class="box m-auto">Loading™...</div>}>
			<RealExaPlayerPage />
		</Suspense>
	)
}
