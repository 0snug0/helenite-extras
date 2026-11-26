import lib from "./lib.js";
import { availabilityLabel } from "../../core/tmdb.js";
import { scoreRow } from "../../core/scores.js";
import { posterCard } from "../../core/posters.js";
import { filterBar } from "../../core/filter-bar.js";
import { AVAIL_TONES } from "../../core/tones.js";
import { SERVICES_KEY, SORT_KEY } from "./consts.js";
import { badge, button, emptyState, errorState, mediaGrid, statusText } from "../../core/ui-kit.js";

// Part of the Movies page; `c` is the context shared by every part (see index.js).
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
	if (!c.alive()) return;
	const box = c.root.querySelector(".dl-textfilter");
	const keep = box && box === document.activeElement ? [box.selectionStart, box.selectionEnd] : null;
	c.root.empty();
	drawBody();
	if (keep) { const b = c.root.querySelector(".dl-textfilter"); b?.focus(); b?.setSelectionRange(...keep); }
}
function drawBody() {
	const known = !c.state.loading && !(c.state.error && c.state.movies.length === 0);
	const films = lib.buildFilms(c.notes, c.state.movies, c.state.queue, known);

	// (Without a Radarr key the page shows its setup state instead of getting here; see index.js.)
	if (c.state.error) errorState(c.root, c.state.error, async () => { await c.refreshRadarr(); c.draw(); });

	c.drawActive(c.root);
	c.addSearch.render(c.root);

	const availOf = f => f.tmdbId && c.state.avail[f.tmdbId];
	const onServices = f => lib.matchesServices(availOf(f), lib.SERVICES.map(([k]) => k));
	filterBar(c.root, {
		query: c.state.query, onQuery: q => { c.state.query = q; c.draw(); },
		filters: lib.FILTERS.map(([id, label]) => ({ value: id, text: `${label} (${films.filter(f => lib.matchesFilter(f, id)).length})` })),
		filter: c.state.filter, onFilter: id => { c.state.filter = id; c.draw(); },
		streaming: c.state.streaming, streamingCount: films.filter(onServices).length,
		onStreaming: () => { c.state.streaming = !c.state.streaming; c.save(SERVICES_KEY, c.state.streaming); c.draw(); },
		sorts: lib.SORTS, sort: c.state.sort, sortLabel: "Sort films",
		onSort: v => { c.state.sort = v; c.save(SORT_KEY, c.state.sort); c.draw(); if (c.state.sort === "release") c.fillDates(); },
	});

	const shown = lib.sortFilms(films, c.state.sort, c.state.dates).filter(f => lib.matchesFilter(f, c.state.filter) && (!c.state.streaming || onServices(f)) && matchesQuery(f));
	if (!shown.length) emptyState(c.root, "No films match this filter.");

	const grid = mediaGrid(c.root);
	grid.classList.add("dl-grid");
	for (const film of shown) {
		const open = c.state.panel?.key === film.key;
		const card = posterCard(grid, { title: film.title, url: film.url, poster: film.poster, site: "Letterboxd", open: c.openUrl(film.url), selected: open, focused: c.state.focus === film.key });
		if (c.state.focus === film.key) card.el.classList.add("media-movies-focus");
		card.el.dataset.filmKey = film.key;

		statusText(card.body, String(film.year ?? ""));
		const when = c.state.sort === "added" ? film.added : c.state.sort === "release" ? lib.releaseExact(film, c.state.dates) : "";
		if (when) statusText(card.body, `${c.state.sort === "added" ? "Added" : "Out"} ${when}`).classList.add("dl-date");
		const avail = availOf(film);
		const availText = availabilityLabel(avail, new Date().toISOString().slice(0, 10));
		if (availText) {
			const el = statusText(card.body, availText, AVAIL_TONES[avail.kind]);
			el.classList.add("dl-avail");
			el.title = "Where to watch in the US (TMDB / JustWatch)";
		}
		const sc = film.tmdbId && c.scoresFor(film.tmdbId);
		scoreRow(card.body, { lb: sc?.lb, rt: sc?.rt, aud: sc?.aud, lbUrl: film.url, rtUrl: sc?.rtUrl, imdb: sc?.imdb, imdbUrl: sc?.imdbUrl }, url => c.api.workspace.openUrl(url));
		if (film.path) button(card.body, { text: film.pending ? "Pending" : "Watchlist", variant: "link", onClick: c.openNote(film.path) }).el.title = film.path;
		else statusText(card.body, "Radarr").title = "Monitored in Radarr, not on the Letterboxd watchlist";

		badge(card.body, ...statusChip(film)).classList.add("dl-chip");

		const radarrMovie = film.tmdbId && c.state.movies.find(m => m.tmdbId === film.tmdbId);
		const find = button(card.footer, { text: open ? "Close" : "Search", disabled: !film.tmdbId || !c.client || !known || c.busy(), onClick: () => { c.toggleFilm(film); } }).el;
		find.classList.add("dl-find");
		if (!film.tmdbId) find.title = "This note has no tmdb_id";
		if (radarrMovie) c.xButton(card.footer, `film:${film.key}`, "Remove from Radarr (deletes any downloaded file) and the watchlist", () => c.removeMovie(radarrMovie, "all"));
		else if (known && c.client) c.xButton(card.footer, `unlist:${film.key}`, "Remove from the watchlist", () => c.unlistFilm(film));   // only once Radarr has said it does not have the film
	}
	c.drawModal(films);
}

Object.assign(c, { draw });
}
