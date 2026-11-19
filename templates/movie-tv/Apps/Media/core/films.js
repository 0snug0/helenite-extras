// Note helpers shared by the Movies and TV pages: where the notes live and how their frontmatter is read.
// Lifted from Downloadrr/films.js and DownloadrrTV/films.js (identical apart from the vault paths, both kept here).
// Pure: no DOM, no network.

export const FILMS = "50_Personal/Letterboxd/Films";
// One note per TV show, written by serializd_sync.py: the same shape as a film note, with Type "Show", tmdb_type "tv",
// serializd_url, and watching / watching_added beside on_watchlist / watchlist_added.
export const SHOWS = "50_Personal/Serializd/Shows";
export const serializdUrl = tmdbId => `https://www.serializd.com/show/${tmdbId}`;

// film_store.py writes "" for unknown values; treat it as missing.
const val = v => (v === "" || v == null ? null : v);

export const nameOf = n => String(val(n.frontmatter?.title) ?? n.basename.replace(/\s*\(\d{4}\)$/, ""));
export const iso = v => { const m = /^\d{4}-\d{2}-\d{2}/.exec(String(val(v) ?? "")); return m ? m[0] : null; };
export const num = v => (val(v) == null ? null : Number(v));
