import lib from "./lib.js";
import { plexWatchMap } from "../../core/plex.js";
import { fillAvailability as fillTmdbAvailability } from "../../core/tmdb.js";
import { createScraper, isStale, runPool } from "../../core/scores.js";
import { DATES, AVAIL, SCORES, SCORE_DAYS, AVAIL_DAYS } from "./consts.js";
import { AVAIL_VERSION } from "./availability-version.js";

// Part of the Movies page; `c` is the context shared by every part (see index.js).
export function install(c) {
// Release dates for films Radarr does not hold: one read-only lookup each, saved so it only happens once per film.
// Cards re-sort as dates arrive; a film with no date yet keeps sorting by its year.
async function fillDates() {
	if (!c.client || c.state.datesBusy) return;
	c.state.datesBusy = true;
	try {
		await c.ready;
		const need = lib.buildFilms(c.notes, c.state.movies, c.state.queue)
			.filter(f => f.tmdbId && !f.movie && c.state.dates[f.tmdbId] === undefined);
		let failed = false, done = 0;
		const worker = async () => {
			while (need.length && !failed) {
				const f = need.shift();
				try { c.state.dates[f.tmdbId] = lib.earliestDate(await c.client.getReleaseDates(f.tmdbId)) ?? ""; }
				catch (e) { failed = true; c.state.error = e.message; }
				if (++done % 10 === 0 && !c.sortFocused()) c.draw();
			}
		};
		await Promise.all([worker(), worker(), worker(), worker()]);
		// "" (no date known yet) stays in memory only, so unreleased films are looked up again next time.
		if (done) {
			const saved = Object.fromEntries(Object.entries(c.state.dates).filter(([, d]) => d));
			await c.ctx.store.set(DATES, saved).catch(e => console.error(e));
		}
	} finally {
		c.state.datesBusy = false;
		c.draw();
	}
}

// Where each film is watchable (stream / rent-buy / theaters), from TMDB. Cached for AVAIL_DAYS, refreshed in the background.
// Core's fillAvailability throws when TMDB is not configured, so it is gated on tmdb.isSet() here.
async function fillAvailability() {
	if (!(await c.tmdb.isSet())) return;
	await fillTmdbAvailability({
		tmdb: c.tmdb, kind: "movie", label: "Movies",
		ids: c.notes.map(n => n.tmdbId), cache: c.state.avail,
		today: new Date().toISOString().slice(0, 10), version: AVAIL_VERSION, days: AVAIL_DAYS,
		save: cache => c.ctx.store.set(AVAIL, cache),
		onProgress: () => { if (!c.sortFocused()) c.draw(); },
	});
	if (c.alive() && !c.sortFocused()) c.draw();
}

// Letterboxd stars, RT critics and RT audience scores for films on disk. Scraped from the public pages (the RT slug
// comes from Wikidata via TMDB external ids, as in movie_recs.py), cached SCORE_DAYS. The scrapers stay in this page.
async function fillScores() {
	if (!c.settings.SCRAPE_SCORES || !(await c.tmdb.isSet())) return;
	await c.ready;
	const today = new Date().toISOString().slice(0, 10);
	const need = [...new Set(lib.activeMovies(c.state.movies, c.state.queue).map(i => i.movie.tmdbId).filter(Boolean))].filter(id => !(c.noteScores[id]?.lb != null && c.noteScores[id]?.rt != null && c.noteScores[id]?.aud != null) && isStale(c.state.scores[id], today, SCORE_DAYS));
	if (!need.length) return;
	const { get, num } = createScraper(c.request);
	const one = async id => {
		const lbPage = await get(`https://letterboxd.com/tmdb/${id}/`);
		const lb = num(lbPage, /"aggregateRating":\{[^}]*?"ratingValue":([\d.]+)/);
		let rt = null, aud = null, rtUrl = null;
		try {
			const ext = JSON.parse((await c.tmdb.get(`/3/movie/${id}/external_ids`)).text);
			if (ext.wikidata_id) {
				const wd = JSON.parse(await get(`https://www.wikidata.org/wiki/Special:EntityData/${ext.wikidata_id}.json`));
				const slug = wd.entities[ext.wikidata_id].claims.P1258[0].mainsnak.datavalue.value;
				rtUrl = `https://www.rottentomatoes.com/${slug}`;
				const page = await get(rtUrl);
				rt = num(page, /"criticsScore":\{[^}]*?"score(?:Percent)?":"(\d+)%?"/);
				aud = num(page, /"audienceScore":\{[^}]*?"score(?:Percent)?":"(\d+)%?"/);
			}
		} catch (e) { /* no RT slug: leave null */ }
		// Nothing found at all (offline, blocked): do not cache, so it is tried again next load.
		if (lb != null || rt != null || aud != null) c.state.scores[id] = { lb, rt, aud, rtUrl, checked: today };
	};
	await runPool(need, 3, one, { every: 3, onStep: () => { if (c.alive()) c.draw(); } });
	await c.ctx.store.set(SCORES, c.state.scores).catch(e => console.error(e));
	if (c.alive() && !c.sortFocused()) c.draw();
}

// Watch state from Plex (viewCount / viewOffset per movie, matched on the tmdb guid), through the shared Plex client.
// A failure just leaves the column blank.
async function refreshPlex() {
	if (!c.plexSet) return;
	try {
		const meta = [];
		for (const d of (await c.plex.call("/library/sections")).Directory ?? []) {
			if (d.type !== "movie") continue;
			try { meta.push(...((await c.plex.call(`/library/sections/${d.key}/all?includeGuids=1`)).Metadata ?? [])); } catch (e) { /* skip this section */ }
		}
		const live = await c.plex.call("/status/sessions").catch(() => ({}));
		c.state.plex = plexWatchMap(meta, live.Metadata);
	} catch (e) { console.error("Movies: Plex lookup failed", e); }
}

Object.assign(c, { fillDates, fillAvailability, fillScores, refreshPlex });
}
