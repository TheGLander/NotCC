import { getBBClubSetReleased, getBBClubSetUpdated } from "@/setsApi"
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks"
import { CameraType, GameRenderer } from "./GameRenderer"
import { suspend } from "suspend-react"
import { tilesetAtom } from "./PreferencesPrompt/TilesetsPrompt"
import { Suspense, memo } from "preact/compat"
import { ErrorBoundary, FallbackProps } from "react-error-boundary"
import { aiGather, useJotaiFn, usePromise } from "@/helpers"
import { Expl } from "./Expl"
import { LevelData, loadSetSave, setLevelSetGs } from "@/levelData"
import { ScriptMetadata } from "@notcc/logic"
import { Throbber } from "./Throbber"
import { twJoin } from "tailwind-merge"
import { PromptComponent, showPromptGs } from "@/prompts"
import { Dialog } from "./Dialog"
import { ErrorBox } from "./ErrorBox"
import {
	ItemLevelSet,
	SetIdentExpl,
	announceLocalSetsChangedGs,
	downloadAndOverwriteBBClubSetGs,
	downloadBBClubSetGs,
	findAllLocalSets,
	getSetMetadata,
	localSetsChangedAtom,
	removeLocalSet,
	useBBClubSetsPromise,
} from "@/setManagement"
import { useAtomValue } from "jotai"

// XXX: Make this dynamic?
const PREVIEW_TILESET_SIZE = 32
const EXPECTED_CAMERA_SIZE = 10

const PREVIEW_FULL_SIZE = PREVIEW_TILESET_SIZE * EXPECTED_CAMERA_SIZE

type SortingMode = "alphabetical" | "newest"

interface SetSortingOptions {
	mode: SortingMode
	reverseMode: boolean
	localFirst: boolean
	// sortLocalByLastPlayed: boolean
	query?: string
}

const alphaSort = (setA: ItemLevelSet, setB: ItemLevelSet) => {
	const a = setA.setName.toLowerCase()
	const b = setB.setName.toLowerCase()
	return a < b ? -1 : a > b ? 1 : 0
}
const dateSort = (setA: ItemLevelSet, setB: ItemLevelSet) => {
	const a = setA.bbClubSet?.set.last_updated
	const b = setB.bbClubSet?.set.last_updated
	if (!a || !b) return 0
	return new Date(b).valueOf() - new Date(a).valueOf()
}

function sortSets(
	inSets: ItemLevelSet[],
	options: SetSortingOptions
): ItemLevelSet[] {
	let sets = inSets.concat()
	sets.sort(options.mode === "alphabetical" ? alphaSort : dateSort)
	if (options.reverseMode) {
		sets.reverse()
	}
	if (options.localFirst) {
		sets.sort((a, b) => {
			return (a.localSet ? 0 : 1) - (b.localSet ? 0 : 1)
		})
	}
	if (options.query) {
		const query = options.query.toLowerCase()
		// Search for the string in both setName and setIdent, since common abbriviations (eg. "CC2" or "CC2LP1") are used in the set ident
		sets = sets.filter(
			set =>
				set.setName.toLowerCase().includes(query) ||
				set.setIdent.toLowerCase().includes(query)
		)
	}
	return sets
}

function SetItemPreview(props: { set: ItemLevelSet }) {
	const previewLevelData = suspend(
		() => getSetPreviewLevel(props.set),
		[props.set]
	)
	const tileset = useAtomValue(tilesetAtom)
	const previewLevel = useMemo(
		() => previewLevelData?.initLevel(),
		[previewLevelData]
	)
	const cameraType: CameraType | undefined = useMemo(
		() =>
			previewLevel && {
				width: previewLevel.metadata.cameraWidth,
				height: previewLevel.metadata.cameraHeight,
			},
		[previewLevel]
	)
	const playerSeat = useMemo(
		() => previewLevel && previewLevel.playerSeats[0],
		[previewLevel]
	)
	if (!tileset || !previewLevel) return <></>
	return (
		<GameRenderer
			tileset={tileset}
			level={previewLevel}
			cameraType={cameraType!}
			playerSeat={playerSeat!}
			tileScale={Math.floor(PREVIEW_TILESET_SIZE / tileset.tileSize)}
		/>
	)
}

function SetItemPreviewError(props: FallbackProps) {
	const error = props.error as Error
	return (
		<>
			Failed to get preview{" "}
			<Expl mode="dialog" title="Failed to download preview">
				Got the following error when downloading the preview:
				<ErrorBox error={error} />
			</Expl>
		</>
	)
}

const RemoveSetPrompt: PromptComponent<
	"cancel" | "remove solutions" | "keep solutions"
