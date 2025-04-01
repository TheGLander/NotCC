import { atom, useAtom, useAtomValue, useSetAtom } from "jotai"
import { searchParamsAtom } from "@/routing"
import { encodeBase64, isDesktop, useJotaiFn, zlibAsync } from "@/helpers"
import prewriteIcon from "../prewrite.png"
import { dismissablePreferenceAtom, preferenceAtom } from "@/preferences"
import { SetsGrid } from "@/components/SetsGrid"
import { findScriptName } from "@notcc/logic"
import {
	promptFile,
	promptDir,
	setLevelSetGs,
	setIndividualLevelGs,
	preloadFilesFromDirectoryPromptAtom,
} from "@/levelData"
import { saveFilesLocallyGs } from "@/setManagement"
import { Ht } from "@/components/Ht"

const altLogoAtom = atom(false)

function Header() {
	const [altLogo, setAltLogo] = useAtom(altLogoAtom)
	return (
		<div class="box max-w-4/5 mx-auto mt-3 flex w-fit flex-row items-center max-sm:max-w-sm max-sm:flex-wrap">
			<img
				class="inline-block aspect-square self-start max-sm:ml-auto max-sm:h-10"
				src={altLogo ? "./iconBigAlt.png" : "./iconBig.png"}
				onClick={() => setAltLogo(val => !val)}
				draggable={false}
			/>
			<div class="mx-2 flex flex-col max-sm:contents">
				<h1 class="inline text-5xl max-sm:ml-2 max-sm:mr-auto sm:mt-[-1rem] sm:text-9xl">
					NotCC
				</h1>
				<p class="self-center text-sm max-sm:mx-auto sm:text-[1.05rem]">
					<Ht haiku="An emulator / For Chip's Challenge® Two and Steam /  Scoreboar-legal, too">
						A scoreboard-legal Chip's Challenge 2® emulator.
					</Ht>
				</p>
			</div>
		</div>
	)
}

export const embedLevelInfoAtom = preferenceAtom("embedLevelInfoInUrl", false)
export const storeSetsLocallyAtom = preferenceAtom("storeSetsLocally", true)

function UploadBox() {
	const [embedLevelInfo, setEmbedLevelInfo] = useAtom(embedLevelInfoAtom)
	const [storeSetsLocally, setStoreSetsLocally] = useAtom(storeSetsLocallyAtom)
	const saveFilesLocally = useJotaiFn(saveFilesLocallyGs)
	const setLevelSet = useJotaiFn(setLevelSetGs)
	const setIndividualLevel = useJotaiFn(setIndividualLevelGs)
	const preloadFilesFromDirectoryPrompt = useAtomValue(
		preloadFilesFromDirectoryPromptAtom
	)

	const setSearchParams = useSetAtom(searchParamsAtom)
	return (
		<div class="box mx-auto mt-2 w-4/5">
			<p>
				<Ht haiku="External entries:">Load external files:</Ht>
			</p>
			<div class="flex flex-row gap-1">
				<button
					class="flex-1"
					onClick={async () => {
						const levelData = await promptFile()
						if (!levelData) return
						if (embedLevelInfo && !isDesktop()) {
							let buf = levelData.buffer
							const compBuf = await zlibAsync(new Uint8Array(levelData.buffer))
							if (compBuf.byteLength < buf.byteLength) {
								buf = compBuf
							}
							setSearchParams({
								level: encodeBase64(buf),
							})
						}
						setIndividualLevel(Promise.resolve(levelData.level))
					}}
				>
					<Ht haiku="Add a game file to the world">Load file</Ht>
				</button>
				<button
					class="flex-1"
					onClick={async () => {
						const setInfo = await promptDir(preloadFilesFromDirectoryPrompt)
						if (!setInfo) return
						// Set the ident only if we save the set locally, since otherwise this is just a random custom set
						let setIdent = undefined
						if (storeSetsLocally) {
							const scriptName = findScriptName(
								(await setInfo.setData.loaderFunction(
									setInfo.setData.scriptFile,
									false
								)) as string
							)
							const saveRes = await saveFilesLocally(
								setInfo.setFiles,
								scriptName!
							)
							if (saveRes !== null) {
								setIdent = saveRes.setIdent
							}
						}
						await setLevelSet(setInfo.setData, setIdent)
					}}
				>
					<Ht haiku="Start directory">Load directory</Ht>
				</button>
			</div>
			<div class="flex flex-col">
				{!isDesktop() && (
					<label>
						<input
							type="checkbox"
							checked={embedLevelInfo}
							onInput={ev => setEmbedLevelInfo(ev.currentTarget.checked)}
						/>{" "}
						<Ht haiku="Encode URL">Embed level info in URL</Ht>
					</label>
				)}
				<label>
					<input
						type="checkbox"
						checked={storeSetsLocally}
						onInput={ev => setStoreSetsLocally(ev.currentTarget.checked)}
					/>{" "}
					<Ht haiku="Started sets will persist for eons / Can always replay">
						Store sets locally
					</Ht>
				</label>
			</div>
		</div>
	)
}

const alphaHeaderClosedAtom = dismissablePreferenceAtom("alphaHeaderClosed")

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
			<Ht haiku="Brand new edition / New features beyond compare / Will it ever come?">
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
						A completely new ExaCC experience: graph and tree (trie?) modes,
						route timeline, camera and RNG controls, etc
					</li>
					<li>
						Ability to locally save levelsets (including CC1 Steam and CC2, say
						goodbye to the annoying non-free dialog!!)
					</li>
					<li>External SFX, and maybe an update to the existing set</li>
					<li>
						(External) Music! While NotCC doesn't have its own soundtrack to
						use, I intend to add support for user-provided music anyway
					</li>
					<li>Embed support for the bb.club wiki</li>
				</ul>
			</Ht>
			<button class="ml-auto block" onClick={() => setAlphaHeaderClosed(true)}>
				Ok, cool
			</button>
		</div>
	)
}

function DesktopWipHeader() {
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
			{isDesktop() && <DesktopWipHeader />}
			{!alphaHeaderClosed && <AlphaHeader />}
			<UploadBox />
			<SetsGrid />
		</div>
	)
}
