// The "find something new to monitor" box shared by the Movies and TV pages. An ES module.
// Identical in Downloadrr and Downloadrr TV (byte for byte), moved here unchanged.
// Buttons and the empty/error states are @helenite/ui-kit parts (./ui-kit.js).
import { button, callout, emptyState, errorState, mediaCard, mediaGrid, textInput, toolbar } from "./ui-kit.js";
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
		const bar = toolbar(box);
		const input = textInput(bar, { placeholder, label: placeholder, value: st.term, onInput: v => { st.term = v; }, onEnter: () => { run(); } });
		input.classList.add("dl-find-input");
		input.spellcheck = false;
		button(bar, { text: st.busy ? "Searching…" : "Find", disabled: st.busy, onClick: () => { run(); } });
		if (st.results || st.notice || st.error) {
			button(bar, { text: "Clear", onClick: () => { Object.assign(st, { term: "", results: null, error: null, notice: null }); redraw(); } });
		}
		if (st.refocus) { st.refocus = false; if (!st.busy) input.focus(); }
		if (st.notice) callout(box, { tone: "success", text: st.notice }).el.classList.add("dl-notice");
		if (st.error) errorState(box, st.error);
		if (!st.results) return;
		if (!st.results.length) { emptyState(box, `${serviceName} found nothing for "${st.term}".`); return; }
		const grid = mediaGrid(box, { minWidth: 340 });
		grid.classList.add("dl-add-results");
		for (const r of st.results) {
			const card = mediaCard(grid, { art: { title: r.title, src: r.poster }, layout: "row", title: `${r.title}${r.year ? ` (${r.year})` : ""}`, detail: r.overview });
			card.el.classList.add("dl-add-row");
			const done = r.inLibrary && r.monitored;
			button(card.footer, { text: done ? "Monitored" : st.adding === r.key ? "Adding…" : r.inLibrary ? "Monitor" : "Add", disabled: done || !!st.adding, onClick: done ? undefined : () => { addOne(r); } }).el.classList.add("dl-add-btn");
		}
	}

	return { render, state: st };
}

const api = { createAddSearch };
export default api;
export { createAddSearch };
