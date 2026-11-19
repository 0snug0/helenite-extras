// Pure helpers of the Movies page (films, Radarr status, active table, filters, sorts): no DOM, no network.
// The release, SABnzbd, Plex and availability helpers live in ../../core/ (so do rowStatus and the streaming-service filter, rows.js).
import { rowStatus, SERVICES, matchesServices } from "../../core/rows.js";

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

const lib = { SORTS, earliestDate, releaseOf, releaseExact, addedDate, sortFilms, movieStatus, activeMovies, removalPlan, rowStatus, sortActive, buildFilms, FILTERS, matchesFilter, SERVICES, matchesServices };
export default lib;
export { SORTS, earliestDate, releaseOf, releaseExact, addedDate, sortFilms, movieStatus, activeMovies, removalPlan, rowStatus, sortActive, buildFilms, FILTERS, matchesFilter, SERVICES, matchesServices };
