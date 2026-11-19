// Pure helpers of the TV page (shows, Sonarr status, seasons and episodes, active table, filters, sorts): no DOM, no network.
// What it shares with the Movies page (release normalising and sorting, SABnzbd, Plex, availability) lives in ../../core/.
import { normalizeRelease as normalizeBase } from "../../core/releases.js";
import { posterOf } from "../../core/posters.js";

const normTitle = s => String(s ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
	.replace(/\s*\(\d{4}\)\s*$/, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
const yearsClose = (a, b) => !(a > 0) || !(b > 0) || Math.abs(a - b) <= 1;

// The Sonarr series a note stands for: its TMDB id (tv notes), the tvdb id resolved earlier by lookup, then title + year.
function matchSeries(note, series, ids = {}) {
	const known = ids[note.path]?.tvdbId;
	if (known) { const s = series.find(x => x.tvdbId === known); if (s) return s; }
	if (note.tmdbId) { const s = series.find(x => x.tmdbId === note.tmdbId); if (s) return s; }
	const t = normTitle(note.title);
	return series.find(s => normTitle(s.title) === t && yearsClose(note.year, s.year));
}

// The best /series/lookup result for a note: same title, first air year within a year of the note's. Exact year first.
function pickLookup(note, results) {
	const t = normTitle(note.title);
	const ok = (results ?? []).filter(r => normTitle(r.title) === t && yearsClose(note.year, r.year));
	return ok.find(r => r.year === note.year) ?? ok[0] ?? null;
}

// Queue records grouped into downloads: a season pack is several records (one per episode) with one downloadId.
function groupQueue(queue) {
	const groups = new Map();
	for (const q of queue) {
		const key = q.downloadId || `q:${q.id}`;
		if (!groups.has(key)) groups.set(key, { key, downloadId: q.downloadId ?? null, seriesId: q.seriesId, records: [] });
		groups.get(key).records.push(q);
	}
	return [...groups.values()];
}

// "S01E04", "S01E04-06" or "S01 pack" for the episodes a download or release covers.
function episodeLabel(season, episodes, full = false) {
	const s = `S${String(season ?? 0).padStart(2, "0")}`;
	const eps = [...new Set(episodes ?? [])].sort((a, b) => a - b);
	if (full || !eps.length) return `${s} pack`;
	const e = n => `E${String(n).padStart(2, "0")}`;
	return eps.length === 1 ? `${s}${e(eps[0])}` : `${s}${e(eps[0])}-${e(eps[eps.length - 1])}`;
}

function downloadLabel(group, series) {
	const withEp = group.records.filter(r => r.episode || r.seasonNumber != null);
	const seasons = [...new Set(withEp.map(r => r.seasonNumber ?? r.episode?.seasonNumber).filter(n => n != null))];
	if (seasons.length !== 1) return `${group.records.length} episode${group.records.length === 1 ? "" : "s"}`;
	const eps = group.records.map(r => r.episode?.episodeNumber).filter(n => n != null);
	// A download covering every episode of its season is the season ("Season 1"), not a list of episodes.
	const total = series?.seasons?.find(s => s.seasonNumber === seasons[0])?.statistics?.totalEpisodeCount;
	if (total > 1 && group.records.length >= total) return seasons[0] === 0 ? "Specials" : `Season ${seasons[0]}`;
	return group.records.length > 1 && eps.length === group.records.length ? episodeLabel(seasons[0], eps) : episodeLabel(seasons[0], eps, !eps.length);
}

function percentOf(q) {
	const pct = q.size > 0 ? Math.round((1 - q.sizeleft / q.size) * 100) : 0;
	return Math.min(100, Math.max(0, pct));
}

// The rows of the "On disk & downloading" table, before sorting: one per download (in queue order), then one per
// show with files on disk. position(group) is its place in SABnzbd's queue, or null when that is not known.
// Each item carries `movie`-less data: { key, series, queue (first record or null), group, size, date, status, detail }.
function activeShows(series, queue, position = () => null) {
	const byId = new Map(series.map(s => [s.id, s]));
	const byTitle = (a, b) => a.series.title.localeCompare(b.series.title);
	const downloads = groupQueue(queue)
		.filter(g => byId.has(g.seriesId))
		.map(g => {
			const q = g.records[0];   // the records of one download share size, sizeleft and status
			return { key: `q:${g.key}`, series: byId.get(g.seriesId), queue: q, group: g, size: q.size ?? 0, date: String(q.added ?? "").slice(0, 10), status: { kind: "downloading", percent: percentOf(q) }, detail: downloadLabel(g, byId.get(g.seriesId)), position: position(g) };
		})
		.sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity) || String(a.queue.added ?? "").localeCompare(String(b.queue.added ?? "")) || byTitle(a, b));
	const files = series
		.filter(s => (s.statistics?.episodeFileCount ?? 0) > 0)
		.map(s => ({ key: `file:${s.id}`, series: s, queue: null, group: null, size: s.statistics.sizeOnDisk ?? 0, date: "", status: { kind: "downloaded", percent: null }, detail: `${s.statistics.episodeFileCount}/${s.statistics.totalEpisodeCount ?? s.statistics.episodeCount ?? "?"} episodes` }))
		.sort(byTitle);
	return [...downloads, ...files];
}

