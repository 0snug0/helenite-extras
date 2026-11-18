// Pure helpers for the Downloadrr view: no Obsidian, no network, so `node --test` can load this file.
// An ES module: view.js imports it, and node --test imports it as is.

function parseEnv(text) {
	const out = {};
	for (const line of String(text ?? "").split(/\r?\n/)) {
		if (line.trim().startsWith("#")) continue;
		const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
		if (!m) continue;
		let v = m[2];
		if (/^(["']).*\1$/.test(v)) v = v.slice(1, -1);
		out[m[1]] = v;
	}
	return out;
}

// Watchlist/Pending notes are titled "Film" or, for same-name collisions, "Film (YYYY)".
function stripYear(name) {
	return String(name ?? "").replace(/\s*\(\d{4}\)\s*$/, "").trim();
}

function formatSize(bytes) {
	if (!(bytes > 0)) return "–";
	return bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.round(bytes / 1e6)} MB`;
}

function formatAge(hours) {
	if (!(hours >= 0)) return "–";
	if (hours < 48) return `${Math.max(1, Math.round(hours))}h`;
	const days = hours / 24;
	if (days < 60) return `${Math.round(days)}d`;
	if (days < 730) return `${Math.round(days / 30.44)}mo`;
	return `${Math.round(days / 365.25)}y`;
}

const resolutionLabel = res => (res > 0 ? `${res}p` : "?");

// Full-disc Blu-ray releases (an .iso or a BDMV folder) don't play in Plex, so they are never grabbable.
const DISC_TITLE = /\b(complete[ ._-]?(uhd[ ._-]?)?blu-?ray|bdmv|bd25|bd50|bd66|bd100|iso)\b/i;

function isDiscImage(r) {
	return r.quality?.quality?.name === "BR-DISK" || DISC_TITLE.test(r.title ?? "");
}

function normalizeRelease(r) {
	const q = r.quality?.quality ?? {};
	const disc = isDiscImage(r);
	const reasons = (r.rejections ?? []).map(x => (typeof x === "string" ? x : x?.reason)).filter(Boolean);
	if (disc) reasons.unshift("Disc image (ISO/BR-DISK): Plex can't play it");
	return {
		guid: r.guid,
		indexerId: r.indexerId,
		title: r.title ?? "",
		resolution: q.resolution ?? 0,
		qualityName: q.name ?? "",
		size: r.size ?? 0,
		ageHours: r.ageHours ?? (r.age ?? 0) * 24,
		rejected: disc || !!r.rejected,
		reasons,
		allowed: !disc && r.downloadAllowed !== false,
		indexer: r.indexer ?? "",
	};
}

function sortReleases(list, key = "resolution", dir = "desc") {
	const value = {
		title: r => r.title.toLowerCase(),
		resolution: r => r.resolution,
		size: r => r.size,
		age: r => r.ageHours,
	}[key] ?? (r => r.resolution);
	const sign = dir === "asc" ? 1 : -1;
	return [...list].sort((a, b) => {
		const x = value(a), y = value(b);
		if (x !== y) return (x < y ? -1 : 1) * sign;
		if (a.ageHours !== b.ageHours) return a.ageHours - b.ageHours;
		return a.title.localeCompare(b.title);
	});
}

// Ctrl+F in the release picker: every word must appear in the release name or its quality label.
function filterReleases(list, query) {
	const words = String(query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
	if (!words.length) return list;
	return list.filter(r => { const hay = `${r.title} ${r.qualityName}`.toLowerCase(); return words.every(w => hay.includes(w)); });
}

function movieStatus(movie, queueItem) {
	if (queueItem) {
		const pct = queueItem.size > 0 ? Math.round((1 - queueItem.sizeleft / queueItem.size) * 100) : 0;
		return { kind: "downloading", percent: Math.min(100, Math.max(0, pct)) };
	}
	if (movie?.hasFile) return { kind: "downloaded" };
	if (movie) return { kind: "in-radarr" };
	return { kind: "missing" };
}

function buildFilms(notes, movies, queue, known = true) {
	const byTmdb = new Map(movies.map(m => [m.tmdbId, m]));
	const queued = new Map(queue.map(q => [q.movieId, q]));
	const films = new Map();
	for (const n of notes) {
		const key = n.tmdbId ? `tmdb:${n.tmdbId}` : `path:${n.path}`;
		const prev = films.get(key);
		if (prev) {
			if (n.pending && !prev.pending) { prev.pending = true; prev.path = n.path; }
			if ((n.added ?? "") > prev.added) prev.added = n.added;
			continue;
		}
		films.set(key, { key, tmdbId: n.tmdbId, title: n.title, year: n.year, added: n.added ?? "", poster: n.poster, url: n.url, path: n.path, pending: n.pending });
	}
	const fromNotes = [...films.values()]
		.map(f => {
			if (!f.tmdbId) return { ...f, status: { kind: "no-id" } };
			if (!known) return { ...f, status: { kind: "unknown" } };
			const movie = byTmdb.get(f.tmdbId);
			return { ...f, movie, status: movieStatus(movie, movie ? queued.get(movie.id) : undefined) };
		});
	// The monitor list: every film Radarr is waiting to get (monitored, no file) that no note stands for gets a card
	// of its own (path null: it has no watchlist note), so a film added from the search box shows up.
	const claimed = new Set(fromNotes.map(f => f.movie?.id).filter(id => id != null));
	const fromRadarr = known ? movies.filter(m => m.monitored && !m.hasFile && !claimed.has(m.id)).map(m => ({
		key: `radarr:${m.id}`, tmdbId: m.tmdbId, title: m.title, year: m.year, added: String(m.added ?? "").slice(0, 10),
		poster: (m.images ?? []).find(i => i.coverType === "poster")?.remoteUrl ?? null,
		url: m.tmdbId ? `https://letterboxd.com/tmdb/${m.tmdbId}/` : null, path: null, pending: false, movie: m, status: movieStatus(m, queued.get(m.id)),
	})) : [];
	return [...fromNotes, ...fromRadarr].sort((a, b) => a.title.localeCompare(b.title));
}

