import { useEffect } from "preact/compat"

export function Preloader(props: { preloadComplete?: () => void }) {
	useEffect(() => {
		if (!globalThis.window) return
		setTimeout(() => props.preloadComplete?.(), 500)
	}, [])
	return <div class="box m-auto">Loading very important stuff...</div>
}
