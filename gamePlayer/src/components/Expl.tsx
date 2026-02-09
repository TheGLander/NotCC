import { useJotaiFn } from "@/helpers"
import { PromptComponent, showPromptGs } from "@/prompts"
import { ComponentChildren } from "preact"
import { HTMLAttributes } from "preact/compat"
import { Dialog } from "./Dialog"

interface ExplDialogProps {
	children: ComponentChildren
	title?: ComponentChildren
}

function ExplButton(props: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			class="bg-theme-600 text-theme-900 relative mx-1 inline-block h-4 w-4 cursor-default select-none rounded-full pl-[1px] text-center font-bold [line-height:1em]"
			{...props}
		>
			?
		</div>
	)
}

const ExplPrompt =
	(props: ExplDialogProps): PromptComponent<void> =>
	pProps => (
		<Dialog
			header={<>Expl{props.title && <>: {props.title}</>}</>}
			buttons={[["Ok", () => {}]]}
			onResolve={pProps.onResolve}
		>
			<div>{props.children}</div>
		</Dialog>
	)

export function Expl(props: ExplDialogProps) {
	const showPrompt = useJotaiFn(showPromptGs)
	return (
		<ExplButton
			onClick={ev => {
				ev.stopPropagation()
				showPrompt(ExplPrompt(props))
			}}
		/>
	)
}
