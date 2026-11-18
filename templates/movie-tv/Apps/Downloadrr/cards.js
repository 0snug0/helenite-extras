import lib from "./lib.js";
import * as fl from "./films.js";
import { SERVICES_KEY, SORT_KEY } from "./consts.js";
import { badge, button, emptyState, errorState, segmented } from "./ui-kit.js";

// Part of the Downloadrr view; `c` is the context shared by every part (see view.js).
export function install(c) {
// The card's status, as a ui-kit badge: [text, tone].
const TONES = { "no-id": "danger", "in-radarr": "accent", downloaded: "success", downloading: "accent" };
function statusChip(film) {
	const s = film.status;
	if (s.kind === "unknown") return [c.state.loading ? "Checking Radarr" : "Radarr status unknown", "default"];
	const text = { "no-id": "No movie id", missing: "Not in Radarr", "in-radarr": "In Radarr", downloaded: "Downloaded" }[s.kind] ?? `Downloading ${s.percent}%`;
	return [text, TONES[s.kind] ?? "default"];
}

// Title (and year) filter from the box in the filter bar; every word has to match.
const matchesQuery = f => { const t = `${f.title ?? ""} ${f.year ?? ""}`.toLowerCase(); return c.state.query.toLowerCase().split(/\s+/).filter(Boolean).every(w => t.includes(w)); };
// Ctrl/Cmd+F on this page focuses the filter box. The c.app has its own document, so a plain listener sees the key
// before anything else and there is no host find to fight (the old per-page window global and refocus timers are gone).
// It only fires while focus is inside the app's frame.
{
	const onFind = e => {
		if (!(e.metaKey || e.ctrlKey) || e.altKey || (e.key || "").toLowerCase() !== "f" || c.state.panel) return;
		const b = c.root.querySelector(".dl-textfilter");
		if (!b) return;
		e.preventDefault();
		b.focus(); b.select();
	};
	document.addEventListener("keydown", onFind, true);
	c.component.register(() => document.removeEventListener("keydown", onFind, true));
}
// The text filter box lives in c.draw()'s output, which is rebuilt often (every poll): keep focus and caret across it.
function draw() {
	const box = c.root.querySelector(".dl-textfilter");
	const keep = box && box === document.activeElement ? [box.selectionStart, box.selectionEnd] : null;
	c.root.empty();
	drawBody();
	if (keep) { const b = c.root.querySelector(".dl-textfilter"); b?.focus(); b?.setSelectionRange(...keep); }
}
function drawBody() {
	const known = !c.state.loading && !(c.state.error && c.state.movies.length === 0);
	const films = lib.buildFilms(c.notes, c.state.movies, c.state.queue, known);

	if (c.state.error) {
		if (c.client) errorState(c.root, c.state.error, async () => { await c.refreshRadarr(); c.draw(); });
		// The key is typed into Helenite's own dialog, never into the app; the host reloads the app once it is saved.
		else button(errorState(c.root, c.state.error), { text: "Set Radarr API key…", onClick: () => c.api.secrets.prompt("RADARR_API_KEY") });
	}

	c.drawActive(c.root);
	c.addSearch.render(c.root);

	const bar = c.root.createDiv({ cls: "dl-filters" });
	const find = bar.createEl("input", { cls: "dl-textfilter", attr: { type: "search", placeholder: "Filter by title (Ctrl/Cmd+F)", "aria-label": "Filter by title", spellcheck: "false" } });
	find.value = c.state.query;
	find.addEventListener("input", () => { c.state.query = find.value; c.draw(); });
	find.addEventListener("keydown", e => { if (e.key === "Escape" && c.state.query) { c.state.query = ""; c.draw(); c.root.querySelector(".dl-textfilter")?.focus(); } });
	segmented(bar, {
		options: lib.FILTERS.map(([id, label]) => ({ value: id, text: `${label} (${films.filter(f => lib.matchesFilter(f, id)).length})` })),
		value: c.state.filter,
		onChange: id => { c.state.filter = id; c.draw(); },
	});
	const availOf = f => f.tmdbId && c.state.avail[f.tmdbId];
	{
		const n = films.filter(f => lib.matchesServices(availOf(f), lib.SERVICES.map(([k]) => k))).length;
		button(bar, { text: `My streaming (${n})`, pressed: c.state.streaming, onClick: () => { c.state.streaming = !c.state.streaming; c.app.saveLocalStorage(SERVICES_KEY, c.state.streaming); c.draw(); } }).el.title = "Streaming on Netflix, HBO, Apple TV or Amazon";
	}
	const sort = bar.createEl("select", { cls: "dl-sort dropdown", attr: { "aria-label": "Sort films" } });
	for (const [id, label] of lib.SORTS) sort.createEl("option", { text: label, attr: { value: id, ...(c.state.sort === id ? { selected: "" } : {}) } });
	sort.addEventListener("change", () => { c.state.sort = sort.value; c.app.saveLocalStorage(SORT_KEY, c.state.sort); c.draw(); if (c.state.sort === "release") c.fillDates(); });

	const shown = lib.sortFilms(films, c.state.sort, c.state.dates).filter(f => lib.matchesFilter(f, c.state.filter) && (!c.state.streaming || lib.matchesServices(availOf(f), lib.SERVICES.map(([k]) => k))) && matchesQuery(f));
	if (!shown.length) emptyState(c.root, "No films match this filter.");

	const grid = c.root.createDiv({ cls: "dl-grid" });
	for (const film of shown) {
		const open = c.state.panel?.key === film.key;
		const card = grid.createDiv({ cls: `dl-card${open ? " dl-card-open" : ""}` });

		// A div with a background image, not an <img>: Minimal zooms any img:active on click.
		const link = card.createEl("a", { cls: "dl-poster-link", attr: { href: film.url ?? "#", title: film.title } });
		if (film.url) link.addEventListener("click", c.openUrl(film.url));
		const art = link.createDiv({ cls: "dl-poster", attr: { role: "img", "aria-label": `${film.title} on Letterboxd` } });
		if (film.poster) art.style.backgroundImage = `url("${film.poster}")`;
		else { art.addClass("dl-poster-missing"); art.setText(film.title); }

		card.createDiv({ cls: "dl-year", text: String(film.year ?? "") });
		const when = c.state.sort === "added" ? film.added : c.state.sort === "release" ? lib.releaseExact(film, c.state.dates) : "";
		if (when) card.createDiv({ cls: "dl-date", text: `${c.state.sort === "added" ? "Added" : "Out"} ${when}` });
		const avail = film.tmdbId && c.state.avail[film.tmdbId];
		const availText = lib.availabilityLabel(avail, new Date().toISOString().slice(0, 10));
		if (availText) card.createDiv({ cls: `dl-avail dl-avail-${avail.kind}`, text: availText, attr: { title: "Where to watch in the US (TMDB / JustWatch)" } });
		const sc = film.tmdbId && c.scoresFor(film.tmdbId);
		fl.scoreRow(card, { lb: sc?.lb, rt: sc?.rt, aud: sc?.aud, lbUrl: film.url, rtUrl: sc?.rtUrl, imdb: sc?.imdb, imdbUrl: sc?.imdbUrl }, url => c.api.workspace.openUrl(url));
		const tag = card.createDiv({ cls: "dl-source" });
		if (film.path) tag.createEl("a", { text: film.pending ? "Pending" : "Watchlist", attr: { href: "#", title: film.path } }).addEventListener("click", c.openNote(film.path));
		else tag.createSpan({ text: "Radarr", attr: { title: "Monitored in Radarr, not on the Letterboxd watchlist" } });

		badge(card, ...statusChip(film)).classList.add("dl-chip");

		const radarrMovie = film.tmdbId && c.state.movies.find(m => m.tmdbId === film.tmdbId);
		const row = card.createDiv({ cls: "dl-btn-row" });
		const find = button(row, { text: open ? "Close" : "Search", disabled: !film.tmdbId || !c.client || !known || c.busy(), onClick: () => { c.toggleFilm(film); } }).el;
		find.classList.add("dl-find");
		if (!film.tmdbId) find.title = "This note has no tmdb_id";
		if (radarrMovie) c.xButton(row, `film:${film.key}`, "Remove from Radarr (deletes any downloaded file) and the watchlist", () => c.removeMovie(radarrMovie, "all"));
		else if (known && c.client) c.xButton(row, `unlist:${film.key}`, "Remove from the watchlist", () => c.unlistFilm(film));   // only once Radarr has said it does not have the film
	}
	c.drawModal(films);
}

Object.assign(c, { draw });
}
