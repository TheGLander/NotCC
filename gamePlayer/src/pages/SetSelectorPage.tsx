import { useOpenFile } from "../levelData"
import { atom, useAtom, useSetAtom } from "jotai"
import { searchParamsAtom } from "@/routing"
import { encodeBase64, zlibAsync } from "@/helpers"

const altLogoAtom = atom(false)

function Header() {
	const [altLogo, setAltLogo] = useAtom(altLogoAtom)
	return (
		<div class="box max-w-4/5 mx-auto my-4 flex w-fit flex-row items-center max-sm:max-w-sm max-sm:flex-wrap">
			<img
				class="inline-block aspect-square max-sm:ml-auto max-sm:h-10"
				src={altLogo ? "/iconBigAlt.png" : "/iconBig.png"}
				onClick={() => setAltLogo(val => !val)}
				draggable={false}
			/>
			<div class="mx-2 flex flex-col max-sm:contents">
				<h1 class="inline text-5xl max-sm:ml-2 max-sm:mr-auto sm:text-9xl">
					NotCC
				</h1>
				<p class="self-center text-sm max-sm:mx-auto sm:text-[1.05rem]">
					A scoreboard-legal Chip's Challenge 2® emulator.
				</p>
			</div>
		</div>
	)
}

export const embedLevelInfoAtom = atom(false)

function UploadBox() {
	const openFile = useOpenFile()
	const [embedLevelInfo, setEmbedLevelInfo] = useAtom(embedLevelInfoAtom)
	const setSearchParams = useSetAtom(searchParamsAtom)
	return (
		<div class="box mx-auto mt-2 w-4/5">
			<p>Load external files:</p>
			<div class="flex flex-row gap-1">
				<button
					class="flex-1"
					onClick={async () => {
						const levelData = await openFile()
						if (levelData && embedLevelInfo) {
							let buf = levelData.buffer
							const compBuf = await zlibAsync(new Uint8Array(levelData.buffer))
							if (compBuf.byteLength < buf.byteLength) {
								buf = compBuf
							}
							setSearchParams({
								level: encodeBase64(buf),
							})
						}
					}}
				>
					Load file
				</button>
				<button class="flex-1" disabled>
					Load directory
				</button>
			</div>
			<div class="flex flex-col">
				<label>
					<input
						type="checkbox"
						checked={embedLevelInfo}
						onInput={ev =>
							setEmbedLevelInfo((ev.target as HTMLInputElement).checked)
						}
					/>{" "}
					Embed level info in URL
				</label>
				<label>
					<input type="checkbox" disabled /> Store sets locally
				</label>
			</div>
		</div>
	)
}

export function SetSelectorPage() {
	return (
		<div class="flex flex-1 flex-col items-center overflow-y-auto">
			<Header />
			<UploadBox />
		</div>
	)
}
