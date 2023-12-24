import "./index.css"
import { Sidebar } from "./components/Sidebar"
import { makeThemeCssVars } from "./themeHelper"
import { Router } from "./routing"
import { Prompts } from "./prompts"

export function App() {
	return (
		<div
			style={makeThemeCssVars("blue")}
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
