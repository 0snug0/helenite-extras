

// Part of the Downloadrr view; `c` is the context shared by every part (see view.js).
// TODO(ui-kit): an inline overlay on purpose. ui-kit's `form`/`choose` overlays are host-rendered, and the host does not
// render app modals yet (docs/design-system/README.md, "Vault apps"); switch once it does.
export function install(c) {
// The release search is a modal, mounted on the frame's document.body. The frame is only as big as the c.app, so
// while the modal is open the host is asked to lift the frame over the whole window (ui.overlay); the stylesheet is
// already in this document, so it is not read and injected again.
// c.draw() rebuilds everything, so the modal is rebuilt too; its scroll position is carried over.
let modalEl = null;
function closeModal() {
	if (!c.state.panel || c.state.grabbing) return;
	c.state.panel = null;
	c.draw();
}
const onModalKey = e => {
	if (!modalEl || !c.state.panel) return;
	if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "f") {
		e.preventDefault(); e.stopPropagation();
		openFind();
	} else if (e.key === "Escape") {
		e.stopPropagation();
		if (c.state.panel.findOpen) { c.state.panel.findOpen = false; c.state.panel.find = ""; c.redrawModal(); }   // first Escape closes the search bar
		else closeModal();
	}
};
document.addEventListener("keydown", onModalKey, true);
c.component.register(() => { document.removeEventListener("keydown", onModalKey, true); modalEl?.remove(); modalEl = null; setModalScope(false); });
let lastFilms = [];
// Was an Obsidian keymap Scope so Ctrl/Cmd+F reached the modal before the app's page search. In its own frame the
// listener above already sees the key first; what is left is asking the host to lift the frame over the window.
let overlaid = false;
function setModalScope(on) {
	if (on === overlaid) return;
	overlaid = on;
	c.api.ui.overlay(on);
}
function openFind() {
	if (!modalEl || !c.state.panel) return;
	c.state.panel.findOpen = true; c.state.panel.findFocus = true;
	c.redrawModal();
}
c.redrawModal = () => c.drawModal(lastFilms);
function drawModal(films) {
	lastFilms = films;
	const scroll = modalEl?.querySelector(".modal-content")?.scrollTop ?? 0;
	const typing = modalEl?.querySelector(".dl-find-input") === document.activeElement;
	const caret = typing ? document.activeElement.selectionStart : null;
	modalEl?.remove();
	modalEl = null;
	const film = c.state.panel && films.find(f => f.key === c.state.panel.key);
	setModalScope(!!film);
	if (!film) return;
	modalEl = document.body.createDiv({ cls: "modal-container mod-dim" });
	modalEl.createDiv({ cls: "modal-bg" }).addEventListener("click", closeModal);
	const modal = modalEl.createDiv({ cls: "modal downloadrr", attr: { style: "width: min(1000px, 92vw); height: 85vh; display: flex; flex-direction: column;" } });
	const body = modal.createDiv({ cls: "modal-content", attr: { style: "flex: 1; min-height: 0; overflow: auto;" } });
	const panel = c.releasePanel(film);
	if (panel) body.appendChild(panel);
	body.scrollTop = scroll;
	const input = modalEl.querySelector(".dl-find-input");
	if (input && (c.state.panel.findFocus || typing)) {
		input.focus();
		if (c.state.panel.findFocus) input.select(); else input.setSelectionRange(caret, caret);
		c.state.panel.findFocus = false;
	}
}

Object.assign(c, { drawModal });
}
