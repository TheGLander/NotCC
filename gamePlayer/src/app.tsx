import "./index.css"
import { Sidebar } from "./components/Sidebar"
import { makeThemeCssVars } from "./themeHelper"
import { Router } from "./routing"

export function App() {
	return (
		<div
			style={makeThemeCssVars("blue")}
			class="from-theme-500 to-theme-800 flex h-full w-full flex-col-reverse bg-gradient-to-br font-sans text-neutral-100 md:flex-row"
		>
			<Sidebar />
			<Router />
		</div>
	)
}