> = pProps => (
	<Dialog
		header="Confirm set deletion"
		buttons={[
			[
				"Delete set but keep solutions",
				() => pProps.onResolve("keep solutions"),
			],
			// TODO: ["Delete everything", () => pProps.onResolve("remove solutions")],
			["Cancel", () => pProps.onResolve("cancel")],
		]}
		onClose={() => pProps.onResolve("cancel")}
	>
		Are you sure you want to delete this set? Additionally, do you want to keep
		or delete the existing solutions for this set?
	</Dialog>
)

const SetInfoPrompt =
	(set: ItemLevelSet, setMeta: ScriptMetadata | null): PromptComponent<void> =>
	pProps => {
		const announceLocalSetsChanged = useJotaiFn(announceLocalSetsChangedGs)
		const showPrompt = useJotaiFn(showPromptGs)
		const deleteSet = useCallback(async () => {
			const promptRes = await showPrompt(RemoveSetPrompt)
			if (promptRes === "cancel") return
			// TODO: Remove solutions
			await removeLocalSet(set, true)
			announceLocalSetsChanged()
			pProps.onResolve()
		}, [])
		const bbClubSet = set.bbClubSet?.set
		return (
			<Dialog
				header={`Set info: ${set.setName}`}
				buttons={[["Close", pProps.onResolve]]}
				onResolve={pProps.onResolve}
			>
				<div class="flex flex-row gap-2">
					<div>
						<ErrorBoundary fallbackRender={SetItemPreviewError}>
							<Suspense fallback={<div class="bg-theme-800 h-full w-full" />}>
								<SetItemPreview set={set} />
							</Suspense>
						</ErrorBoundary>
					</div>

					<div class="grid h-fit flex-1 grid-cols-2 gap-2">
						<span>
							Set name{" "}
							<Expl mode="dialog" title="Set name">
								The set name, as specified in the main C2G script
							</Expl>
						</span>
						<span>{set.setName}</span>
						<span>
							Set ident <SetIdentExpl />
						</span>
						<span>{set.setIdent}</span>
						<span>
							Set has metadata{" "}
							<Expl mode="dialog" title="Set metadata">
								Sets may have additional metadata, as specified by the author.{" "}
								<a
									href="https://github.com/TheGLander/NotCC/blob/prewrite/scriptMetadata.md"
									target="_blank"
								>
									See more about script metadata
								</a>
							</Expl>
						</span>
						<span>
							{set.localSet
								? setMeta?.anyMetadataSpecified
									? "Yes"
									: "No"
								: "Unknown"}
						</span>
						{setMeta?.by && (
							<>
								<span>By</span>
								<span>{setMeta.by}</span>
							</>
						)}
						{setMeta?.description && (
							<>
								<span>Description</span>
								<span class="whitespace-pre-line">{setMeta.description}</span>
							</>
						)}
						{setMeta?.difficulty && (
							<>
								<span>Difficulty</span>
								<span>{setMeta.difficulty}/5</span>
							</>
						)}
						{bbClubSet && (
							<>
								<span>Set uploaded to bb.club</span>
								<span>{getBBClubSetReleased(bbClubSet).toLocaleString()}</span>
								<span>Set last updated on bb.club</span>
								<span>{getBBClubSetUpdated(bbClubSet).toLocaleString()}</span>
								<span>bb.club set ID</span>
								<span>{bbClubSet.id}</span>
								<span>Level count (from bb.club)</span>
								<span>{bbClubSet.level_count}</span>
								{bbClubSet.description && (
									<>
										<span>bb.club description</span>
										<span>{bbClubSet.description}</span>
									</>
								)}
							</>
						)}
						<div class="col-span-2 flex">
							{set.localSet && (
								<button class="flex-1" onClick={deleteSet}>
									Delete
								</button>
							)}
						</div>
					</div>
				</div>
			</Dialog>
		)
	}

async function getSetPreviewLevel(set: ItemLevelSet): Promise<LevelData> {
	// If this is a local set, show the last played level!
	if (set.localSet) {
		const { set: setInst } = await loadSetSave(await set.localSet.loadData())
		const rec = await setInst.initialLevel()
		return new LevelData(rec && (await setInst.loadLevelData(rec)).levelData)
	}
	if (set.bbClubSet) {
		const preview = await set.bbClubSet.repo.getSetPreview(set.bbClubSet.set.id)
		if (!preview) throw new Error("This set has no preview")
		return preview
	}
	// TODO: if (set.builtinSet)
	throw new Error("Can't generate level preview, no valid source")
}

