import { useJotaiFn } from "@/helpers"
import { PromptComponent, showPrompt as showPromptGs } from "@/prompts"
import { ComponentChildren } from "preact"
import { HTMLAttributes } from "preact/compat"
import { useState } from "preact/hooks"
import { Dialog } from "./Dialog"

interface ExplInlineProps {
	children: ComponentChildren
	mode?: "inline"
}
interface ExplDialogProps {
	children: ComponentChildren
	title: string
	mode: "dialog"
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
			header={`Info: ${props.title}`}
			section={<div>{props.children}</div>}
			buttons={[["Ok", () => {}]]}
			onResolve={pProps.onResolve}
		/>
	)

export function Expl(props: ExplDialogProps | ExplInlineProps) {
	const [open, setOpen] = useState(false)
	const showPrompt = useJotaiFn(showPromptGs)
	if (props.mode === "dialog") {
		return (
			<ExplButton
				onClick={ev => {
					ev.stopPropagation()
					showPrompt(ExplPrompt(props))
				}}
			/>
		)
	}
	return (
		<span>
			<ExplButton onClick={() => setOpen(!open)} />
			<span class="text-sm">{open && props.children}</span>
		</span>
	)
}