// The rows of the "On disk & downloading" table, before sorting: one per download in Radarr's queue (in queue
// order), then one per file on disk, watchlist or not. A film on disk that is downloading again, or grabbed twice, gets a row for each.
// position(queueItem) is its place in SABnzbd's queue, or null when that is not known.
function activeMovies(movies, queue, position = () => null) {
	const byId = new Map(movies.map(m => [m.id, m]));
	const byTitle = (a, b) => a.movie.title.localeCompare(b.movie.title);
	const downloads = queue
		.filter(q => byId.has(q.movieId))
		.map(q => {
			const movie = byId.get(q.movieId);
			return { key: `q:${q.id}`, movie, queue: q, status: movieStatus(movie, q), size: q.size ?? 0, date: String(q.added ?? "").slice(0, 10), position: position(q) };
		})
		.sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity) || String(a.queue.added ?? "").localeCompare(String(b.queue.added ?? "")) || byTitle(a, b));
	const files = movies
		.filter(m => m.hasFile)
		.map(m => ({ key: `file:${m.id}`, movie: m, queue: null, status: movieStatus(m), size: m.movieFile?.size ?? m.sizeOnDisk ?? 0, date: String(m.movieFile?.dateAdded ?? "").slice(0, 10) }))
		.sort(byTitle);
	return [...downloads, ...files];
}

// Which SABnzbd job is really downloading. SABnzbd calls every slot that is not paused "Downloading" while it runs
// (and "Queued" only when the whole queue is paused), so it has to be worked out: the first job in the queue that
// is not paused downloads, the rest wait. slots: SABnzbd's. -> Map nzo_id -> "Paused" | "Downloading" | "Queued".
function slotStates(slots, queuePaused = false) {
	const out = new Map();
	let active = false;
	for (const sl of [...(slots ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0))) {
		if (queuePaused || sl.status === "Paused") out.set(sl.nzo_id, "Paused");
		else { out.set(sl.nzo_id, active ? "Queued" : "Downloading"); active = true; }
	}
	return out;
}

// What a delete button does, as steps in order. mode "all" (the Radarr button, a card's x): cancel every download
// of the movie, delete it from Radarr with its file, trash its watchlist notes. Otherwise only the row's own
// thing: that one download (when given), or the file on disk. queue: Radarr's, as it is right now.
function removalPlan(movie, mode, download, queue) {
	const downloads = queue.filter(q => q.movieId === movie.id);
	if (mode === "all") return [...downloads.map(q => ({ op: "cancel", id: q.id })), { op: "deleteMovie" }, ...(movie.tmdbId ? [{ op: "trashNotes" }] : [])];
	if (download) {
		// Nothing of the film left once this download is gone: unmonitor, or Radarr fetches it again.
		const last = !movie.hasFile && !downloads.some(q => q.id !== download.id);
		return [{ op: "cancel", id: download.id }, ...(last ? [{ op: "unmonitor" }] : [])];
	}
	return [{ op: movie.movieFile?.id != null ? "deleteFile" : "unmonitor" }];
}

