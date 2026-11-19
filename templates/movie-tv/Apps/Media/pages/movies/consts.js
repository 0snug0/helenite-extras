export const POLL_MS = 1000;
// Store keys, as the page uses them through ctx.store (which stores them as `movies:<key>`; see core/migrate-keys.js).
// Were JSON files in 99_Internal/Data and Obsidian localStorage keys.
export const DATES = "release-dates";   // tmdbId -> release date, from Radarr lookups
export const AVAIL = "availability";     // tmdbId -> { kind, on, date, checked }, from TMDB (also written by the refresh-availability job)
export const SCORES = "scores";   // tmdbId -> { lb, rt, aud, checked }: Letterboxd stars, Tomatometer, Popcornmeter
export const SCORE_DAYS = 14;
export const AVAIL_DAYS = 1;
export const SERVICES_KEY = "downloadrr-services";
// Sort choices persist in the app store, so a reload keeps them.
export const SORT_KEY = "downloadrr-sort";
export const ACTIVE_SORT_KEY = "downloadrr-active-sort";
export const RELEASE_SORT_KEY = "downloadrr-release-sort";

// Lucide icons, inlined as in movie-recs; the Radarr button carries Radarr's logo.
const icon = body => `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
export const ICONS = {
	file: icon('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m14.5 12.5-5 5"/><path d="m9.5 12.5 5 5"/>'),
	// Radarr's own logo (its /Content/Images/logo.svg), the body in the text colour so it works on any theme.
	radarr: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 1024 1025" aria-hidden="true"><g transform="translate(70 18)"><path fill="currentColor" d="M105.302 156.117L112.824 876.083C52.6511 883.662 7.52159 853.347 7.52159 792.719L0 194.01C0 4.54526 172.997 -40.9263 278.299 34.8596L812.332 345.582C887.548 398.632 902.591 497.154 864.983 565.361C857.461 512.311 834.897 481.996 789.767 451.682L188.04 110.646C142.91 80.3311 105.302 87.9097 105.302 156.117Z"/><path fill="currentColor" transform="translate(60.1727 535.046)" d="M0 378.929C45.1296 394.087 90.2591 386.508 127.867 363.772L744.638 0C782.245 53.0501 774.724 106.1 729.594 136.415L210.605 439.558C135.389 477.451 37.608 439.558 0 378.929Z"/><path fill="#FFC230" transform="translate(240.6909 284.953)" d="M0 416.822L368.558 204.622L7.52159 0L0 416.822Z"/></g></svg>',
	pause: icon('<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>'),
	play: icon('<polygon points="6 3 20 12 6 21 6 3"/>'),
	check: icon('<path d="M20 6 9 17l-5-5"/>'),
};
export const LOGOS = {
	lb: '<svg width="22" height="12" viewBox="0 0 22 12" aria-hidden="true"><circle cx="5" cy="6" r="4.5" fill="#FF8000"/><circle cx="11" cy="6" r="4.5" fill="#00E054"/><circle cx="17" cy="6" r="4.5" fill="#40BCF4"/></svg>',
	rt: '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="8" r="5.5" fill="#FA320A"/><rect x="4" y="1" width="6" height="3" rx="1.5" fill="#00912D"/></svg>',
	aud: '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="4.5" cy="4" r="2.5" fill="#FFD700"/><circle cx="9.5" cy="4" r="2.5" fill="#FFD700"/><circle cx="7" cy="3" r="2.5" fill="#FFD700"/><path d="M3 5h8l-1.2 8H4.2z" fill="#FA320A"/></svg>',
};
