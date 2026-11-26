import { statusText } from "../../core/ui-kit.js";
import lib from "./lib.js";
import { KEYS, AVAIL_DAYS, AVAIL_VERSION, SCORE_DAYS, SERIALIZD } from "./consts.js";
import { findShow, epKey } from "../../core/plex.js";
import { fillAvailability as fillTmdbAvailability } from "../../core/tmdb.js";
import { createScraper, isStale, runPool } from "../../core/scores.js";

// Part of the TV page: Plex watch state, shows Sonarr does not have yet, availability and scores. `c` is the context shared
// by every part (see index.js).
export function install(c) {
const { state, notes } = c;
const draw = (...a) => c.draw(...a);
const today = () => c.today();
const shows = () => lib.buildShows(notes, state.series, state.queue, true, state.ids);

// Plex watch state, through the shared Plex client. The show list (with watched counts) loads once; a show's episodes load
// when it is opened. A failure just leaves the marks blank.
const plexOf = show => findShow(state.plexIndex, show);
const plexEpisodes = show => { const e = plexOf(show); return e ? state.plexEps.get(e.ratingKey) : undefined; };
async function loadPlex() {
	if (!c.plexSet) return;
	try { state.plexIndex = await c.plex.getShows(); } catch (e) { console.warn("Plex:", e.message); }
}
async function loadPlexEpisodes(show) {
	const e = plexOf(show);
	if (!e || !c.plexSet) return;
	try { state.plexEps.set(e.ratingKey, await c.plex.getEpisodes(e.ratingKey)); } catch (err) { console.warn("Plex:", err.message); }
}
// Watched mark for an episode row: a check when seen, a percentage when partway through, nothing when Plex has no record.
function watchMark(parent, map, e) {
	const w = map?.get(epKey(e));
	if (!w || (!w.watched && !w.progress)) return;
	const el = statusText(parent, w.watched ? "✓ Watched" : `▶ ${Math.round(w.progress * 100)}%`, w.watched ? "success" : "warning");
	el.classList.add("dl-watch");
	el.title = w.watched ? "Watched in Plex" : "Partway through in Plex";
}

// Every watchlist show Sonarr does not have goes into Sonarr: monitored, nothing searched (so nothing downloads until a
// release is picked). Needs the tvdb id that resolveIds found; a show with no lookup match stays "Not in Sonarr".
// Not when the page was opened by a deep link (c.linked): a link must never change Sonarr.
async function addMissing() {
	if (!c.client || c.linked) return;
	const todo = shows().filter(s => s.path && !s.series && s.tvdbId);
	let added = 0;
	for (const s of todo) {
		if (!c.alive()) return;
		try {
			const found = (await c.client.lookup(`tvdb:${s.tvdbId}`))[0];
			if (!found) continue;
			await c.client.addMonitored(found, state.series);
			await c.refreshSonarr();
			added++;
		} catch (e) { state.error = `Could not add ${s.title} to Sonarr: ${e.message}`; break; }
	}
	if (added) draw();
}

// Where each show can be watched in the US (stream / rent-buy / coming), from TMDB's watch providers. Cached for AVAIL_DAYS,
// refreshed in the background. A show's first air date stands in for a film's release date.
// Core's fillAvailability throws when TMDB is not configured, so it is gated on tmdb.isSet() here.
async function fillAvailability() {
	if (!(await c.tmdb.isSet())) return;
	await fillTmdbAvailability({
		tmdb: c.tmdb, kind: "tv", label: "TV", concurrency: 3, progressEvery: 5,
		ids: shows().map(c.tmdbOf), cache: state.avail,
		today: today(), version: AVAIL_VERSION, days: AVAIL_DAYS,
		save: cache => c.ctx.store.set(KEYS.avail, cache),
		onProgress: () => { if (c.alive() && !c.sortFocused()) draw(); },
	});
	if (c.alive() && !c.sortFocused()) draw();
}

// Serializd average (out of 5, from the payload behind the show page's Stats box; Serializd stores 0–10) and the RT
// critics/audience scores for each show, scraped from the public pages. The RT page comes from Wikidata by TheTVDB id
// (P4835 -> P1258), cached SCORE_DAYS. A show with nothing found is not cached, so it is tried again next load.
async function fillScores() {
	if (!c.settings.SCRAPE_SCORES) return;
	const day = today();
	// Entries from before the Serializd score (no `sz` key) count as stale, so every show picks it up once.
	const todo = new Map();
	for (const s of shows()) if (s.tvdbId && isStale(state.scores[s.tvdbId], day, SCORE_DAYS, e => !("sz" in e))) todo.set(s.tvdbId, s);
	const need = [...todo.values()];
	if (!need.length) return;
	const { get, num } = createScraper(c.request);
	const one = async show => {
		const tmdbId = show.tmdbId || show.series?.tmdbId;
		let sz = null;
		if (tmdbId) { try { const avg = JSON.parse(await get(`${SERIALIZD}/${tmdbId}`, { "X-Requested-With": "serializd_vercel", Accept: "application/json" })).averageRating; sz = typeof avg === "number" && avg > 0 ? Math.round(avg * 50) / 100 : null; } catch (e) { /* leave null */ } }
		let rt = null, aud = null, rtUrl = null;
		try {
			const q = `SELECT ?rt WHERE { ?i wdt:P4835 "${show.tvdbId}"; wdt:P1258 ?rt }`;
			const wd = JSON.parse(await get(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(q)}`, { Accept: "application/sparql-results+json" }));
			const slug = wd.results.bindings[0]?.rt?.value;
			if (slug) {
				rtUrl = `https://www.rottentomatoes.com/${slug}`;
				const page = await get(rtUrl);
				rt = num(page, /"criticsScore":\{[^}]*?"scorePercent":"(\d+)%"/);
				aud = num(page, /"audienceScore":\{[^}]*?"scorePercent":"(\d+)%"/);
			}
		} catch (e) { /* no RT slug: leave null */ }
		// IMDb: Sonarr knows each series' tt id; OMDb (needs the OMDB_API_KEY secret) gives the rating.
		const imdbId = show.series?.imdbId || null;
		const imdbUrl = imdbId ? `https://www.imdb.com/title/${imdbId}/` : null;
		let imdb = null;
		if (imdbId && c.omdbKey) { try { const v = JSON.parse(await get(`https://www.omdbapi.com/?i=${imdbId}&apikey=${c.omdbKey}`)).imdbRating; imdb = v && v !== "N/A" ? Number(v) : null; } catch (e) { /* leave null */ } }
		if (sz != null || rt != null || aud != null || imdb != null) state.scores[show.tvdbId] = { sz, rt, aud, rtUrl, imdb, imdbUrl, checked: day };
	};
	await runPool(need, 3, one, { every: 3, onStep: () => { if (c.alive() && !c.sortFocused()) draw(); } });
	await c.ctx.store.set(KEYS.scores, state.scores).catch(e => console.error(e));
	if (c.alive() && !c.sortFocused()) draw();
}

Object.assign(c, { plexOf, plexEpisodes, loadPlex, loadPlexEpisodes, watchMark, addMissing, fillAvailability, fillScores });
}
