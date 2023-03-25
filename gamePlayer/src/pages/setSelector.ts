import { parseC2M } from "@notcc/logic"
import { Pager } from "../pager"
import stubLevel from "../data/NotCC.c2m"
import { levelPlayerPage } from "./levelPlayer"

export const setSelectorPage = {
	pageId: "setSelectorPage",
	async loadStubLevel(pager: Pager): Promise<void> {
		const levelBin = await (await fetch(stubLevel)).arrayBuffer()
		const level = parseC2M(levelBin, "NotCC.c2m")
		pager.loadedLevel = level
		pager.openPage(levelPlayerPage)
	},
	setupPage(pager: Pager, page: HTMLElement): void {
		page
			.querySelector<HTMLButtonElement>("#loadDefaultLevel")!
			.addEventListener("click", () => {
				this.loadStubLevel(pager)
			})
	},
}