const SetItem = memo(
	(props: { set: ItemLevelSet; showDisambiguation?: boolean }) => {
		const { bbClubSet, localSet: localSetData, localBBClubSet } = props.set

		const { value: localSetMetadata } = usePromise(
			async () => getSetMetadata(props.set),
			[localSetData]
		)

		const [isDownloading, setIsDownloading] = useState<boolean>(false)
		const progressBarRef = useRef<HTMLDivElement>(null)
		const setProgressBarProgress = useCallback((progress: number) => {
			if (!progressBarRef.current) return
			progressBarRef.current.style.width = `${progress * 100}%`
		}, [])

		const downloadAndOverwriteBBClubSet = useJotaiFn(
			downloadAndOverwriteBBClubSetGs
		)
		const downloadBBClubSet = useJotaiFn(downloadBBClubSetGs)

		const userDownloadSet = useCallback(async () => {
			setIsDownloading(true)
			await downloadBBClubSet(props.set, setProgressBarProgress)
			setIsDownloading(false)
		}, [props.set])

		const updateSet = useCallback(async () => {
			if (!localSetData) return
			await removeLocalSet(props.set, false)
			setIsDownloading(true)
			// We just removed the same set, so we don't need to check if we're overwriting anything
			await downloadAndOverwriteBBClubSet(props.set, setProgressBarProgress)
			setIsDownloading(false)
		}, [localSetData])

		const setLevelSet = useJotaiFn(setLevelSetGs)
		const playSet = useCallback(async () => {
			if (!localSetData) return
			setLevelSet(await localSetData.loadData(), props.set.setIdent)
		}, [localSetData, setLevelSet])

		const isOutOfDate = useMemo(
			() =>
				bbClubSet &&
				localBBClubSet &&
				getBBClubSetUpdated(bbClubSet.set).getTime() >
					localBBClubSet.lastUpdated,
			[bbClubSet, localBBClubSet]
		)
		const showPrompt = useJotaiFn(showPromptGs)
		const showSetInfo = useCallback(() => {
			showPrompt(SetInfoPrompt(props.set, localSetMetadata ?? null))
		}, [props.set, localSetMetadata])

		return (
			<div class="box hover:bg-theme-950 flex flex-col gap-0.5">
				<div
					style={{ width: PREVIEW_FULL_SIZE, height: PREVIEW_FULL_SIZE }}
					class="flex items-center justify-center self-center"
				>
					<ErrorBoundary fallbackRender={SetItemPreviewError}>
						<Suspense fallback={<div class="bg-theme-800 h-full w-full" />}>
							<SetItemPreview set={props.set} />
						</Suspense>
					</ErrorBoundary>
				</div>
				<div>
					<span class="text-lg font-bold">{props.set.setName}</span>
					{props.showDisambiguation && (
						<span class="text-sm"> ({props.set.setIdent})</span>
					)}
				</div>
				{localSetMetadata?.by && <div>By {localSetMetadata.by}</div>}
				{bbClubSet && (
					<div>
						{bbClubSet.set.level_count} level
						{bbClubSet.set.level_count !== 1 && "s"}
					</div>
				)}
				{bbClubSet && (
					<div class="text-sm">
						Uploaded {new Date(bbClubSet.set.release_date).toLocaleDateString()}
						{bbClubSet.set.release_date !== bbClubSet.set.last_updated && (
							<>
								, last updated{" "}
								{new Date(bbClubSet.set.last_updated).toLocaleDateString()}
							</>
						)}
					</div>
				)}
				{localSetMetadata?.difficulty && (
					<div>Difficulty: {localSetMetadata.difficulty} / 5</div>
				)}
				{localSetMetadata?.description && (
					<div>{localSetMetadata.description}</div>
				)}
				<div class="mt-auto text-xs">
					{!localSetData || props.set.localBBClubSet ? "bb.club" : "local"}
				</div>
				<div
					class={twJoin(
						"bg-theme-700 h-7 self-stretch rounded",
						!isDownloading && "hidden"
					)}
				>
					<div
						class="bg-theme-800 h-full w-0 transition-transform"
						ref={progressBarRef}
					/>
				</div>
				{!isDownloading && (
					<div class=" flex w-full gap-1">
						{localSetData && (
							<button onClick={playSet} class="flex-1">
								Play
							</button>
						)}
						{isOutOfDate && (
							<button onClick={updateSet} class="flex-1">
								Update
							</button>
						)}
						{bbClubSet && !localSetData && (
							<button onClick={userDownloadSet} class="flex-1">
								Download
							</button>
						)}
						<button onClick={showSetInfo}>?</button>
					</div>
				)}
			</div>
		)
	}
)

