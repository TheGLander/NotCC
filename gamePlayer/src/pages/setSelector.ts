import {
	LevelSet,
	createLevelFromData,
	findScriptName,
	parseC2M,
} from "@notcc/logic"
import { Pager } from "../pager"
import stubLevel from "../levels/NotCC.c2m"
import {
	buildFileListIndex,
	buildZipIndex,
	makeFileListFileLoader,
	makeZipFileLoader,
} from "../fileLoaders"
import { findEntryFilePath, loadSet, openLevel } from "../levelLoading"
import { getGbSets, metadataComparator } from "../gliderbotSets"
import { GliderbotSet } from "../gliderbotSets"
import { HTMLImage, Renderer, Tileset } from "../renderer"
import {
	Comparator,
	decodeBase64,
	fetchImage,
	instanciateTemplate,
	mergeComparators,
	unzlibAsync,
} from "../utils"
import { showDirectotyPrompt, showLoadPrompt } from "../saveData"
import { showAlert } from "../simpleDialogs"
import { unzlib } from "fflate"

async function makeLevelSetPreview(
	tileset: Tileset,
	set: GliderbotSet
): Promise<HTMLCanvasElement | null> {
	const levelSet = await LevelSet.constructAsync(
		set.mainScript,
		set.loaderFunction
	)
	const levelRecord = await levelSet.getNextRecord()
	if (!levelRecord) return null
	const levelData = levelRecord.levelData!
	const level = createLevelFromData(levelData)
	const canvas = document.createElement("canvas")
	const renderer = new Renderer(tileset, canvas)
	renderer.viewportCanvas = canvas
	renderer.level = level
	renderer.cameraSize = level.cameraType
	renderer.updateTileSize()
	renderer.frame()
	return canvas
}

async function getSetThumbnail(
	tileset: Tileset,
	set: GliderbotSet
): Promise<HTMLImage | null> {
	const thumbnailType = set.metadata.thumbnail
	if (thumbnailType === undefined || thumbnailType === "image") {
		try {
			if (set.previewImage === null) throw new Error("No preview.png file")
			const imageUrl = `${set.rootDirectory}/${set.previewImage}`
			const image = await fetchImage(imageUrl)
			return image
		} catch (err) {
			if (thumbnailType === "image") {
				console.error("Failed to fetch image preview")
				console.error(err)
				return null
			}
		}
	}
	try {
		const setPreview = await makeLevelSetPreview(tileset, set)
		return setPreview
	} catch (err) {
		console.error("Failed to create a levelset preview.")
		console.error(err)
		return null
	}
}

const sortMethods = ["Last update", "Alphabetical"] as const
type SortMethod = (typeof sortMethods)[number]

const sortMethodComparators: Record<SortMethod, Comparator<GliderbotSet>> = {
	"Last update"(a, b) {
		return +a.lastChanged - +b.lastChanged
	},
	Alphabetical(a, b) {
		return a.metadata.title.localeCompare(b.metadata.title)
	},
}

