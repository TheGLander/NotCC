const simpleDialog = document.querySelector<HTMLDialogElement>("#simpleDialog")!

export async function showAlert(body: string, title?: string): Promise<void> {
	await showChoice(body, [["ok", "Ok"]], title)
}

export function makeChoiceDialog(
	body: string,
	buttons: [key: string, text: string][],
	title?: string
): HTMLDialogElement {
	const dialog = simpleDialog.cloneNode(true) as HTMLDialogElement
	document.body.appendChild(dialog)

	const headerEl = dialog.querySelector("header")!
	const sectionEl = dialog.querySelector("section")!
	const footerEl = dialog.querySelector("footer")!

	if (title !== undefined) {
		headerEl.textContent = title
	}
	sectionEl.innerHTML = body.replace("\n", "<br/>")

	for (const [key, text] of buttons) {
		const button = document.createElement("button")
		button.textContent = text
		button.value = key
		button.type = "submit"
		footerEl.appendChild(button)
	}
	return dialog
}

export function waitForDialogSubmit(
	dialog: HTMLDialogElement
): Promise<string> {
	return new Promise(res => {
		dialog.addEventListener("submit", () => {
			res(dialog.returnValue)
			dialog.remove()
		})
	})
}

export function showChoice<I extends string>(
	body: string,
	buttons: [key: I, text: string][],
	title?: string
): Promise<I> {
	const dialog = makeChoiceDialog(body, buttons, title)
	dialog.showModal()
	return waitForDialogSubmit(dialog) as Promise<I>
}
