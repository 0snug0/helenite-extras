// Constants shared by the Downloadrr TV modules. Store keys replace the vault's 99_Internal/Data/downloadrr-tv-*.json files and
// the Obsidian localStorage keys: everything lives in the app store (<vault>/.helenite/apps/downloadrr-tv/store.json).
export const POLL_MS = 1000;
export const AVAIL_DAYS = 1, AVAIL_VERSION = 1;
export const SCORE_DAYS = 14;
export const KEYS = {
	avail: "availability",      // tmdbId -> { kind, on, checked }, from TMDB (was downloadrr-tv-availability.json)
	scores: "scores",           // tvdbId -> { lb, rt, aud, rtUrl, checked }, scraped (was downloadrr-tv-scores.json)
	ids: "ids",                 // note path -> { tvdbId, title, poster }, from Sonarr lookups (was downloadrr-tv-ids.json)
	services: "downloadrr-tv-services",
	sort: "downloadrr-tv-sort",
	releaseSort: "downloadrr-tv-release-sort",
	activeSort: "downloadrr-tv-active-sort",
};

const icon = body => `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
export const ICONS = {
	file: icon('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m14.5 12.5-5 5"/><path d="m9.5 12.5 5 5"/>'),
	// Sonarr's logo mark (a lucide "tv" outline stands in: the real logo is a licensed asset), in the text colour.
	sonarr: icon('<rect width="20" height="15" x="2" y="7" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/>'),
	search: icon('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'),
	grid: icon('<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>'),
	bookmark: icon('<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>'),
	bookmarkOn: icon('<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" fill="currentColor"/>'),
	pause: icon('<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>'),
	play: icon('<polygon points="6 3 20 12 6 21 6 3"/>'),
	check: icon('<path d="M20 6 9 17l-5-5"/>'),
};
export const LOGOS = {
	lb: '<svg width="22" height="12" viewBox="0 0 22 12" aria-hidden="true"><circle cx="5" cy="6" r="4.5" fill="#FF8000"/><circle cx="11" cy="6" r="4.5" fill="#00E054"/><circle cx="17" cy="6" r="4.5" fill="#40BCF4"/></svg>',
	rt: '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="8" r="5.5" fill="#FA320A"/><rect x="4" y="1" width="6" height="3" rx="1.5" fill="#00912D"/></svg>',
	aud: '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="4.5" cy="4" r="2.5" fill="#FFD700"/><circle cx="9.5" cy="4" r="2.5" fill="#FFD700"/><circle cx="7" cy="3" r="2.5" fill="#FFD700"/><path d="M3 5h8l-1.2 8H4.2z" fill="#FA320A"/></svg>',
};
export const ACTIVE_COLS = [["title", "Show"], ["episodes", "Episodes", false, false], ["date", "DL date"], ["status", "Status"], ["size", "Size", true], ["progress", "Progress"], ["lb", "Letterboxd rating", true], ["rt", "Rotten Tomatoes critics", true], ["aud", "Rotten Tomatoes audience", true]];
