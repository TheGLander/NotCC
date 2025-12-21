import { FC, Suspense } from "preact/compat"
import { twJoin } from "tailwind-merge"

function GalleryItemC(props: {
	selected: boolean
	onClick?: () => void
	id: string
	desc?: string
	onRemove?: () => void
	Preview: FC<{ id: string }>
}) {
	return (
		<div
			class={twJoin(
				"box hover:bg-theme-950  flex w-60 cursor-pointer flex-col",
				props.selected && "bg-theme-950"
			)}
			onClick={props.onClick}
		>
			<props.Preview id={props.id} />
			{props.desc && <span class="text-sm">{props.desc}</span>}
			{props.onRemove && (
				<button
					class="ml-auto mt-auto text-sm"
					onClick={
						props.onRemove &&
						(ev => {
							ev.stopPropagation()
							props.onRemove!()
						})
					}
				>
					Remove
				</button>
			)}
		</div>
	)
}

export interface GalleryItem {
	id: string
	desc?: string
}

export interface GalleryProps {
	chosenItem: string
	onChooseItem: (id: string) => void
	onRemoveItem: (id: string) => void
	defaultItems: GalleryItem[]
	customItems: GalleryItem[]
	Preview: FC<{ id: string }>
}

export function Gallery(props: GalleryProps) {
	return (
		<Suspense fallback="Loading items...">
			<div class="mb-2 flex flex-wrap justify-center gap-2">
				{props.defaultItems.map(item => (
					<GalleryItemC
						selected={item.id === props.chosenItem}
						onClick={() => props.onChooseItem(item.id)}
						id={item.id}
						desc={item.desc}
						Preview={props.Preview}
					/>
				))}
				{props.customItems.map(item => (
					<GalleryItemC
						selected={props.chosenItem === item.id}
						onClick={() => props.onChooseItem(item.id)}
						id={item.id}
						desc={item.desc}
						Preview={props.Preview}
						onRemove={() => props.onRemoveItem(item.id)}
					/>
				))}
			</div>
		</Suspense>
	)
}