// What the Status column says about a row. A download: its slotStates entry when SABnzbd has it (that knows a job
// is paused or waiting its turn), else Radarr's; a finished download Radarr will not import stays listed as blocked.
// A file: its Plex watch state. percent is the download's, or how far into the film Plex is.
function rowStatus(item, { slot, watch } = {}) {
	const q = item.queue;
	if (!q) {
		if (!watch) return { kind: "downloaded", label: "Downloaded", percent: null };
		const kind = watch.kind === "watching" && watch.paused ? "started" : watch.kind;   // paused in Plex: begun, not being watched
		const label = { unwatched: "Not started", started: "Started", watching: "Watching", watched: "Watched" }[kind];
		return { kind, label, percent: kind === "started" || kind === "watching" ? watch.percent : null };
	}
	const percent = item.status.percent, tracked = q.trackedDownloadState;
	if (q.status === "failed" || tracked === "failed" || tracked === "failedPending") return { kind: "failed", label: "Failed", percent };
	if (q.status === "completed" || ["importBlocked", "importPending", "importing", "imported"].includes(tracked)) {
		return tracked === "importBlocked" || q.trackedDownloadStatus === "warning" ? { kind: "blocked", label: "Import blocked", percent } : { kind: "importing", label: "Importing", percent };
	}
	const s = String(slot ?? q.status ?? "").toLowerCase();
	if (s === "paused") return { kind: "paused", label: "Paused", percent };
	if (s === "queued") return { kind: "queued", label: "Queued", percent };
	return { kind: "downloading", label: "Downloading", percent };
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
// Status column order: the downloads, then how far along the film is in Plex. "downloaded" (Plex has not seen it) goes last.
const STATUS_RANK = { downloading: 0, queued: 1, paused: 2, importing: 3, blocked: 4, failed: 5, unwatched: 6, started: 7, watching: 7, watched: 8 };

// Sorts every row, downloads and files alike. scores: tmdbId -> { lb, rt, aud }; statusOf(item) -> its rowStatus.
// Rows with nothing for the sorted column go last. Ties go by title, then keep activeMovies' order, so a film's
// download stays right above its file.
function sortActive(items, key = "title", dir = "asc", scores = {}, statusOf = () => null) {
	const value = {
		title: i => i.movie.title.toLowerCase(),
		year: i => i.movie.year ?? 0,
		date: i => i.date ?? "",
		size: i => i.size || null,
		status: i => { const s = statusOf(i); return s && s.kind in STATUS_RANK ? STATUS_RANK[s.kind] * 1000 + (s.percent ?? 0) : null; },
		progress: i => statusOf(i)?.percent ?? null,
		lb: i => scores[i.movie.tmdbId]?.lb ?? null,
		rt: i => scores[i.movie.tmdbId]?.rt ?? null,
		aud: i => scores[i.movie.tmdbId]?.aud ?? null,
	}[key] ?? (i => i.movie.title.toLowerCase());
	const sign = dir === "desc" ? -1 : 1;
	return [...items].sort((a, b) => {
		const x = value(a), y = value(b);
		if (x === null || y === null) { if (x !== y) return x === null ? 1 : -1; return a.movie.title.localeCompare(b.movie.title); }
		if (x !== y) return (x < y ? -1 : 1) * sign;
		return a.movie.title.localeCompare(b.movie.title);
	});
}

const FILTERS = [["all", "All"], ["pending", "Pending"], ["missing", "Not in Radarr"], ["downloading", "Downloading"], ["downloaded", "Downloaded"]];

function matchesFilter(film, filter) {
	switch (filter) {
		case "pending": return film.pending;
		case "missing": return film.status.kind === "missing";
		case "downloading": return film.status.kind === "downloading";
		case "downloaded": return film.status.kind === "downloaded";
		default: return true;
	}
}

// Streaming services the user subscribes to; ids are the short names availability() puts in `on`.
const SERVICES = [["Netflix", "Netflix"], ["HBO", "HBO"], ["Apple", "Apple TV"], ["Prime", "Amazon"]];
// True when the film streams on at least one of the selected services (none selected = no filter).
function matchesServices(avail, selected) {
	if (!selected?.length) return true;
	return avail?.kind === "stream" && (avail.on ?? []).some(s => selected.includes(s));
}

const SORTS = [["title", "Title"], ["added", "Newest added"], ["release", "Newest release"]];

// Radarr dates are ISO timestamps; "when it came out" is the earliest of them (a later digital or
// physical date is often a re-release).
const DATE_FIELDS = ["inCinemas", "digitalRelease", "physicalRelease", "releaseDate"];
function earliestDate(obj) {
	const dates = DATE_FIELDS.map(k => String(obj?.[k] ?? "").slice(0, 10)).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
	return dates.length ? dates.sort()[0] : null;
}

// Radarr's record first, then dates looked up earlier (cache: tmdbId -> "YYYY-MM-DD"), then Jan 1 of the note's year.
function releaseOf(film, cache) {
	return releaseExact(film, cache) ?? (film.year ? `${film.year}-01-01` : "");
}

// A real date only: Radarr's record or an earlier lookup. "" in the cache means a lookup found nothing.
function releaseExact(film, cache) {
	return earliestDate(film.movie) ?? (cache?.[film.tmdbId] || null);
}

// Frontmatter dates arrive as ISO strings; anything else (invalid DateTime, free text) counts as undated.
function addedDate(value) {
	const m = String(value ?? "").match(/^\d{4}-\d{2}-\d{2}/);
	return m ? m[0] : "";
}

function sortFilms(films, key, cache = {}) {
	const byTitle = (a, b) => a.title.localeCompare(b.title);
	const newestFirst = get => (a, b) => {
		const x = get(a), y = get(b);
		if (x === y) return byTitle(a, b);
		if (!x) return 1;   // undated last
		if (!y) return -1;
		return x < y ? 1 : -1;
	};
	const cmp = key === "added" ? newestFirst(f => f.added ?? "") : key === "release" ? newestFirst(f => releaseOf(f, cache)) : byTitle;
	return [...films].sort(cmp);
}

// Where a film can be watched in the US right now, from one TMDB /movie/{id} response with
// append_to_response=watch/providers,release_dates. Providers are JustWatch data and say nothing about
// cinemas, so "theaters" means: no provider, and a US theatrical release in the last THEATER_DAYS days.
const THEATER_DAYS = 120;
// The only streamers worth naming; anything else just reads "Available". Amazon Channel add-ons
// ("HBO Max Amazon Channel") count as the service they carry. "Apple TV Store" is rent/buy, not streaming.
const MAJORS = [["Netflix", /^Netflix\b/], ["Apple", /^Apple TV(?! Store)\b/], ["HBO", /^(HBO )?Max\b/], ["Prime", /^Amazon Prime Video\b/]];
const dayDiff = (a, b) => (Date.parse(b) - Date.parse(a)) / 86400000;
function availability(movie, today, region = "US") {
	const prov = movie?.["watch/providers"]?.results?.[region] ?? {};
	// Fandango At Home (ex-Vudu) lists preorders as rent/buy, so it never proves the film is out.
	const has = (...keys) => keys.some(k => (prov[k] ?? []).some(p => !/fandango/i.test(p.provider_name)));
	if (has("flatrate", "free", "ads")) {
		const names = ["flatrate", "free", "ads"].flatMap(k => (prov[k] ?? []).map(p => p.provider_name));
		return { kind: "stream", on: MAJORS.filter(([, re]) => names.some(n => re.test(n))).map(([short]) => short) };
	}
	if (has("rent", "buy")) return { kind: "rent" };

	const dates = (movie?.release_dates?.results ?? []).find(r => r.iso_3166_1 === region)?.release_dates ?? [];
	const day = d => String(d?.release_date ?? "").slice(0, 10);
	const theatrical = dates.filter(d => d.type === 2 || d.type === 3).map(day).filter(Boolean).sort();
	const past = theatrical.filter(d => d <= today);
	if (past.length && dayDiff(past[past.length - 1], today) <= THEATER_DAYS) return { kind: "theaters", date: past[past.length - 1] };
	// US dates decide; TMDB's top-level release_date is the earliest anywhere, so it is only a fallback.
	const us = dates.map(day).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
	const known = us.length ? us : [String(movie?.release_date ?? "")].filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
	const upcoming = known.filter(d => d > today).sort();
	const anyPast = known.some(d => d <= today);
	if (upcoming.length && !anyPast) return { kind: "soon", date: upcoming[0] };
	return { kind: "none" };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function availabilityLabel(a, today = "") {
	if (!a) return "";
	switch (a.kind) {
		case "stream": return a.on?.length ? a.on.join(" · ") : "Available";
		case "rent": return "Available";
		case "theaters": return "Theaters";
		case "soon": {
			const [y, m, d] = a.date.split("-");
			return `Out ${MONTHS[m - 1]} ${Number(d)}${y !== today.slice(0, 4) ? ` ${y}` : ""}`;
		}
		default: return "";
	}
}

const lib = { filterReleases, availability, availabilityLabel, SORTS, earliestDate, releaseOf, releaseExact, addedDate, sortFilms, parseEnv, stripYear, formatSize, formatAge, resolutionLabel, normalizeRelease, sortReleases, movieStatus, plexWatchMap, activeMovies, slotStates, removalPlan, rowStatus, sortActive, buildFilms, FILTERS, matchesFilter, SERVICES, matchesServices };
export default lib;
export { filterReleases, availability, availabilityLabel, SORTS, earliestDate, releaseOf, releaseExact, addedDate, sortFilms, parseEnv, stripYear, formatSize, formatAge, resolutionLabel, normalizeRelease, sortReleases, movieStatus, plexWatchMap, activeMovies, slotStates, removalPlan, rowStatus, sortActive, buildFilms, FILTERS, matchesFilter, SERVICES, matchesServices };
