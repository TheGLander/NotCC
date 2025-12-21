import { usePromise } from "@/helpers"
import {
	downloadUpdateInfo,
	installUpdate,
	shouldUpdateTo,
} from "@/desktopUpdate"
import { Throbber } from "./Throbber"
import { useCallback, useMemo, useState } from "preact/hooks"
import { ProgressBar } from "./ProgressBar"
import { twJoin } from "tailwind-merge"

export function DesktopUpdater() {
	const updateInfo = usePromise(() => downloadUpdateInfo(), [])
	const shouldUpdate = useMemo(
		() => updateInfo.state === "done" && shouldUpdateTo(updateInfo.value),
		[updateInfo]
	)
	const [progress, setProgress] = useState(0)
	const [installing, setInstalling] = useState(false)
	const goInstallUpdate = useCallback(() => {
		if (updateInfo.state !== "done") return
		setInstalling(true)
		return installUpdate(updateInfo.value, setProgress).finally(() =>
			setInstalling(false)
		)
	}, [updateInfo])
	return (
		<div class="box flex flex-col items-center">
			<div>Version {import.meta.env.VITE_VERSION}</div>
			{updateInfo.state === "working" ? (
				<Throbber />
			) : updateInfo.state === "error" ? (
				<div>Failed to download update info</div>
			) : !shouldUpdate ? (
				<div>Up to date</div>
			) : installing ? (
				<>
					<div>Downloading v{updateInfo.value.versionName}...</div>
					<div class={twJoin("flex flex-row self-stretch")}>
						<ProgressBar progress={progress} />
					</div>
				</>
			) : (
				<>
					<div>Version {updateInfo.value.versionName} available</div>
					{updateInfo.value.notice && <div>{updateInfo.value.notice}</div>}
					<button onClick={goInstallUpdate}>Download</button>
				</>
			)}
		</div>
	)
}
