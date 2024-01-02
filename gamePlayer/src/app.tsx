import "./index.css"
import { Sidebar } from "./components/Sidebar"
import { makeThemeCssVars, colorSchemeAtom } from "./themeHelper"
import { Router, embedModeAtom, embedReadyAtom } from "./routing"
import { Prompts } from "./prompts"
import { useAtomValue } from "jotai"
import { useEffect } from "preact/hooks"

export function App() {
	const colorScheme = useAtomValue(colorSchemeAtom)
	const embedMode = useAtomValue(embedModeAtom)
	const embedReady = useAtomValue(embedReadyAtom)
	useEffect(() => {
		if (!embedReady) return
		top?.postMessage(
			{ width: document.body.scrollWidth, height: document.body.scrollHeight },
			"*"
		)
	}, [embedReady])
	if (embedMode) {
		return (
			<div style={makeThemeCssVars(colorScheme)} class="h-full">
				<Router />
			</div>
		)
	}
	return (
		<div
			style={makeThemeCssVars(colorScheme)}
			class="from-theme-500 to-theme-800 flex h-full w-full flex-col-reverse bg-gradient-to-br font-sans text-neutral-100 md:flex-row"
		>
			<Prompts />
			<Sidebar />
			<div class="mx-1 mt-1 flex-1 overflow-y-auto">
				<Router />
			</div>
		</div>
	)
}
