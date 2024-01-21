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
				"h-full w-full font-sans text-neutral-100",
				!embedMode &&
					"from-theme-500 to-theme-800 flex flex-col-reverse bg-gradient-to-br"
			)}
		>
			<Prompts />
			{!embedMode && <Sidebar />}
			<div class={twJoin(!embedMode && "mx-1 mt-1 flex-1 overflow-y-auto")}>
				<Router />
			</div>
		</div>
	)
}
