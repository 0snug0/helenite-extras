// Part of the TV page: Sonarr refresh, id lookups, removals, the show panel, monitoring and grabs. `c` is the context shared
// by every part (see index.js).
import lib from "./lib.js";
import { KEYS } from "./consts.js";
import { SERVICES } from "../../core/rows.js";

export function install(c) {
	const { state, api, notes } = c;
	const draw = (...a) => c.draw(...a);
	const loadPlexEpisodes = (...a) => c.loadPlexEpisodes(...a);
	const tmdbOf = show => show.series?.tmdbId || show.tmdbId || state.ids[show.path]?.tmdbId || null;
	const availOf = show => { const id = tmdbOf(show); return id ? state.avail[id] : undefined; };
	const myServices = () => SERVICES.map(([k]) => k);

	const busy = () => state.grabbing || state.panel?.phase === "loading";
	const openUrl = url => e => { e.preventDefault(); e.stopPropagation(); api.workspace.openUrl(url); };
	const openNote = path => e => { e.preventDefault(); api.workspace.openNote(path, { newTab: e.metaKey || e.ctrlKey }); };
	async function refreshSonarr() {
		if (!c.client) return;
		try {
			const [series, queue, free] = await Promise.all([c.client.getSeries(), c.client.getQueue(), c.client.getFreeSpace().catch(() => null)]);
			state.series = series;
			state.free = free;
			state.queue = queue;
			state.error = null;
			c.ctx.setStatus?.("sonarr", "ok");
			const p = state.panel;
			await Promise.all([...state.open].map(id => loadTree(id)));   // the on-disk trees follow imports and deletes
			if (p?.phase === "ready" && p.seriesId) p.episodes = await c.client.getEpisodes(p.seriesId).catch(() => p.episodes);   // files arrive as downloads import
		} catch (e) {
			state.error = e.message;
			c.ctx.setStatus?.("sonarr", "down");
		}
	}

	// Notes Sonarr does not hold yet: one read-only lookup each (title + year), saved so it only happens once per note.
	// It gives the card its tvdb id for the release search and a poster when the note has none.
	async function resolveIds() {
		if (!c.client) return;
		const need = notes.filter(n => !lib.matchSeries(n, state.series, state.ids) && !state.ids[n.path]);
		let done = 0;
		for (const n of need) {
			try {
				const results = await c.client.lookup(n.tmdbId ? `tmdb:${n.tmdbId}` : n.title);
				const hit = lib.pickLookup(n, results);
				if (hit?.tvdbId) { state.ids[n.path] = { tvdbId: hit.tvdbId, tmdbId: hit.tmdbId || null, title: hit.title, poster: lib.posterOf(hit) }; done++; }
			} catch (e) { state.error = e.message; break; }
		}
		if (done) await c.ctx.store.set(KEYS.ids, state.ids).catch(e => console.error(e));
	}
	const today = () => new Date().toISOString().slice(0, 10);
	const seasonName = n => (n === 0 ? "Specials" : `Season ${n}`);
	const epCode = e => `E${String(e.episodeNumber).padStart(2, "0")}`;
	const panelBusy = () => state.grabbing || state.panel?.phase === "loading" || state.panel?.vphase === "loading" || state.panel?.auto;
	async function loadTree(id) {
		if (!c.client) return;
		try {
			const [episodes, files] = await Promise.all([c.client.getEpisodes(id), c.client.getEpisodeFiles(id)]);
			state.trees[id] = lib.buildFileTree(episodes, files);
			const s = state.series.find(x => x.id === id);
			if (s) await loadPlexEpisodes({ series: s });
		} catch (e) { state.error = e.message; }
	}

	async function toggleSeries(series) {
		if (state.open.has(series.id)) { state.open.delete(series.id); draw(); return; }
		state.open.add(series.id);
		draw();
		await loadTree(series.id);
		draw();
	}

	// Deletes the files of some episodes (a season's, or one episode's) and unmonitors those episodes.
	async function removeEpisodeFiles(series, episodes) {
		if (state.removing) return;
		state.removing = series.id;
		draw();
		let failed = null;
		try {
			await c.client.deleteEpisodeFiles([...new Set(episodes.map(e => e.fileId))]);
			await c.client.unmonitorEpisodes(episodes.map(e => e.id));
		} catch (e) {
			failed = e.message;
		}
		await refreshSonarr();   // also after a failure part-way: the rows must show what is actually left
		if (failed) state.error = failed;
		state.removing = null;
		draw();
	}
	// Takes the show off the watchlist and pending by clearing its notes' flags. The note stays: it also holds the show's
	// watches and history. The hourly Serializd sync sets on_watchlist / watching again while Serializd still lists it.
	async function clearNotes(match) {
		for (let i = notes.length - 1; i >= 0; i--) {
			if (!match(notes[i])) continue;
			await api.notes.update(notes[i].path, { on_watchlist: false, watching: false, pending: false });   // was vault.process + films-lib setKeys
			notes.splice(i, 1);
		}
	}

	// mode "all" (the table's Sonarr button, a card's x) removes the show from Sonarr with its files and every
	// download of it, and clears its watchlist notes. Otherwise only the row's own thing goes: that one download
	// (group, when given), or the files on disk.
	async function removeSeries(series, mode, group = null) {
		if (state.removing) return;
		state.removing = series.id;
		draw();
		let failed = null;
		try {
			// The queue as it is now, not as last polled: a download grabbed seconds ago has to be cancelled too, or it
			// would finish and re-import (Sonarr's queue and SABnzbd both drop it).
			const queue = await c.client.getQueue();
			for (const step of lib.removalPlan(series, mode, group, queue)) {
				if (step.op === "cancel") await c.client.removeQueueItems(step.ids);
				else if (step.op === "deleteSeries") await c.client.deleteSeries(series.id);
				else if (step.op === "deleteFiles") await c.client.deleteFiles(series);
				else if (step.op === "unmonitor") await c.client.unmonitor(series);
				else if (step.op === "clearNotes") await clearNotes(n => lib.matchSeries(n, [series], state.ids) === series);
			}
			if (state.panel && state.panel.seriesId === series.id && mode === "all") state.panel = null;
		} catch (e) {
			failed = e.message;
		}
		await refreshSonarr();   // also after a failure part-way: the rows must show what is actually left
		if (failed) state.error = failed;
		state.removing = null;
		draw();
	}

	// A card's x for a show Sonarr does not have: only its watchlist notes go.
	async function unlistShow(show) {
		if (state.removing) return;
		state.removing = show.key;
		draw();
		try {
			await clearNotes(n => n.path === show.path || (show.tmdbId && n.tmdbId === show.tmdbId));
			if (state.panel?.key === show.key) state.panel = null;
		} catch (e) {
			state.error = e.message;
		} finally {
			state.removing = null;
		}
		draw();
	}

	function toggleShow(show) {
		if (busy()) return;
		if (state.panel?.key === show.key) { state.panel = null; draw(); return; }
		openShow(show);
	}

	// Adds the show to Sonarr if needed (unmonitored, nothing searched), then loads its episodes for the season list.
	async function openShow(show) {
		const panel = { key: show.key, seriesId: show.series?.id ?? null, phase: "loading", episodes: [], expanded: new Set(), view: null, vphase: null, releases: [], sortKey: "resolution", sortDir: "desc", confirm: null, notice: null, error: null, auto: null };
		const savedRelease = c.store[KEYS.releaseSort];
		if (savedRelease?.key) Object.assign(panel, { sortKey: savedRelease.key, sortDir: savedRelease.dir === "asc" ? "asc" : "desc" });
		state.panel = panel;
		draw();
		try {
			const series = await c.client.ensureSeries({ tvdbId: show.tvdbId, tmdbId: show.tmdbId }, state.series);
			if (!state.series.some(s => s.id === series.id)) state.series = [...state.series, series];
			panel.seriesId = series.id;
			panel.episodes = await c.client.getEpisodes(series.id);
			await loadPlexEpisodes(show.series ? show : { ...show, series });
			// Open the first season that is not complete, the one most likely wanted.
			const first = lib.groupEpisodes(panel.episodes, state.queue, today()).filter(s => s.seasonNumber > 0 && s.files < s.total).at(-1);
			if (first) panel.expanded.add(first.seasonNumber);
			panel.phase = "ready";
		} catch (e) {
			panel.phase = "error";
			panel.error = e.message;
		}
		if (state.panel === panel) draw();   // the user may have closed or switched shows meanwhile
	}

	// Turns monitoring on or off for the show, a season or an episode.
	async function toggleMonitor(show, scope) {
		const p = state.panel;
		if (!p || panelBusy()) return;
		p.auto = "monitor"; p.error = null; p.notice = null;
		draw();
		try {
			if (scope.episode) await c.client.setEpisodesMonitored([scope.episode.id], scope.to);
			else if (scope.season != null) await c.client.setSeasonMonitored(p.seriesId, scope.season, scope.to);
			else await c.client.setSeriesMonitored(p.seriesId, scope.to);
			await refreshSonarr();   // reloads the series and the open modal's episodes
		} catch (e) { p.error = e.message; }
		p.auto = null;
		if (state.panel === p) draw();
	}

	// The interactive release table for one season (packs and episodes) or one episode.
	async function openReleases(show, scope) {
		const p = state.panel;
		if (!p || panelBusy()) return;
		Object.assign(p, { view: { scope, label: scope.episode ? `${seasonName(scope.episode.seasonNumber)} ${epCode(scope.episode)}` : seasonName(scope.season) }, vphase: "loading", releases: [], confirm: null, notice: null, error: null, findOpen: false, find: "" });
		draw();
		try {
			const raw = scope.episode ? await c.client.getEpisodeReleases(scope.episode.id) : await c.client.getReleases(p.seriesId, scope.season);
			p.releases = raw.map(r => lib.normalizeRelease(r));
			p.vphase = "ready";
		} catch (e) {
			p.vphase = "error";
			p.error = e.message;
		}
		if (state.panel === p) draw();
	}
	async function grabRelease(show, release) {
		const panel = state.panel;
		if (!panel || state.grabbing) return;
		state.grabbing = release.guid;
		panel.error = null;
		draw();
		try {
			await c.client.grab({ guid: release.guid, indexerId: release.indexerId });
			panel.notice = `Sent to SABnzbd: ${release.title}`;
			panel.confirm = null;
			state.sent.add(release.guid);
			state.pollUntil = Date.now() + 60000;
			c.later(async () => { await refreshSonarr(); draw(); }, 1500);   // let Sonarr put it in its queue first
		} catch (e) {
			panel.error = e.message;
		} finally {
			state.grabbing = null;
		}
		if (state.panel === panel) draw();
	}

	Object.assign(c, { tmdbOf, availOf, myServices, busy, openUrl, openNote, refreshSonarr, resolveIds, today, seasonName, epCode, panelBusy, loadTree, toggleSeries, removeEpisodeFiles, clearNotes, removeSeries, unlistShow, toggleShow, openShow, toggleMonitor, openReleases, grabRelease });
}
