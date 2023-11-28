import "./index.css"
import { Sidebar } from "./components/Sidebar"
import { SetSelectorPage } from "./pages/SetSelectorPage"

export function App() {
	return (
		<div class="flex h-full w-full flex-col-reverse bg-gradient-to-br from-blue-500 to-blue-800 font-sans text-neutral-300 md:flex-row">
			<Sidebar />
			<SetSelectorPage />
		</div>
	)
}
