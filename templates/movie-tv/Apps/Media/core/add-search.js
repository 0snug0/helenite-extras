// The "find something new to monitor" box shared by the Movies and TV pages. An ES module.
// Identical in Downloadrr and Downloadrr TV (byte for byte), moved here unchanged.
// Buttons and the empty/error states are @helenite/ui-kit parts (./ui-kit.js).
import { button, emptyState, errorState } from "./ui-kit.js";
//
// createAddSearch({ placeholder, lookup, add, redraw, serviceName })
//   lookup(term) -> [{ key, title, year, overview, poster, inLibrary, monitored }]   (read-only)
//   add(result)  -> adds it to the service, monitored and not searched (or just monitors it when inLibrary)
//   redraw()     -> the page redraws; it calls render(parent) again, so the state lives here, not in the DOM.
function createAddSearch({ placeholder, lookup, add, redraw, serviceName }) {
	const st = { term: "", busy: false, results: null, error: null, notice: null, adding: null, refocus: false };

	async function run() {
		const term = st.term.trim();
		if (!term || st.busy) return;
		st.busy = true; st.error = null; st.notice = null; st.refocus = true;
		redraw();
		try { st.results = (await lookup(term)).slice(0, 12); }
		catch (e) { st.error = e.message; st.results = null; }
		st.busy = false; st.refocus = true;
		redraw();
	}

	async function addOne(r) {
		if (st.adding) return;
		st.adding = r.key; st.error = null; st.notice = null;
		redraw();
		try {
			await add(r);
			r.inLibrary = true; r.monitored = true;
			st.notice = `${r.title}${r.year ? ` (${r.year})` : ""} is on the monitor list. Nothing is downloading: use its card's Search to pick a release.`;
		} catch (e) { st.error = e.message; }
		st.adding = null;
		redraw();
	}

	function render(parent) {
		const box = parent.createDiv({ cls: "dl-add" });
		const bar = box.createDiv({ cls: "dl-add-bar" });
		const input = bar.createEl("input", { cls: "dl-find-input", attr: { type: "text", placeholder, "aria-label": placeholder, spellcheck: "false" } });
		input.value = st.term;
		input.addEventListener("input", () => { st.term = input.value; });
		input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); run(); } });
		button(bar, { text: st.busy ? "Searching…" : "Find", disabled: st.busy, onClick: () => { run(); } });
		if (st.results || st.notice || st.error) {
			button(bar, { text: "Clear", onClick: () => { Object.assign(st, { term: "", results: null, error: null, notice: null }); redraw(); } });
		}
		if (st.refocus) { st.refocus = false; if (!st.busy) input.focus(); }
		if (st.notice) box.createDiv({ cls: "dl-notice", text: st.notice });
		if (st.error) errorState(box, st.error);
		if (!st.results) return;
		if (!st.results.length) { emptyState(box, `${serviceName} found nothing for "${st.term}".`); return; }
		const grid = box.createDiv({ cls: "dl-add-results" });
		for (const r of st.results) {
			const row = grid.createDiv({ cls: "dl-add-row" });
			const art = row.createDiv({ cls: "dl-add-poster", attr: { role: "img", "aria-label": r.title } });
			if (r.poster) art.style.backgroundImage = `url("${r.poster}")`;
			const info = row.createDiv({ cls: "dl-add-info" });
			info.createDiv({ cls: "dl-add-title", text: `${r.title}${r.year ? ` (${r.year})` : ""}` });
			if (r.overview) info.createDiv({ cls: "dl-add-overview", text: r.overview });
			const done = r.inLibrary && r.monitored;
			button(row, { text: done ? "Monitored" : st.adding === r.key ? "Adding…" : r.inLibrary ? "Monitor" : "Add", disabled: done || !!st.adding, onClick: done ? undefined : () => { addOne(r); } }).el.classList.add("dl-add-btn");
		}
	}

	return { render, state: st };
}

const api = { createAddSearch };
export default api;
export { createAddSearch };
