// Downloadrr TV: modal. Ported from the vault's downloadrr_tv/view.js; `ctx` is the shared view context built in view.js.
// TODO(ui-kit): an inline overlay on purpose. ui-kit's `form`/`choose` overlays are host-rendered, and the host does not
// render app modals yet (docs/design-system/README.md, "Vault apps"); switch once it does.

export function install(ctx) {
	const { state, api } = ctx;
	const M = ctx.modal;
	const draw = (...a) => ctx.draw(...a);
	const releasePanel = (...a) => ctx.releasePanel(...a);
	// The release search is a modal over the whole page, mounted on document.body like Obsidian's own modals.
	// draw() rebuilds everything, so the modal is rebuilt too; its scroll position is carried over.
	function closeModal() {
		if (!state.panel || state.grabbing) return;
		state.panel = null;
		draw();
	}
	const onModalKey = e => {
		if (!M.el || !state.panel) return;
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
	ctx.register(() => { document.removeEventListener("keydown", onModalKey, true); M.el?.remove(); M.el = null; setModalScope(false); });
	// Was an Obsidian keymap Scope (so Ctrl/Cmd+F reached the modal before the page search). The app has its own document, so the
	// listener above already sees the key first; what is left is asking the host to lift the frame over the window.
	let overlaid = false;
	function setModalScope(on) {
		if (on === overlaid) return;
		overlaid = on;
		api.ui.overlay(on);
	}
	let lastShows = [];
	function openFind() {
		if (!M.el || !state.panel) return;
		state.panel.findOpen = true; state.panel.findFocus = true;
		redrawModal();
	}
	const redrawModal = () => drawModal(lastShows);
	function drawModal(shows) {
		lastShows = shows;
		const scroll = M.el?.querySelector(".modal-content")?.scrollTop ?? 0;
		const typing = M.el?.querySelector(".dl-find-input") === document.activeElement;
		const caret = typing ? document.activeElement.selectionStart : null;
		M.el?.remove();
		M.el = null;
		const show = state.panel && shows.find(f => f.key === state.panel.key);
		setModalScope(!!show);
		if (!show) return;
		M.el = document.body.createDiv({ cls: "modal-container mod-dim" });
		M.el.createDiv({ cls: "modal-bg" }).addEventListener("click", closeModal);
		const modal = M.el.createDiv({ cls: "modal downloadrr", attr: { style: "width: min(1000px, 92vw); height: 85vh; display: flex; flex-direction: column;" } });
		const body = modal.createDiv({ cls: "modal-content", attr: { style: "flex: 1; min-height: 0; overflow: auto;" } });
		const panel = releasePanel(show);
		if (panel) body.appendChild(panel);
		body.scrollTop = scroll;
		const input = M.el.querySelector(".dl-find-input");
		if (input && (state.panel.findFocus || typing)) {
			input.focus();
			if (state.panel.findFocus) input.select(); else input.setSelectionRange(caret, caret);
			state.panel.findFocus = false;
		}
	}

	Object.assign(ctx, { closeModal, drawModal, redrawModal });
}
