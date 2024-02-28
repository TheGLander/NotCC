import { Suspense, lazy } from "preact/compat"

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
