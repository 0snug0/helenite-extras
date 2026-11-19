// Store keys the Movies page (the old Downloadrr app) used, by their OLD names. In the Media app the page reads and writes
// them through ctx.store, which prefixes every key with "movies:", so the stored key of each is `movies:<old name>`
// (e.g. "downloadrr-sort" -> "movies:downloadrr-sort"). The old names are kept so a migration is a plain copy.
// Task 7 (TV) and Task 9 (migration, jobs) extend this file / read it.
export const MOVIES_PREFIX = "movies:";
export const MOVIES_KEYS = [
	"release-dates",           // tmdbId -> release date, from Radarr lookups
	"availability",            // tmdbId -> { kind, on, date, checked, v }, from TMDB (also written by the refresh-availability job)
	"scores",                  // tmdbId -> { lb, rt, aud, rtUrl, checked }
	"downloadrr-services",     // "My streaming" toggle
	"downloadrr-sort",         // card sort
	"downloadrr-release-sort", // release picker sort { key, dir }
	"downloadrr-active-sort",  // "On disk & downloading" sort { key, dir }
];
// old key -> new (prefixed) key
export const moviesKeyMap = () => Object.fromEntries(MOVIES_KEYS.map(k => [k, MOVIES_PREFIX + k]));