const STATUS_RANK = { downloading: 0, queued: 1, paused: 2, importing: 3, blocked: 4, failed: 5, downloaded: 6 };

// Sorts every row. Rows with nothing for the sorted column go last; ties go by title, then keep activeShows' order.
function sortActive(items, key = "title", dir = "asc", statusOf = () => null, scoresOf = () => undefined) {
	const value = {
		title: i => i.series.title.toLowerCase(),
		date: i => i.date || null,
		size: i => i.size || null,
		status: i => { const s = statusOf(i); return s && s.kind in STATUS_RANK ? STATUS_RANK[s.kind] * 1000 + (s.percent ?? 0) : null; },
		progress: i => statusOf(i)?.percent ?? null,
		sz: i => scoresOf(i)?.sz ?? null,
		rt: i => scoresOf(i)?.rt ?? null,
		aud: i => scoresOf(i)?.aud ?? null,
	}[key] ?? (i => i.series.title.toLowerCase());
	const sign = dir === "desc" ? -1 : 1;
	return [...items].sort((a, b) => {
		const x = value(a), y = value(b);
		if (x === null || y === null) { if (x !== y) return x === null ? 1 : -1; return a.series.title.localeCompare(b.series.title); }
		if (x !== y) return (x < y ? -1 : 1) * sign;
		return a.series.title.localeCompare(b.series.title);
	});
}

// What a delete button does, as steps in order. mode "all" (a card's x, the Sonarr button): cancel every download of
// the show, delete it from Sonarr with its files, clear its watchlist notes. Otherwise only the row's own thing:
// that one download (when given), or the files on disk. queue: Sonarr's, as it is right now.
function removalPlan(series, mode, group, queue) {
	const ids = queue.filter(q => q.seriesId === series.id).map(q => q.id);
	if (mode === "all") return [...(ids.length ? [{ op: "cancel", ids }] : []), { op: "deleteSeries" }, { op: "clearNotes" }];
	if (group) {
		const mine = new Set(group.records.map(r => r.id));
		const cancel = queue.filter(q => mine.has(q.id) || (group.downloadId && q.downloadId === group.downloadId)).map(q => q.id);
		// Nothing of the show left once this download is gone: unmonitor, or Sonarr fetches it again.
		const last = !(series.statistics?.episodeFileCount > 0) && !queue.some(q => q.seriesId === series.id && !cancel.includes(q.id));
		return [...(cancel.length ? [{ op: "cancel", ids: cancel }] : []), ...(last ? [{ op: "unmonitor" }] : [])];
	}
	return [{ op: "deleteFiles" }];
}

// Release payloads from GET /release?seriesId&seasonNumber, flattened for the picker.
function normalizeRelease(r) {
	const n = normalizeBase(r);
	const season = r.seasonNumber ?? r.mappedSeasonNumber ?? 0;
	return { ...n, fullSeason: !!r.fullSeason, season, episodes: r.episodeNumbers ?? [], label: episodeLabel(season, r.episodeNumbers, !!r.fullSeason), group: r.releaseGroup ?? "", weight: r.qualityWeight ?? 0 };
}

// Extra sort key of the TV release table (core's sortReleases takes it): a season pack first, then by first episode.
const RELEASE_SORT = { type: r => (r.fullSeason ? 0 : 1000) + (r.episodes[0] ?? 0) };

// Season numbers worth searching (specials excluded) and the one to open first: the earliest with no files yet.
function seasonChoices(series) {
	const seasons = (series?.seasons ?? []).filter(s => s.seasonNumber > 0).sort((a, b) => a.seasonNumber - b.seasonNumber);
	const first = seasons.find(s => !(s.statistics?.episodeFileCount > 0)) ?? seasons[0];
	return { seasons, first: first?.seasonNumber ?? 1 };
}

