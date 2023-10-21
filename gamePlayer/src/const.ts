import { Renderer, ArtContext, SpecialArt } from "./renderer"
import { Actor } from "@notcc/logic"
import { Page } from "./pager"

export const stateFuncs: Record<string, (actor: Actor) => string> = {}

export function registerStateFunction<T>(
	id: string,
	func: (actor: T) => string
): void {
	stateFuncs[id] = func as (typeof stateFuncs)[string]
}

export const specialFuncs: Record<
	string,
	(this: Renderer, ctx: ArtContext, art: SpecialArt) => void
> = {}

export function registerSpecialFunction<T>(
	id: string,
	func: (
		this: Renderer,
		ctx: ArtContext & { actor: T },
		art: SpecialArt
	) => void
): void {
	specialFuncs[id] = func as (typeof specialFuncs)[string]
}

export const pages: Record<string, Page> = {}
export function registerPage(page: Page): void {
	if (page.pagePath !== null) {
		pages[page.pagePath] = page
	}
}
