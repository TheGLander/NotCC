import "./index.css"
import { Sidebar } from "./components/Sidebar"
import { makeThemeCssVars, colorSchemeAtom } from "./themeHelper"
import { Router, embedModeAtom, embedReadyAtom } from "./routing"
import { PromptComponent, Prompts, showPromptGs } from "./prompts"
import { useAtomValue } from "jotai"
import { useEffect } from "preact/hooks"
import { twJoin } from "tailwind-merge"
import { desktopPlatform, isDesktop, useJotaiFn } from "./helpers"
import { Dialog } from "./components/Dialog"
import * as pwaRegister from "virtual:pwa-register"
import { ToastDisplay } from "./toast"
import { ErrorBox } from "./components/ErrorBox"

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
			<ErrorBox error={err} />
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
	// PWA auto-update
	useEffect(() => {
		if (isDesktop()) return
		const updateSW = pwaRegister.registerSW({
			onNeedRefresh() {
				showPrompt(UpdatePrompt(updateSW))
			},
			onOfflineReady() {},
			immediate: true,
		})
	}, [])
	// Embed mode communication
	useEffect(() => {
		if (!embedReady) return
		top?.postMessage(
			{ width: document.body.scrollWidth, height: document.body.scrollHeight },
			"*"
		)
	}, [embedReady])
	// Error handling, handles both normal and promise error events
	useEffect(() => {
		const listener = (ev: ErrorEvent | PromiseRejectionEvent) => {
			// return
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
			id="app-root"
			style={makeThemeCssVars(colorScheme)}
			class={twJoin(
				"relative h-full w-full font-sans text-neutral-100",
				!embedMode &&
					"from-theme-500 to-theme-800 flex flex-col-reverse bg-gradient-to-br",
				isDesktop() &&
					desktopPlatform() !== "windows" &&
					"disable-select-appearance"
			)}
		>
			<Prompts />
			{!embedMode && <Sidebar />}
			<div
				class={twJoin(!embedMode && "isolate mx-1 mt-1 flex-1 overflow-y-auto")}
			>
				<Router />
			</div>
			<ToastDisplay />
		</div>
	)
}
