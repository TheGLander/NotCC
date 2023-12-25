import { useOpenFile } from "../levelData"
import { atom, useAtom, useSetAtom } from "jotai"
import { searchParamsAtom } from "@/routing"
import { encodeBase64, zlibAsync } from "@/helpers"
import prewriteIcon from "../prewrite.png"

const altLogoAtom = atom(false)

function Header() {
	const [altLogo, setAltLogo] = useAtom(altLogoAtom)
	return (
		<div class="box max-w-4/5 mx-auto mb-4 mt-3 flex w-fit flex-row items-center max-sm:max-w-sm max-sm:flex-wrap">
			<img
				class="inline-block aspect-square max-sm:ml-auto max-sm:h-10"
				src={altLogo ? "./iconBigAlt.png" : "./iconBig.png"}
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

function AlphaHeader() {
	return (
		<div class="box max-w-lg lg:max-w-xl">
			<h2 class="text-center">
				<img
					class="inline-block [image-rendering:pixelated]"
					width={30}
					src={prewriteIcon}
				/>
				<span class="mx-2 text-lg">
					NotCC <em>alpha!</em>
				</span>
				<img
					class="inline-block [image-rendering:pixelated]"
					width={30}
					src={prewriteIcon}
				/>
			</h2>
			<p>
				Welcome to the Prewrite Alpha! This is a currently in-development
				version of NotCC which uses frameworks like Preact and TailwindCSS
				instead of vanilla JS, HTML, and CSS. This rewrite will be used as an
				opportunity for a UI touch-up and for new features such as:
			</p>
			<ul class="list-disc pl-4">
				<li>Mobile support</li>
				<li>NCCS and settings import and export</li>
				<li>
					More ExaCC features (scrubbing scrollbar, RFF and RNG setting,
					savestates, inline editing)
				</li>
				<li>Ability to locally save levelsets (including CC1 Steam and CC2)</li>
				<li>SFXsets</li>
				<li>Embed support for the bb.club wiki</li>
			</ul>
		</div>
	)
}

export function SetSelectorPage() {
	return (
		<div class="flex flex-col items-center">
			<Header />
			<AlphaHeader />
			<UploadBox />
		</div>
	)
}