// Per-show state for the card chip: "unknown" until Sonarr has answered, "missing" when it does not have the show.
function showStatus(series, queue) {
	if (!series) return { kind: "missing" };
	const groups = groupQueue(queue.filter(q => q.seriesId === series.id));
	if (groups.length) return { kind: "downloading", percent: Math.round(groups.reduce((n, g) => n + percentOf(g.records[0]), 0) / groups.length) };
	const st = series.statistics ?? {};
	if (st.episodeFileCount > 0) return { kind: "downloaded", files: st.episodeFileCount, total: st.totalEpisodeCount ?? st.episodeCount ?? 0 };
	return { kind: "in-sonarr" };
}

function buildShows(notes, series, queue, known = true, ids = {}) {
	const shows = new Map();
	for (const n of notes) {
		const key = n.tmdbId ? `tmdb:${n.tmdbId}` : `path:${n.path}`;
		const prev = shows.get(key);
		if (prev) {
			if (n.pending && !prev.pending) { prev.pending = true; prev.path = n.path; }
			if (n.watching) prev.watching = true;
			if ((n.added ?? "") > prev.added) prev.added = n.added;
			continue;
		}
		shows.set(key, { key, tmdbId: n.tmdbId, title: n.title, year: n.year, added: n.added ?? "", poster: n.poster, url: n.url, path: n.path, pending: n.pending, watching: !!n.watching });
	}
	const fromNotes = [...shows.values()]
		.map(f => {
			if (!known) return { ...f, status: { kind: "unknown" } };
			const s = matchSeries(f, series, ids);
			return { ...f, series: s, tvdbId: s?.tvdbId ?? ids[f.path]?.tvdbId ?? null, poster: f.poster || posterOf(s) || ids[f.path]?.poster || null, status: showStatus(s, queue) };
		});
	// Every show Sonarr holds that no note stands for gets a card of its own (path null: it has no watchlist note).
	const claimed = new Set(fromNotes.map(f => f.series?.id).filter(id => id != null));
	const fromSonarr = known ? series.filter(s => !claimed.has(s.id)).map(s => ({
		key: `sonarr:${s.id}`, tmdbId: s.tmdbId || null, tvdbId: s.tvdbId, title: s.title, year: s.year, added: String(s.added ?? "").slice(0, 10),
		poster: posterOf(s), url: s.tmdbId ? `https://www.serializd.com/show/${s.tmdbId}` : null, path: null, pending: false, watching: false, series: s, status: showStatus(s, queue),
	})) : [];
	return [...fromNotes, ...fromSonarr].sort((a, b) => a.title.localeCompare(b.title));
}

// The episodes of a series grouped into seasons for the modal: newest season first, specials (season 0) last.
// Each episode carries what the rows show: on disk, in the download queue, aired yet.
function groupEpisodes(episodes, queue, today) {
	const queued = new Set(queue.map(q => q.episodeId));
	const seasons = new Map();
	for (const e of episodes ?? []) {
		if (!seasons.has(e.seasonNumber)) seasons.set(e.seasonNumber, { seasonNumber: e.seasonNumber, episodes: [] });
		seasons.get(e.seasonNumber).episodes.push({ id: e.id, seasonNumber: e.seasonNumber, episodeNumber: e.episodeNumber, title: e.title ?? "", airDate: e.airDate ?? "", hasFile: !!e.hasFile, monitored: !!e.monitored, queued: queued.has(e.id), aired: !!e.airDate && e.airDate <= today });
	}
	return [...seasons.values()]
		.map(s => ({ ...s, episodes: s.episodes.sort((a, b) => a.episodeNumber - b.episodeNumber), total: s.episodes.length, files: s.episodes.filter(e => e.hasFile).length, monitoredCount: s.episodes.filter(e => e.monitored).length }))
		.sort((a, b) => (a.seasonNumber === 0) - (b.seasonNumber === 0) || b.seasonNumber - a.seasonNumber);
}

