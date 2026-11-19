// The release-picker modal shared by the Movies and TV pages: a dialog mounted on document.body, rebuilt on every draw.
// Lifted from Downloadrr/modal.js and DownloadrrTV/modal.js, which are the same code over different context shapes
// (`c.state` + `c.drawModal` vs `ctx.state` + `ctx.modal.el`); this keeps the TV shape's explicit parameters.
// TODO(ui-kit): an inline overlay on purpose. ui-kit's `form`/`choose` overlays are host-rendered, and the host does not
// render app modals yet (docs/design-system/README.md, "Vault apps"); switch once it does.
//
// createReleaseModal({ state, api, draw, releasePanel, register }) -> { el(), closeModal, drawModal, redrawModal }
//   state         the page's state; the modal is open while state.panel is set (state.panel.key is the item's key,
//                 findOpen/find/findFocus drive the Ctrl+F bar) and cannot be closed while state.grabbing
//   api           the host API (api.ui.overlay lifts the frame over the whole window while the modal is open)
//   draw()        redraws the page (which calls drawModal(items) again)
//   releasePanel(item) -> the panel element to show for a film/show
//   register(fn)  registers a disposer, run when the page is unmounted
// drawModal(items): items is the page's list of films/shows; the modal shows the one whose key is state.panel.key.
// Needs createDiv (host element helpers) and a document.

export function createReleaseModal({ state, api, draw, releasePanel, register }) {
	let modalEl = null;
	// draw() rebuilds everything, so the modal is rebuilt too; its scroll position is carried over.
	function closeModal() {
		if (!state.panel || state.grabbing) return;
		state.panel = null;
		draw();
	}
	const onModalKey = e => {
		if (!modalEl || !state.panel) return;
		if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "f") {
			e.preventDefault(); e.stopPropagation();
			openFind();
		} else if (e.key === "Escape") {
			e.stopPropagation();
			if (state.panel.findOpen) { state.panel.findOpen = false; state.panel.find = ""; redrawModal(); }   // first Escape closes the search bar
			else closeModal();
		}
	};
	document.addEventListener("keydown", onModalKey, true);
	register(() => { document.removeEventListener("keydown", onModalKey, true); modalEl?.remove(); modalEl = null; setModalScope(false); });
	// Was an Obsidian keymap Scope (so Ctrl/Cmd+F reached the modal before the page search). The app has its own document, so the
	// listener above already sees the key first; what is left is asking the host to lift the frame over the window.
	let overlaid = false;
	function setModalScope(on) {
		if (on === overlaid) return;
		overlaid = on;
		api.ui.overlay(on);
	}
	let lastItems = [];
	function openFind() {
		if (!modalEl || !state.panel) return;
		state.panel.findOpen = true; state.panel.findFocus = true;
		redrawModal();
	}
	const redrawModal = () => drawModal(lastItems);
	function drawModal(items) {
		lastItems = items;
		const scroll = modalEl?.querySelector(".modal-content")?.scrollTop ?? 0;
		const typing = modalEl?.querySelector(".dl-find-input") === document.activeElement;
		const caret = typing ? document.activeElement.selectionStart : null;
		modalEl?.remove();
		modalEl = null;
		const item = state.panel && items.find(f => f.key === state.panel.key);
		setModalScope(!!item);
		if (!item) return;
		modalEl = document.body.createDiv({ cls: "modal-container mod-dim" });
		modalEl.createDiv({ cls: "modal-bg" }).addEventListener("click", closeModal);
		const modal = modalEl.createDiv({ cls: "modal downloadrr", attr: { style: "width: min(1000px, 92vw); height: 85vh; display: flex; flex-direction: column;" } });
		const body = modal.createDiv({ cls: "modal-content", attr: { style: "flex: 1; min-height: 0; overflow: auto;" } });
		const panel = releasePanel(item);
		if (panel) body.appendChild(panel);
		body.scrollTop = scroll;
		const input = modalEl.querySelector(".dl-find-input");
		if (input && (state.panel.findFocus || typing)) {
			input.focus();
			if (state.panel.findFocus) input.select(); else input.setSelectionRange(caret, caret);
			state.panel.findFocus = false;
		}
	}

	return { el: () => modalEl, closeModal, drawModal, redrawModal };
}
