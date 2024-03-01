import { Suspense, lazy } from "preact/compat"
import type { LinearModel } from "./models/linear"
import type { GraphModel } from "./models/graph"
import { atom, useAtomValue } from "jotai"
import { useJotaiFn } from "@/helpers"
import { openExaCC as openExaCCgs } from "./OpenExaPrompt"

export const modelAtom = atom<LinearModel | GraphModel | null>(null)
const RealExaPlayerPage = lazy(() =>
	import("./exaPlayer").then(mod => mod.RealExaPlayerPage)
)

export function ExaPlayerPage() {
	const model = useAtomValue(modelAtom)
	const openExaCC = useJotaiFn(openExaCCgs)
	if (model === null) {
		openExaCC()
		return <></>
	}
	return (
		<Suspense fallback={<div class="box m-auto">Loading™...</div>}>
			<RealExaPlayerPage />
		</Suspense>
	)
}
