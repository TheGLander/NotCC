import { ComponentChildren } from "preact"
import leafIcon from "./tabIcons/leaf.svg"
import levelIcon from "./tabIcons/level.svg"
import floppyIcon from "./tabIcons/floppy.svg"
import clockIcon from "./tabIcons/clock.svg"
import toolsIcon from "./tabIcons/tools.svg"
import infoIcon from "./tabIcons/info.svg"

function SidebarButton(
	props: { icon: string } | { children: ComponentChildren }
) {
	return (
		<div class="relative flex md:[&:nth-last-child(2)]:mt-auto">
			{"icon" in props ? (
				<img
					tabIndex={0}
					draggable={false}
					src={props.icon}
					class="m-auto block cursor-pointer select-none max-md:h-3/5 md:w-4/5"
				/>
			) : (
				props.children
			)}
		</div>
	)
}

export function Sidebar() {
	return (
		<div class="box flex h-full w-20 flex-col rounded-none p-0 max-md:h-20 max-md:w-full max-md:flex-row md:gap-4 md:py-2">
			<SidebarButton icon={leafIcon} />
			{/* TODO dynamic icon */}
			<SidebarButton icon={levelIcon} />
			<SidebarButton icon={floppyIcon} />
			<SidebarButton icon={clockIcon} />

			<SidebarButton icon={toolsIcon} />
			<SidebarButton icon={infoIcon} />
		</div>
	)
}
