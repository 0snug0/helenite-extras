// Store keys the Movies page (the old Downloadrr app) used, by their OLD names. In the Media app the page reads and writes
// them through ctx.store, which prefixes every key with "movies:", so the stored key of each is `movies:<old name>`
// (e.g. "downloadrr-sort" -> "movies:downloadrr-sort"). The old names are kept so a migration is a plain copy.
// Task 9 (migration, jobs) reads this file.
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

// The TV page (the old Downloadrr TV app) is the same: its keys keep their OLD names and are stored as `tv:<old name>`.
// The old app kept the first three in vault files (99_Internal/Data/downloadrr-tv-*.json) before the app store existed.
export const TV_PREFIX = "tv:";
export const TV_KEYS = [
	"availability",             // tmdbId -> { kind, on, checked, v }, from TMDB (also written by the refresh-availability job)
	"scores",                   // tvdbId -> { sz, rt, aud, rtUrl, imdb, imdbUrl, checked }
	"ids",                      // note path -> { tvdbId, tmdbId, title, poster }, from Sonarr lookups
	"downloadrr-tv-services",   // "My streaming" toggle
	"downloadrr-tv-sort",       // card sort
	"downloadrr-tv-release-sort", // release picker sort { key, dir }
	"downloadrr-tv-active-sort",  // "On disk & downloading" sort { key, dir }
];
// old key -> new (prefixed) key
export const tvKeyMap = () => Object.fromEntries(TV_KEYS.map(k => [k, TV_PREFIX + k]));
