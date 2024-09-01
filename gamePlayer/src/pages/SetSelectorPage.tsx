import { useOpenDir, useOpenFile } from "../levelData"
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai"
import { searchParamsAtom } from "@/routing"
import { encodeBase64, isDesktop, zlibAsync } from "@/helpers"
import prewriteIcon from "../prewrite.png"
import { preferenceAtom } from "@/preferences"

const altLogoAtom = atom(false)

function Header() {
	const [altLogo, setAltLogo] = useAtom(altLogoAtom)
	return (
		<div class="box max-w-4/5 mx-auto mt-3 flex w-fit flex-row items-center max-sm:max-w-sm max-sm:flex-wrap">
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

export const embedLevelInfoAtom = preferenceAtom("embedLevelInfoInUrl", false)

function UploadBox() {
	const openFile = useOpenFile()
	const openDir = useOpenDir()
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
						if (levelData && embedLevelInfo && isDesktop()) {
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
				<button
					class="flex-1"
					onClick={async () => {
						openDir()
					}}
				>
					Load directory
				</button>
			</div>
			<div class="flex flex-col">
				{!isDesktop() && (
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
				)}
				<label>
					<input type="checkbox" disabled /> Store sets locally
				</label>
			</div>
		</div>
	)
}

const alphaHeaderClosedAtom = preferenceAtom("alphaHeaderClosed", false)

function AlphaHeader() {
	const setAlphaHeaderClosed = useSetAtom(alphaHeaderClosedAtom)
	return (
		<div class="box relative mt-2 max-w-lg lg:max-w-xl">
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
				version of NotCC, being rewritten from scratch. Here are some cool
				things I intend to add with the (p)rewrite:
			</p>
			<ul class="list-disc pl-4">
				<li>Mobile support</li>
				<li>Less janky UI, including loading indicators</li>
				<li>NCCS and settings import and export</li>
				<li>
					A completely new ExaCC experience: graph and tree (trie?) modes, route
					timeline, camera and RNG controls, etc
				</li>
				<li>
					Ability to locally save levelsets (including CC1 Steam and CC2, say
					goodbye to the annoying non-free dialog!!)
				</li>
				<li>External SFX, and maybe an update to the existing set</li>
				<li>
					(External) Music! While NotCC doesn't have its own soundtrack to use,
					I intend to add support for user-provided music anyway
				</li>
				<li>Embed support for the bb.club wiki</li>
			</ul>
			<button class="ml-auto block" onClick={() => setAlphaHeaderClosed(true)}>
				Ok, cool
			</button>
		</div>
	)
}

function DesktopHeader() {
	return (
		<div class="box relative mt-2 max-w-lg lg:max-w-xl">
			<h2 class="text-center text-lg">NotCC Desktop!</h2>
			<p>
				Hello! This is the desktop version of NotCC, and is still very much a
				work in progress! Please report any bugs or annoyances you come across!
			</p>
		</div>
	)
}

export function SetSelectorPage() {
	const alphaHeaderClosed = useAtomValue(alphaHeaderClosedAtom)
	return (
		<div class="flex flex-col items-center">
			<Header />
			{!isDesktop() && <DesktopHeader />}
			{!alphaHeaderClosed && <AlphaHeader />}
			<UploadBox />
		</div>
	)
}
