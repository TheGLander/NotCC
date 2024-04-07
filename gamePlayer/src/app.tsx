import "./index.css"
import { Sidebar } from "./components/Sidebar"
import { makeThemeCssVars, colorSchemeAtom } from "./themeHelper"
import { Router, embedModeAtom, embedReadyAtom } from "./routing"
import { PromptComponent, Prompts, showPrompt as showPromptGs } from "./prompts"
import { useAtomValue } from "jotai"
import { useEffect } from "preact/hooks"
import { twJoin } from "tailwind-merge"
import { useJotaiFn } from "./helpers"
import { Dialog } from "./components/Dialog"
import { registerSW } from "virtual:pwa-register"

const ErrorPrompt =
	(err: Error): PromptComponent<void> =>
	props => (
		<Dialog
			header="Error"
			buttons={[["Ok", () => {}]]}
			onResolve={props.onResolve}
		>
			{" "}
			It appears something went wrong and an error has occured in NotCC!
			<div
				class="bg-theme-950 max-h-60 overflow-auto whitespace-pre-wrap p-1"
				tabIndex={0}
			>
				{err.name}: {err.message}
				<br />
				{err.stack && `Stack trace: ${err.stack}`}
			</div>
			Please report this error by{" "}
			<a href="https://github.com/TheGLander/NotCC/issues/new">
				making a GitHub issue
			</a>{" "}
			or{" "}
			<a href="https://discord.gg/a7rTCkycpD">
				mentioning it in the Chip's Challenge Bit Buster Club Discord Server
			</a>
			, thanks!
		</Dialog>
	)

const UpdatePrompt =
	(updateSW: () => void): PromptComponent<void> =>
	props => (
		<Dialog
			notModal
			header="New update!"
			buttons={[
				["Apply", () => updateSW()],
				["Dismiss", () => {}],
			]}
			onResolve={props.onResolve}
		>
			There has been an update for NotCC! Press Apply to refresh the page and
			apply the update!
		</Dialog>
	)

export function App() {
	const colorScheme = useAtomValue(colorSchemeAtom)
	const embedMode = useAtomValue(embedModeAtom)
	const embedReady = useAtomValue(embedReadyAtom)
	const showPrompt = useJotaiFn(showPromptGs)
	useEffect(() => {
		const updateSW = registerSW({
			onNeedRefresh() {
				showPrompt(UpdatePrompt(updateSW))
			},
			onOfflineReady() {},
			immediate: true,
		})
	}, [])
	useEffect(() => {
		if (!embedReady) return
		top?.postMessage(
			{ width: document.body.scrollWidth, height: document.body.scrollHeight },
			"*"
		)
	}, [embedReady])
	useEffect(() => {
		const listener = (ev: ErrorEvent | PromiseRejectionEvent) => {
			let errorMsg: Error
			if ("reason" in ev) {
				errorMsg = ev.reason
			} else {
				errorMsg = ev.error
			}
			if (errorMsg === undefined) {
				errorMsg = new Error("Caught weird error type, please check logs")
			}
			showPrompt(ErrorPrompt(errorMsg))
		}
		window.addEventListener("error", listener)
		window.addEventListener("unhandledrejection", listener)
		return () => {
			window.removeEventListener("error", listener)
			window.removeEventListener("unhandledrejection", listener)
		}
	}, [])
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
