import "./index.css"
import { Sidebar } from "./components/Sidebar"
import { makeThemeCssVars, colorSchemeAtom } from "./themeHelper"
import { Router, embedModeAtom, embedReadyAtom } from "./routing"
import { Prompts } from "./prompts"
import { useAtomValue } from "jotai"
import { useEffect } from "preact/hooks"
import { twJoin } from "tailwind-merge"

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
	return (
		<div
			style={makeThemeCssVars(colorScheme)}
			class={twJoin(
				"flex h-full w-full flex-col-reverse font-sans text-neutral-100 md:flex-row",
				!embedMode && "from-theme-500 to-theme-800 bg-gradient-to-br"
			)}
		>
			<Prompts />
			{!embedMode && <Sidebar />}
			<div class={twJoin("flex-1", !embedMode && "mx-1 mt-1 overflow-y-auto")}>
				<Router />
			</div>
		</div>
	)
}