function useErrorRethrow(err: Error | null | undefined) {
	useEffect(() => {
		if (err) throw err
	}, [err])
}

export function SetsGrid() {
	const localSetsChanged = useAtomValue(localSetsChangedAtom)
	const localSetsRes = usePromise(
		() => aiGather(findAllLocalSets()),
		[localSetsChanged]
	)
	// Failing to load local sets is really bad, we probably messed something up, show an error message
	useErrorRethrow(localSetsRes.error)

	const setsPromise = useBBClubSetsPromise()
	const bbClubSetsRes = usePromise(() => setsPromise, [setsPromise])
	// On the other hand, failing to load bb.club stuff isn't a huge issue - we may be offline or bb.club might just happen to be down

	const sets: ItemLevelSet[] = useMemo(() => {
		const sets: ItemLevelSet[] = []
		if (localSetsRes.value) {
			sets.push(...localSetsRes.value)
		}
		if (bbClubSetsRes.value) {
			for (const bbClubSet of bbClubSetsRes.value) {
				const localSet = sets.find(
					lSet => lSet.localBBClubSet?.id === bbClubSet.bbClubSet!.set.id
				)
				// If there's a local set that's supposed to auto-update with a bb.club set, just add more info to that local set
				if (localSet) {
					localSet.bbClubSet = bbClubSet.bbClubSet!
					localSet.setKey = `bb.club-${bbClubSet.bbClubSet!.set.id}`
				} else {
					sets.push(bbClubSet)
				}
			}
		}
		return sets
	}, [bbClubSetsRes.value, localSetsRes.value])

	// If there are multiple sets with the same name, we should show the set idents for those sets
	const setsToDisambiguate = useMemo(() => {
		const setNames = new Set()
		const duplicateSets = new Set()
		for (const set of sets) {
			if (setNames.has(set.setName)) {
				duplicateSets.add(set.setName)
			}
			setNames.add(set.setName)
		}
		return duplicateSets
	}, [sets])

	const [query, setQuery] = useState("")
	const [localFirst, setLocalFirst] = useState(true)
	const [sortingMode, setSortingMode] = useState<SortingMode>("newest")
	const sortedSets = useMemo(
		() =>
			sortSets(sets, {
				query,
				mode: sortingMode,
				localFirst,
				reverseMode: false,
			}),
		[sets, query, sortingMode, localFirst]
	)

	const allDoneLoading =
		bbClubSetsRes.state !== "working" && localSetsRes.state !== "working"
	return (
		<div
			class="m-2 grid w-full justify-center gap-1"
			style={{
				grid: `auto-flow / repeat(auto-fit, calc(${PREVIEW_FULL_SIZE}px + 1.5em))`,
			}}
		>
			<div class="box col-span-full flex flex-wrap gap-2">
				<input
					type="text"
					class="flex-1 max-sm:basis-full"
					placeholder="Search..."
					value={query}
					onInput={ev => setQuery(ev.currentTarget.value)}
				/>
				<label>
					<input
						type="checkbox"
						checked={localFirst}
						onInput={ev => setLocalFirst(ev.currentTarget.checked)}
					/>{" "}
					Local first
				</label>
				<select
					value={sortingMode}
					onInput={ev => setSortingMode(ev.currentTarget.value as SortingMode)}
				>
					<option value="alphabetical">Alphabetical</option>
					<option value="newest">Newest</option>
				</select>
			</div>
			{bbClubSetsRes.error && (
				<div class="col-span-full flex w-full flex-col">
					<div class="box mx-auto flex w-fit flex-col">
						<span>
							Failed to load bb.club sets{" "}
							<Expl mode="dialog" title="bb.club fetch error">
								Failed to load bb.club sets due to the following error:
								<ErrorBox error={bbClubSetsRes.error} />
								This may indicate that you're offline, bb.club is down, or that
								there is a NotCC bug.
							</Expl>
						</span>
						<button onClick={bbClubSetsRes.repeat}>Retry</button>
					</div>
				</div>
			)}
			{!allDoneLoading && (
				<div class="col-span-full flex w-full flex-col">
					<div class="box mx-auto flex w-fit flex-col">
						<span>Loading following set data:</span>
						{localSetsRes.state === "working" && <span>local sets</span>}
						{bbClubSetsRes.state === "working" && <span>bb.club sets</span>}
						<div class="m-auto w-fit">
							<Throbber />
						</div>
					</div>
				</div>
			)}
			{sortedSets.map(set => (
				<SetItem
					set={set}
					key={set.setKey}
					showDisambiguation={setsToDisambiguate.has(set.setName)}
				/>
			))}
		</div>
	)
}
