import { normalizeRelease, renderReleaseTable } from "../../core/releases.js";
import { RELEASE_SORT_KEY } from "./consts.js";
import { button, emptyState, errorState, loadingState } from "../../core/ui-kit.js";

// Part of the Movies page; `c` is the context shared by every part (see index.js).
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
	renderReleaseTable(el, {
		p, releases: p.releases, state: c.state, service: "Radarr",
		onGrab: r => grabRelease(film, r),
		draw: () => c.draw(), redrawModal: () => c.redrawModal(),
		saveSort: v => c.save(RELEASE_SORT_KEY, v),
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
		panel.releases = (await c.client.getReleases(movie.id)).map(normalizeRelease);
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
		c.later(async () => { await c.refreshRadarr(); c.draw(); }, 1500);   // let Radarr put it in its queue first
	} catch (e) {
		panel.error = e.message;
	} finally {
		c.state.grabbing = null;
	}
	if (c.state.panel === panel) c.draw();
}

Object.assign(c, { releasePanel, toggleFilm, loadReleases });
}
