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
	makeHttpFileLoader,
	makeZipFileLoader,
} from "../fileLoaders"
import { findEntryFilePath, loadSet, openLevel } from "../levelLoading"
import { getGbSets, metadataComparator } from "../gliderbotSets"
import { GliderbotSet } from "../gliderbotSets"
import { HTMLImage, Renderer, Tileset } from "../renderer"
import {
	Comparator,
	fetchImage,
	instanciateTemplate,
	mergeComparators,
} from "../utils"

async function makeLevelSetPreview(
	tileset: Tileset,
	set: GliderbotSet
): Promise<HTMLCanvasElement | null> {
	const levelSet = await LevelSet.constructAsync(
		set.mainScript,
		makeHttpFileLoader(set.rootDirectory)
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
			if (!set.hasPreviewImage) throw new Error("No preview.png file")
			const imageUrl = `${set.rootDirectory}/preview.png`
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
		const level = parseC2M(levelBin, "NotCC.c2m")
		openLevel(pager, level)
	},

	async loadZip(pager: Pager, data: Uint8Array): Promise<void> {
		const filePaths = buildZipIndex(data)
		const loader = makeZipFileLoader(data)
		return loadSet(pager, loader, await findEntryFilePath(loader, filePaths))
	},
	async loadFile(
		pager: Pager,
		fileData: ArrayBuffer,
		fileName: string
	): Promise<void> {
		const magicString = Array.from(new Uint8Array(fileData).slice(0, 4), num =>
			String.fromCharCode(num)
		).join("")
		// File types which aren't accepted by the file input (DATs, raw C2Ms) are
		// here so that the Drag 'n Drop loader can use this.
		if (magicString === "CC2M") {
			const level = parseC2M(fileData, fileName)
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
			// TODO Proper prompts
			alert("DAT files aren't supported, for now.")
			return
		} else {
			const decoder = new TextDecoder("iso-8859-1")
			const fileText: string = decoder.decode(fileData)

			if (
				// Explain how to use C2Gs
				findScriptName(fileText) !== null
			) {
				alert("You need to load the whole set, not just the C2G file.")
				return
			}
		}
	},
	setListEl: null as HTMLUListElement | null,
	setLiTemlpate: null as HTMLTemplateElement | null,
	setupPage(pager: Pager, page: HTMLElement): void {
		const loadFileButton = page.querySelector<HTMLButtonElement>("#loadFile")!
		const fileLoader = page.querySelector<HTMLInputElement>("#fileLoader")!
		fileLoader.value = ""
		fileLoader.addEventListener("change", async () => {
			// There should ever be one file here
			const file = fileLoader.files?.[0]
			if (!file) return
			const arrayBuffer = await file.arrayBuffer()
			this.loadFile(pager, arrayBuffer, file.name)
			fileLoader.value = ""
		})
		loadFileButton.addEventListener("click", () => {
			fileLoader.click()
		})
		const loadDirectoryButton =
			page.querySelector<HTMLButtonElement>("#loadDirectory")!
		const directoryLoader =
			page.querySelector<HTMLInputElement>("#directoryLoader")!
		directoryLoader.value = ""
		directoryLoader.addEventListener("change", async () => {
			if (!directoryLoader.files) return
			const fileLoader = makeFileListFileLoader(directoryLoader.files)
			const scriptPath = findEntryFilePath(
				fileLoader,
				buildFileListIndex(directoryLoader.files)
			)
			directoryLoader.value = ""
			await loadSet(pager, fileLoader, await scriptPath)
		})
		loadDirectoryButton.addEventListener("click", () => {
			directoryLoader.click()
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
	},
	gbSets: null as GliderbotSet[] | null,
	buildingGbSetLis: false,
	gbSetLis: new Map<GliderbotSet, HTMLLIElement>(),
	async makeSetLi(pager: Pager, set: GliderbotSet): Promise<HTMLLIElement> {
		const tileset = pager.tileset
		const setLi = instanciateTemplate<HTMLLIElement>(this.setLiTemlpate!)
		setLi.setAttribute("data-set-url", set.rootDirectory)
		setLi.setAttribute("data-main-script", set.mainScript)
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
			loadSet(pager, makeHttpFileLoader(set.rootDirectory), set.mainScript)
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
	reloadTileset(pager: Pager): void {
		if (this.gbSets !== null) {
			this.generateSetLis(pager)
		}
	},
}
