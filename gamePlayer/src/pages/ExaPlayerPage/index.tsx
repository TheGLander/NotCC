import { Suspense, lazy } from "preact/compat"
import type { LinearModel } from "./models/linear"
import type { GraphModel } from "./models/graph"
import { atom } from "jotai"

export const modelAtom = atom<LinearModel | GraphModel | null>(null)
const RealExaPlayerPage = lazy(() =>
	import("./exaPlayer").then(mod => mod.RealExaPlayerPage)
)

export function ExaPlayerPage() {
	return (
		<Suspense fallback={<div class="box m-auto">Loading™...</div>}>
			<RealExaPlayerPage />
		</Suspense>
	)
}
