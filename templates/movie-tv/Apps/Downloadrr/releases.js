import lib from "./lib.js";
import { RELEASE_SORT_KEY } from "./consts.js";
import { button, emptyState, errorState, loadingState, table } from "./ui-kit.js";

// Part of the Downloadrr view; `c` is the context shared by every part (see view.js).
export function install(c) {
function releasePanel(film) {
	const p = c.state.panel;
	const el = createDiv({ cls: "dl-panel" });
	const head = el.createDiv({ cls: "dl-panel-head" });
	head.createSpan({ cls: "dl-panel-title", text: `Releases for ${film.title}${film.year ? ` (${film.year})` : ""}` });
	button(head, { text: "Refresh", disabled: c.busy(), onClick: () => { c.state.sent.clear(); loadReleases(film, true); } });
	button(head, { text: "Close", disabled: !!c.state.grabbing, onClick: () => { c.state.panel = null; c.draw(); } });

	if (p.notice) el.createDiv({ cls: "dl-notice", text: p.notice });
	if (p.error) errorState(el, p.error);
	if (p.phase === "loading") { loadingState(el, "Searching indexers… this can take a few seconds."); return el; }
	if (p.phase === "error") return el;
	if (!p.releases.length) { emptyState(el, "No releases found."); return el; }
	const sorted = lib.filterReleases(lib.sortReleases(p.releases, p.sortKey, p.sortDir), p.findOpen ? p.find : "");
	const shownCount = sorted.length;
	if (p.findOpen) {
		const bar = el.createDiv({ cls: "dl-findbar" });
		const input = bar.createEl("input", { cls: "dl-find-input", attr: { type: "text", placeholder: "Search releases…", "aria-label": "Search releases", spellcheck: "false" } });
		input.value = p.find ?? "";
		input.addEventListener("input", () => { p.find = input.value; c.redrawModal(); });
		bar.createSpan({ cls: "dl-find-count", text: `${shownCount} of ${p.releases.length}` });
	}
	if (!sorted.length) emptyState(el, "No releases match.");

	const SORTABLE = [["title", "Release"], ["resolution", "Resolution"], ["size", "Size"], ["age", "Age"]];
	const why = r => (r.rejected ? (r.reasons[0] ?? "Rejected by Radarr") : null);
	const t = table(el, {
		className: "dl-table",
		columns: [
			{ key: "title", title: "", className: "dl-cell-title", cell: (r, td) => {
				const w = why(r), tr = td.parentElement;
				if (w) { tr.classList.add("dl-row-rejected"); tr.title = w; }
				td.title = w ? `${r.title}\n${w}` : r.title;
				return r.title;
			} },
			{ key: "resolution", title: "", cell: (r, td) => { td.title = why(r) ? `${r.qualityName}\n${why(r)}` : r.qualityName; return lib.resolutionLabel(r.resolution); } },
			{ key: "size", title: "", cell: r => lib.formatSize(r.size) },
			{ key: "age", title: "", cell: r => lib.formatAge(r.ageHours) },
		],
		rows: sorted,
		actions: (r, cell) => {
			if (p.confirm === r.guid) button(cell, { text: c.state.grabbing === r.guid ? "Sending…" : "Confirm", variant: "primary", disabled: !!c.state.grabbing, onClick: () => grabRelease(film, r) });
			else if (c.state.sent.has(r.guid)) cell.createSpan({ cls: "dl-sent", text: "Sent" });
			else {
				const pick = button(cell, { text: "Select", disabled: !r.allowed || !!c.state.grabbing, onClick: () => { p.confirm = r.guid; p.notice = null; c.draw(); } });
				if (!r.allowed) pick.el.title = "Radarr will not download this release";
			}
		},
	});
	// Sortable headers: the kit writes plain titles; the arrow and click-to-sort are this table's.
	SORTABLE.forEach(([key, label], i) => {
		const th = t.el.tHead.rows[0].cells[i];
		th.classList.add("dl-th");
		th.textContent = label + (p.sortKey === key ? (p.sortDir === "asc" ? " ▲" : " ▼") : "");
		th.addEventListener("click", () => {
			p.sortDir = p.sortKey === key && p.sortDir === "desc" ? "asc" : "desc";
			p.sortKey = key;
			c.app.saveLocalStorage(RELEASE_SORT_KEY, { key: p.sortKey, dir: p.sortDir });
			c.draw();
		});
	});
	return el;
}


function toggleFilm(film) {
	if (c.busy()) return;
	if (c.state.panel?.key === film.key) { c.state.panel = null; c.draw(); return; }
	loadReleases(film, false);
}

// Adds the film to Radarr if needed (unmonitored, no search), then asks Radarr to search the indexers.
async function loadReleases(film, force) {
	const panel = { key: film.key, tmdbId: film.tmdbId, phase: "loading", movieId: null, releases: [], sortKey: "resolution", sortDir: "desc", confirm: null, notice: null, error: null };
	const savedRelease = c.store[RELEASE_SORT_KEY];
	if (savedRelease?.key) Object.assign(panel, { sortKey: savedRelease.key, sortDir: savedRelease.dir === "asc" ? "asc" : "desc" });
	const cached = c.state.cache.get(film.key);
	if (cached && !force) Object.assign(panel, cached, { phase: "ready" });
	c.state.panel = panel;
	c.draw();
	if (panel.phase === "ready") return;
	try {
		const movie = await c.client.ensureMovie(film.tmdbId, c.state.movies);
		if (!c.state.movies.some(m => m.id === movie.id)) c.state.movies = [...c.state.movies, movie];
		panel.movieId = movie.id;
		panel.releases = (await c.client.getReleases(movie.id)).map(lib.normalizeRelease);
		panel.phase = "ready";
		c.state.cache.set(film.key, { movieId: panel.movieId, releases: panel.releases });
	} catch (e) {
		panel.phase = "error";
		panel.error = e.message;
	}
	if (c.state.panel === panel) c.draw();   // the user may have closed or switched films meanwhile
}

async function grabRelease(film, release) {
	const panel = c.state.panel;
	if (!panel || c.state.grabbing) return;
	c.state.grabbing = release.guid;
	panel.error = null;
	c.draw();
	try {
		await c.client.grab({ guid: release.guid, indexerId: release.indexerId, movieId: panel.movieId });
		panel.notice = `Sent to SABnzbd: ${release.title}`;
		panel.confirm = null;
		c.state.sent.add(release.guid);
		c.state.pollUntil = Date.now() + 60000;
		setTimeout(async () => { await c.refreshRadarr(); c.draw(); }, 1500);   // let Radarr put it in its queue first
	} catch (e) {
		panel.error = e.message;
	} finally {
		c.state.grabbing = null;
	}
	if (c.state.panel === panel) c.draw();
}

Object.assign(c, { releasePanel, toggleFilm });
}
