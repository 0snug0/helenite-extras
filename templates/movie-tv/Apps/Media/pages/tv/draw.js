// Part of the TV page: the page itself (error, active table, "find a show", filter bar and the show cards). `c` is the context
// shared by every part (see index.js).
import lib from "./lib.js";
import { KEYS } from "./consts.js";
import { badge, button, emptyState, errorState, segmented } from "../../core/ui-kit.js";
import { scoreRow } from "../../core/scores.js";
import { renderPoster } from "../../core/posters.js";
import { availabilityLabel } from "../../core/tmdb.js";
import { matchesServices } from "../../core/rows.js";
import { showState } from "../../core/plex.js";

export function install(c) {
	const { state, api, notes, root } = c;
	const drawModal = (...a) => c.drawModal(...a);
	const openUrl = (...a) => c.openUrl(...a);
	const openNote = (...a) => c.openNote(...a);
	const busy = (...a) => c.busy(...a);
	const today = (...a) => c.today(...a);
	const availOf = (...a) => c.availOf(...a);
	const myServices = (...a) => c.myServices(...a);
	const plexOf = (...a) => c.plexOf(...a);
	const refreshSonarr = (...a) => c.refreshSonarr(...a);
	const xButton = (...a) => c.xButton(...a);
	const removeSeries = (...a) => c.removeSeries(...a);
	const unlistShow = (...a) => c.unlistShow(...a);
	const toggleShow = (...a) => c.toggleShow(...a);
	const drawActive = (...a) => c.drawActive(...a);
	// The card's status, as a ui-kit badge: [text, tone].
	const TONES = { "in-sonarr": "accent", downloaded: "success", downloading: "accent" };
	function statusChip(show) {
		const s = show.status;
		if (s.kind === "unknown") return [state.loading ? "Checking Sonarr" : "Sonarr status unknown", "default"];
		const text = { missing: "Not in Sonarr", "in-sonarr": "In Sonarr", downloaded: `Downloaded ${s.files}/${s.total}` }[s.kind] ?? `Downloading ${s.percent}%`;
		return [text, TONES[s.kind] ?? "default"];
	}

	// Title (and year) filter from the box in the filter bar; every word has to match.
	const matchesQuery = f => { const t = `${f.title ?? ""} ${f.year ?? ""}`.toLowerCase(); return state.query.toLowerCase().split(/\s+/).filter(Boolean).every(w => t.includes(w)); };
	// Ctrl/Cmd+F focuses the filter box. The app has its own document, so a plain listener sees the key before anything else
	// (the vault's per-page window global and refocus timers fought Obsidian's find; there is none here). Only while no modal is open.
	{
		const onFind = e => {
			if (!(e.metaKey || e.ctrlKey) || e.altKey || (e.key || "").toLowerCase() !== "f" || state.panel) return;
			const b = root.querySelector(".dl-textfilter");
			if (!b) return;
			e.preventDefault();
			b.focus(); b.select();
		};
		document.addEventListener("keydown", onFind, true);
		c.component.register(() => document.removeEventListener("keydown", onFind, true));
	}
	// The text filter box lives in draw()'s output, which is rebuilt often (every poll): keep focus and caret across it.
	function draw() {
		const box = root.querySelector(".dl-textfilter");
		const keep = box && box === document.activeElement ? [box.selectionStart, box.selectionEnd] : null;
		root.empty();
		drawBody();
		if (keep) { const b = root.querySelector(".dl-textfilter"); b?.focus(); b?.setSelectionRange(...keep); }
	}
	function drawBody() {
		const known = !state.loading && !(state.error && state.series.length === 0);
		const shows = lib.buildShows(notes, state.series, state.queue, known, state.ids);

		if (state.error) {
			errorState(root, state.error, c.client ? async () => { await refreshSonarr(); draw(); } : undefined);
		}

		drawActive(root);
		c.addSearch.render(root);

		const bar = root.createDiv({ cls: "dl-filters" });
		const find = bar.createEl("input", { cls: "dl-textfilter", attr: { type: "search", placeholder: "Filter by title (Ctrl/Cmd+F)", "aria-label": "Filter by title", spellcheck: "false" } });
		find.value = state.query;
		find.addEventListener("input", () => { state.query = find.value; draw(); });
		find.addEventListener("keydown", e => { if (e.key === "Escape" && state.query) { state.query = ""; draw(); root.querySelector(".dl-textfilter")?.focus(); } });
		segmented(bar, {
			options: lib.FILTERS.map(([id, label]) => ({ value: id, text: `${label} (${shows.filter(f => lib.matchesFilter(f, id)).length})` })),
			value: state.filter,
			onChange: id => { state.filter = id; draw(); },
		});
		{
			const n = shows.filter(f => matchesServices(availOf(f), myServices())).length;
			button(bar, { text: `My streaming (${n})`, pressed: state.streaming, onClick: () => { state.streaming = !state.streaming; c.save(KEYS.services, state.streaming); draw(); } }).el.title = "Streaming on Netflix, HBO, Apple TV or Amazon";
		}
		const sort = bar.createEl("select", { cls: "dl-sort dropdown", attr: { "aria-label": "Sort shows" } });
		for (const [id, label] of lib.SORTS) sort.createEl("option", { text: label, attr: { value: id, ...(state.sort === id ? { selected: "" } : {}) } });
		sort.addEventListener("change", () => { state.sort = sort.value; c.save(KEYS.sort, state.sort); draw(); });

		const shown = lib.sortShows(shows, state.sort).filter(f => lib.matchesFilter(f, state.filter) && (!state.streaming || matchesServices(availOf(f), myServices())) && matchesQuery(f));
		if (!shown.length) emptyState(root, notes.length ? "No shows match this filter." : "No TV shows on your Serializd lists or pending.");

		const grid = root.createDiv({ cls: "dl-grid" });
		for (const show of shown) {
			const open = state.panel?.key === show.key;
			const card = grid.createDiv({ cls: `dl-card${open ? " dl-card-open" : ""}${state.focus === show.key ? " media-tv-focus" : ""}`, attr: { "data-show-key": show.key } });

			// A div with a background image, not an <img>: Minimal zooms any img:active on click.
			const { link } = renderPoster(card, { title: show.title, url: show.url, poster: show.poster, site: "Serializd" });
			if (show.url) link.addEventListener("click", openUrl(show.url));

			card.createDiv({ cls: "dl-year", text: String(show.year ?? "") });
			if (state.sort === "added" && show.added) card.createDiv({ cls: "dl-date", text: `Added ${show.added}` });
			const avail = availOf(show);
			const availText = availabilityLabel(avail, today());
			if (availText) card.createDiv({ cls: `dl-avail dl-avail-${avail.kind}`, text: availText, attr: { title: "Where to watch in the US (TMDB / JustWatch)" } });
			const sc = show.tvdbId && state.scores[show.tvdbId];
			scoreRow(card, { lb: sc?.sz, lbTip: "Serializd average, out of 5", lbDigits: 2, rt: sc?.rt, aud: sc?.aud, lbUrl: show.url, rtUrl: sc?.rtUrl, imdb: sc?.imdb, imdbUrl: sc?.imdbUrl }, url => api.workspace.openUrl(url));
			const tag = card.createDiv({ cls: "dl-source" });
			if (show.path) tag.createEl("a", { text: show.pending ? "Pending" : show.watching ? "Watching" : "Watchlist", attr: { href: "#", title: show.path } }).addEventListener("click", openNote(show.path));
			else tag.createSpan({ text: "Sonarr", attr: { title: "In Sonarr, not on a Serializd list" } });

			badge(card, ...statusChip(show)).classList.add("dl-chip");
			const ps = showState(plexOf(show));
			if (ps.kind !== "none") {
				const b = badge(card, ps.kind === "watched" ? "Watched" : `Watching ${ps.watched}/${ps.total}`, ps.kind === "watched" ? "success" : "accent");
				b.classList.add("dl-chip");
				b.title = "Your progress in Plex";
			}

			const row = card.createDiv({ cls: "dl-btn-row" });
			const searchable = !!(show.tvdbId || show.tmdbId);
			const find = button(row, { text: open ? "Close" : "Search", disabled: !searchable || !c.client || !known || busy(), onClick: () => { toggleShow(show); } }).el;
			find.classList.add("dl-find");
			if (!searchable) find.title = known ? "Sonarr's lookup found no match for this title" : "Waiting for Sonarr";
			if (show.series) xButton(row, `show:${show.key}`, "Remove from Sonarr (deletes any downloaded files) and the watchlist", () => removeSeries(show.series, "all"));
			else if (known && c.client) xButton(row, `unlist:${show.key}`, "Remove from the watchlist", () => unlistShow(show));   // only once Sonarr has said it does not have the show
		}
		drawModal(shows);
	}

	Object.assign(c, { statusChip, draw, drawBody });
}