export const setSelectorPage = {
	pageId: "setSelectorPage",

	async loadStubLevel(pager: Pager): Promise<void> {
		const levelBin = await (await fetch(stubLevel)).arrayBuffer()
		const level = parseC2M(levelBin)
		openLevel(pager, level)
	},

	async loadZip(pager: Pager, data: Uint8Array): Promise<void> {
		const filePaths = buildZipIndex(data)
		const loader = makeZipFileLoader(data)
		return loadSet(pager, loader, await findEntryFilePath(loader, filePaths))
	},
	async loadFile(pager: Pager, fileData: ArrayBuffer): Promise<void> {
		const magicString = Array.from(new Uint8Array(fileData).slice(0, 4), num =>
			String.fromCharCode(num)
		).join("")
		// File types which aren't accepted by the file input (DATs, raw C2Ms) are
		// here so that the Drag 'n Drop loader can use this.
		if (magicString === "CC2M") {
			const level = parseC2M(fileData)
			openLevel(pager, level)
			return
		} else if (
			// ZIP
			magicString === "PK\u{3}\u{4}"
		) {
			await this.loadZip(pager, new Uint8Array(fileData))
			return
		} else if (
			// DAT
			magicString === "\xAC\xAA\x02\x00" ||
			magicString === "\xAC\xAA\x02\x01" ||
			magicString === "\xAC\xAA\x03\x00" ||
			magicString === "\xAC\xAA\x03\x01"
		) {
			// TODO Proper simpleDialogs
			showAlert("DAT files aren't supported, for now.")
			return
		} else {
			const decoder = new TextDecoder("iso-8859-1")
			const fileText: string = decoder.decode(fileData)

			if (
				// Explain how to use C2Gs
				findScriptName(fileText) !== null
			) {
				showAlert("You need to load the whole set, not just the C2G file.")
				return
			}
		}
	},
	setListEl: null as HTMLUListElement | null,
	setLiTemlpate: null as HTMLTemplateElement | null,
	setupPage(pager: Pager, page: HTMLElement): void {
		const loadFileButton = page.querySelector<HTMLButtonElement>("#loadFile")!
		loadFileButton.addEventListener("click", async () => {
			const files = await showLoadPrompt("Load level file", {
				filters: [
					{ name: "C2M level file", extensions: ["c2m"] },
					{ name: "ZIP levelset archive", extensions: ["zip"] },
				],
			})
			const file = files[0]
			const arrayBuffer = await file.arrayBuffer()
			this.loadFile(pager, arrayBuffer)
		})
		const loadDirectoryButton =
			page.querySelector<HTMLButtonElement>("#loadDirectory")!
		loadDirectoryButton.addEventListener("click", async () => {
			const files = await showDirectotyPrompt("Load levelset directory")
			const fileLoader = makeFileListFileLoader(files)
			const scriptPath = findEntryFilePath(
				fileLoader,
				buildFileListIndex(files)
			)
			await loadSet(pager, fileLoader, await scriptPath)
		})
		this.setListEl = page.querySelector<HTMLUListElement>("#setList")
		this.setLiTemlpate =
			page.querySelector<HTMLTemplateElement>("#setLiTemplate")
		if (!this.setListEl || !this.setLiTemlpate) {
			throw new Error("Can't find a required document element.")
		}
		this.generateSetLis(pager)
	},
	open(pager: Pager): void {
		pager.loadedLevel = null
		pager.loadedSet = null
		pager.updateShownLevelNumber()
		if (!this.loadedParamLevel) {
			this.loadedParamLevel = true
			this.loadParamLevel(pager)
		}
	},
	loadedParamLevel: false,
	async loadParamLevel(pager: Pager) {
		const searchParams = new URLSearchParams(location.search)

		const levelDataBased = searchParams.get("level")

		if (levelDataBased === null) return

		let levelData = decodeBase64(levelDataBased)

		if (levelData[0] === 0x78) {
			levelData = await unzlibAsync(levelData, { consume: true })
		}

		this.loadFile(pager, levelData.buffer)
	},
	gbSets: null as GliderbotSet[] | null,
	buildingGbSetLis: false,
	gbSetLis: new Map<GliderbotSet, HTMLLIElement>(),
	async makeSetLi(pager: Pager, set: GliderbotSet): Promise<HTMLLIElement> {
		const tileset = pager.tileset
		const setLi = instanciateTemplate<HTMLLIElement>(this.setLiTemlpate!)
		const setThumbnailContainer =
			setLi.querySelector<HTMLDivElement>(".setThumbnail")!
		const thumbnail = await getSetThumbnail(tileset!, set)
		if (thumbnail !== null) {
			// Uugh a hack to make sure that thumbnails aren't bigger than the standard size
			const width =
				thumbnail instanceof HTMLImageElement
					? thumbnail.naturalWidth
					: thumbnail.width
			const height =
				thumbnail instanceof HTMLImageElement
					? thumbnail.naturalHeight
					: thumbnail.height
			let cameraWidth = width / tileset!.tileSize
			let cameraHeight = height / tileset!.tileSize
			if (cameraWidth > 10) cameraWidth = 10
			if (cameraHeight > 10) cameraHeight = 10
			setThumbnailContainer.style.setProperty(
				"--camera-width",
				cameraWidth.toString()
			)
			setThumbnailContainer.style.setProperty(
				"--camera-height",
				cameraHeight.toString()
			)
			setThumbnailContainer.appendChild(thumbnail)
		} else setThumbnailContainer.remove()
		const meta = set.metadata
		function addStringFact(className: string, value: string | undefined): void {
			const el = setLi.querySelector<HTMLSpanElement>(`.${className}`)!
			if (value === undefined) {
				el.remove()
			} else {
				const inputEl = el.querySelector("span")!
				inputEl.textContent = value
			}
		}
		addStringFact("setName", meta.title)
		addStringFact("setBy", meta.by)
		// TODO Use stars or something for this instead of a number
		addStringFact("setDifficulty", meta.difficulty?.toString())
		addStringFact("setDescription", meta.description)
		setLi.addEventListener("click", () => {
			loadSet(pager, set.loaderFunction, set.mainScript)
		})

		return setLi
	},

	async buildSetLis(pager: Pager): Promise<void> {
		if (this.gbSets === null) {
			const sets = await getGbSets()
			this.gbSets = sets
		}
		if (!this.setListEl)
			throw new Error("Can't build a set list without the set list element")
		if (!this.setLiTemlpate)
			throw new Error(
				"Can't build a set list without the set list item template"
			)

		this.buildingGbSetLis = true
		this.gbSetLis.clear()

		return Promise.allSettled(
			this.gbSets.map(set =>
				this.makeSetLi(pager, set).then(li => this.gbSetLis.set(set, li))
			)
		).then(() => {
			this.buildingGbSetLis = false
		})
	},
	sortSetLis(sortMethod: SortMethod): GliderbotSet[] {
		if (this.gbSets === null) return []
		const sets = this.gbSets.slice()
		// Always prioritize sets with metadata filled in
		sets.sort(
			mergeComparators(metadataComparator, sortMethodComparators[sortMethod])
		)
		// We want to show the sets considered to be the best near the top, so we need to reverse the array
		return sets.reverse()
	},
	showSetLis(): void {
		if (this.buildingGbSetLis)
			throw new Error(
				"Can't show the set list since the list items are still being generated. Race condition?"
			)
		if (this.setListEl === null)
			throw new Error(
				"Can't add list items since the set list element is unset."
			)
		const sets = this.sortSetLis("Last update")
		for (const li of Array.from(this.setListEl.children)) {
			li.remove()
		}
		for (const set of sets) {
			const li = this.gbSetLis.get(set)
			if (li === undefined) continue
			this.setListEl.appendChild(li)
		}
	},
	async generateSetLis(pager: Pager): Promise<void> {
		await this.buildSetLis(pager)
		this.showSetLis()
	},
	updateSettings(pager: Pager): void {
		if (this.gbSets !== null) {
			this.generateSetLis(pager)
		}
	},
}
