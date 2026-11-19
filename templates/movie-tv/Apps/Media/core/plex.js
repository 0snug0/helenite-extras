// Plex client and watch-state helpers shared by the Movies and TV pages.
// Lifted from DownloadrrTV/plex.js (show/episode state, unchanged) and Downloadrr/lib.js plexWatchMap (film state, unchanged).
// The Movies page used to talk to Plex with an X-Plex-Token header and its own calls in fill.js; the client below sends the
// token as a query parameter (the TV copy), which Plex accepts too. `call` is exposed so the Movies page can read its
// library sections and sessions through it.
// `request` is injected: api.net.fetch in the app, a fake in tests. `token` is the host placeholder {{secret:PLEX_TOKEN}}.

const fix = (u) => String(u).replace(/\/+$/, "");

// A show's external ids from its Guid list: ["tvdb://79488", ...] -> { tvdb: 79488, tmdb: 4608 }.
function idsOf(item) {
	const out = {};
	for (const g of item?.Guid ?? []) {
		const m = /^(tvdb|tmdb|imdb):\/\/(.+)$/.exec(g.id ?? "");
		if (m) out[m[1]] = m[1] === "imdb" ? m[2] : Number(m[2]);
	}
	return out;
}

// Plex's show list -> lookups by tvdb / tmdb id. Each entry: { ratingKey, title, year, total, watched, lastViewedAt }.
function indexShows(items) {
	const byTvdb = new Map(), byTmdb = new Map(), all = [];
	for (const x of items ?? []) {
		const ids = idsOf(x);
		const e = { ratingKey: x.ratingKey, title: x.title, year: x.year ?? null, total: x.leafCount ?? 0, watched: x.viewedLeafCount ?? 0, lastViewedAt: x.lastViewedAt ?? null, ids };
		all.push(e);
		if (ids.tvdb) byTvdb.set(ids.tvdb, e);
		if (ids.tmdb) byTmdb.set(ids.tmdb, e);
	}
	return { byTvdb, byTmdb, all };
}

// The Plex entry for a Downloadrr show: tvdb id, then tmdb id.
function findShow(index, show) {
	if (!index) return undefined;
	const tvdb = show.tvdbId ?? show.series?.tvdbId, tmdb = show.tmdbId ?? show.series?.tmdbId;
	return (tvdb && index.byTvdb.get(Number(tvdb))) || (tmdb && index.byTmdb.get(Number(tmdb))) || undefined;
}

// "watched" (finished), "watching" (some episodes seen, or one partway through), or "none".
function showState(entry) {
	if (!entry || !entry.total) return { kind: "none", watched: 0, total: entry?.total ?? 0 };
	if (entry.watched >= entry.total) return { kind: "watched", watched: entry.watched, total: entry.total };
	return { kind: entry.watched > 0 || entry.progress ? "watching" : "none", watched: entry.watched, total: entry.total };
}

// One show's episodes (Plex's allLeaves) -> Map "S:E" -> { watched, progress (0..1 when partway through), lastViewedAt }.
function buildEpisodeMap(leaves) {
	const map = new Map();
	for (const e of leaves ?? []) {
		if (e.parentIndex == null || e.index == null) continue;
		const watched = (e.viewCount ?? 0) > 0;
		const progress = !watched && e.viewOffset > 0 && e.duration > 0 ? Math.min(0.99, e.viewOffset / e.duration) : 0;
		map.set(`${e.parentIndex}:${e.index}`, { watched, progress, lastViewedAt: e.lastViewedAt ?? null });
	}
	return map;
}
const epKey = e => `${e.seasonNumber}:${e.episodeNumber}`;

// The episode to resume: one partway through (most recently viewed), else the first unwatched after the last watched one.
function nextUp(map) {
	const keys = [...map.keys()].sort((a, b) => { const [s1, e1] = a.split(":").map(Number), [s2, e2] = b.split(":").map(Number); return s1 - s2 || e1 - e2; }).filter(k => !k.startsWith("0:"));
	const partway = keys.filter(k => map.get(k).progress > 0).sort((a, b) => (map.get(b).lastViewedAt ?? 0) - (map.get(a).lastViewedAt ?? 0))[0];
	if (partway) return partway;
	const lastWatched = keys.reduce((n, k, i) => (map.get(k).watched ? i : n), -1);
	if (lastWatched < 0) return null;
	return keys.slice(lastWatched + 1).find(k => !map.get(k).watched) ?? null;
}

// Per-season tallies over an episode map: { [seasonNumber]: { watched, total } } for the given Sonarr/Plex episodes.
function seasonTally(map, episodes) {
	const out = {};
	for (const e of episodes ?? []) {
		const t = (out[e.seasonNumber] ??= { watched: 0, total: 0 });
		t.total++;
		if (map.get(epKey(e))?.watched) t.watched++;
	}
	return out;
}

// In the app `token` is the host placeholder {{secret:PLEX_TOKEN}}: it must reach the host unencoded (the host encodes the value).
function createClient({ url, token, request }) {
	const base = fix(url);
	async function call(path) {
		let res;
		try {
			res = await request({ url: `${base}${path}${path.includes("?") ? "&" : "?"}X-Plex-Token=${token}`, headers: { Accept: "application/json" }, throw: false });
		} catch (e) { throw new Error(`Can't reach Plex at ${url}`); }
		if (res.status === 401) throw new Error("Plex rejected the token (401)");
		if (res.status < 200 || res.status >= 300) throw new Error(`Plex returned HTTP ${res.status}`);
		return res.json?.MediaContainer ?? {};
	}
	return {
		call,
		// Every show in every TV library, indexed by tvdb / tmdb id.
		async getShows() {
			const sections = (await call("/library/sections")).Directory ?? [];
			const items = [];
			for (const s of sections.filter(x => x.type === "show")) items.push(...((await call(`/library/sections/${s.key}/all?includeGuids=1`)).Metadata ?? []));
			return indexShows(items);
		},
		async getEpisodes(ratingKey) { return buildEpisodeMap((await call(`/library/metadata/${encodeURIComponent(ratingKey)}/allLeaves`)).Metadata); },
	};
}

// Plex movie metadata (from /library/sections/N/all?includeGuids=1) -> tmdbId -> { kind, percent }.
// viewOffset (ms) is set while a film is part-watched and cleared once Plex marks it watched (~90%).
function plexWatchMap(metadata, sessions = []) {
	const out = {}, byKey = {};
	const pct = (offset, duration) => duration > 0 ? Math.min(99, Math.max(1, Math.round(100 * offset / duration))) : null;
	for (const m of metadata ?? []) {
		const id = (m.Guid ?? []).map(g => /^tmdb:\/\/(\d+)$/.exec(g.id ?? "")).find(Boolean)?.[1];
		if (!id) continue;
		byKey[m.ratingKey] = id;
		if (m.viewOffset > 0) out[id] = { kind: "started", percent: pct(m.viewOffset, m.duration) };
		else out[id] = { kind: m.viewCount > 0 ? "watched" : "unwatched", percent: null };
	}
	// A live session beats the library, which lags behind playback and flips to "watched" at ~90%.
	for (const x of sessions ?? []) {
		const id = byKey[x.ratingKey];
		if (id) out[id] = { kind: "watching", percent: pct(x.viewOffset, x.duration), paused: x.Player?.state === "paused" };
	}
	return out;
}

const api = { createClient, plexWatchMap, idsOf, indexShows, findShow, showState, buildEpisodeMap, epKey, nextUp, seasonTally };
export default api;
export { createClient, plexWatchMap, idsOf, indexShows, findShow, showState, buildEpisodeMap, epKey, nextUp, seasonTally };