// What the modal says about monitoring: is the show monitored, are new seasons, and what happens to the next episode.
function monitorSummary(series, episodes, today) {
	const next = (episodes ?? []).filter(e => e.seasonNumber > 0 && e.airDate && e.airDate >= today)
		.sort((a, b) => a.airDate.localeCompare(b.airDate) || a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber)[0];
	return {
		seriesMonitored: !!series?.monitored,
		newSeasons: series?.monitorNewItems === "all",
		ended: series?.status === "ended",
		next: next ? { code: episodeLabel(next.seasonNumber, [next.episodeNumber]), airDate: next.airDate, monitored: !!next.monitored } : null,
		monitoredEpisodes: (episodes ?? []).filter(e => e.seasonNumber > 0 && e.monitored).length,
		total: (episodes ?? []).filter(e => e.seasonNumber > 0).length,
	};
}

// What a season search has to do: the aired episodes with no file and no download. A season with nothing on disk or
// downloading goes for a full-season pack first; one that is partly there only fills its gaps, so a pack is not
// downloaded to replace what is already on disk.
function planSeason(season) {
	const missing = season.episodes.filter(e => e.aired && !e.hasFile && !e.queued);
	const untouched = !season.episodes.some(e => e.hasFile || e.queued);
	return { missing, packFirst: untouched };
}

// The release to take of a list: acceptable to Sonarr (not rejected, e.g. by the quality profile) and the best quality
// by Sonarr's own weight, then the newest.
function pickBest(releases) {
	return releases.filter(r => r.allowed && !r.rejected).sort((a, b) => b.weight - a.weight || a.ageHours - b.ageHours)[0] ?? null;
}

// What is on disk for one series, as the table's tree: seasons (specials last), each with its episodes that have a file.
// episodes: GET /episode?seriesId, files: GET /episodefile?seriesId. A file covering two episodes lists under both.
function buildFileTree(episodes, files) {
	const byId = new Map((files ?? []).map(f => [f.id, f]));
	const seasons = new Map();
	for (const e of episodes ?? []) {
		const f = e.hasFile && byId.get(e.episodeFileId);
		if (!f) continue;
		if (!seasons.has(e.seasonNumber)) seasons.set(e.seasonNumber, { seasonNumber: e.seasonNumber, episodes: [] });
		seasons.get(e.seasonNumber).episodes.push({ id: e.id, fileId: f.id, seasonNumber: e.seasonNumber, episodeNumber: e.episodeNumber, title: e.title ?? "", size: f.size ?? 0 });
	}
	const list = [...seasons.values()].map(s => {
		const episodes = s.episodes.sort((a, b) => a.episodeNumber - b.episodeNumber);
		const unique = new Map(episodes.map(e => [e.fileId, e.size]));
		return { ...s, episodes, size: [...unique.values()].reduce((n, x) => n + x, 0) };
	});
	return { seasons: list.sort((a, b) => (a.seasonNumber === 0) - (b.seasonNumber === 0) || a.seasonNumber - b.seasonNumber) };
}

const FILTERS = [["all", "All"], ["pending", "Pending"], ["missing", "Not in Sonarr"], ["downloading", "Downloading"], ["downloaded", "Downloaded"]];
function matchesFilter(show, filter) {
	switch (filter) {
		case "pending": return show.pending;
		case "missing": return show.status.kind === "missing";
		case "downloading": return show.status.kind === "downloading";
		case "downloaded": return show.status.kind === "downloaded";
		default: return true;
	}
}
const SORTS = [["title", "Title"], ["added", "Newest added"]];
function sortShows(shows, key) {
	const byTitle = (a, b) => a.title.localeCompare(b.title);
	if (key !== "added") return [...shows].sort(byTitle);
	return [...shows].sort((a, b) => (a.added === b.added ? byTitle(a, b) : !a.added ? 1 : !b.added ? -1 : a.added < b.added ? 1 : -1));
}

const lib = { monitorSummary, buildFileTree, groupEpisodes, planSeason, pickBest, normTitle, matchSeries, pickLookup, posterOf, groupQueue, episodeLabel, downloadLabel, percentOf, activeShows, sortActive, removalPlan, normalizeRelease, RELEASE_SORT, seasonChoices, showStatus, buildShows, FILTERS, matchesFilter, SORTS, sortShows };
export default lib;
export { monitorSummary, buildFileTree, groupEpisodes, planSeason, pickBest, normTitle, matchSeries, pickLookup, posterOf, groupQueue, episodeLabel, downloadLabel, percentOf, activeShows, sortActive, removalPlan, normalizeRelease, RELEASE_SORT, seasonChoices, showStatus, buildShows, FILTERS, matchesFilter, SORTS, sortShows };
