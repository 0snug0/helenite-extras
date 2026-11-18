import lib from "./lib.js";
import { DATES, AVAIL, SCORES, SCORE_DAYS, AVAIL_DAYS } from "./consts.js";
import { AVAIL_VERSION } from "./availability-version.js";

// Part of the Downloadrr view; `c` is the context shared by every part (see view.js).
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
			await c.api.store.set(DATES, saved).catch(e => console.error(e));
		}
	} finally {
		c.state.datesBusy = false;
		c.draw();
	}
}

// Where each film is watchable (stream / rent-buy / theaters), from TMDB. Cached for AVAIL_DAYS, refreshed in the background.
async function fillAvailability() {
	if (!c.tmdbToken || !c.requestUrl) return;
	const today = new Date().toISOString().slice(0, 10);
	const stale = c => !c || c.v !== AVAIL_VERSION || !c.checked || (Date.parse(today) - Date.parse(c.checked)) / 86400000 >= AVAIL_DAYS;
	const need = [...new Set(c.notes.map(n => n.tmdbId).filter(Boolean))].filter(id => stale(c.state.avail[id]));
	if (!need.length) return;
	let done = 0, failed = false;
	const worker = async () => {
		while (need.length && !failed) {
			const id = need.shift();
			try {
				const res = await c.requestUrl({
					url: `${c.tmdbUrl}/3/movie/${id}?append_to_response=watch/providers,release_dates`,
					headers: { Authorization: `Bearer ${c.tmdbToken}` },
					throw: false,
				});
				if (res.status === 401) { failed = true; console.error("Downloadrr: TMDB rejected the token"); break; }
				if (res.status >= 200 && res.status < 300) c.state.avail[id] = { ...lib.availability(res.json, today), checked: today, v: AVAIL_VERSION };
			} catch (e) { failed = true; console.error("Downloadrr: TMDB lookup failed", e); }
			if (++done % 10 === 0 && !c.sortFocused()) c.draw();
		}
	};
	await Promise.all([worker(), worker(), worker(), worker()]);
	if (done) await c.api.store.set(AVAIL, c.state.avail).catch(e => console.error(e));
	if (!c.sortFocused()) c.draw();
}

// Letterboxd stars, RT critics and RT audience scores for films on disk. Scraped from the public pages (the RT slug
// comes from Wikidata via TMDB external ids, as in movie_recs.py), cached SCORE_DAYS.
async function fillScores() {
	if (!c.requestUrl || !c.tmdbToken || !c.settings.SCRAPE_SCORES) return;
	await c.ready;
	const today = new Date().toISOString().slice(0, 10);
	const stale = c => !c || !c.checked || (Date.parse(today) - Date.parse(c.checked)) / 86400000 >= SCORE_DAYS;
	const need = [...new Set(lib.activeMovies(c.state.movies, c.state.queue).map(i => i.movie.tmdbId).filter(Boolean))].filter(id => !(c.noteScores[id]?.lb != null && c.noteScores[id]?.rt != null && c.noteScores[id]?.aud != null) && stale(c.state.scores[id]));
	if (!need.length) return;
	const get = async (url, headers = {}) => { try { const r = await c.requestUrl({ url, headers, throw: false }); return r.status < 300 ? r.text : ""; } catch (e) { return ""; } };
	const num = (text, re) => { const m = text.match(re); return m ? Number(m[1]) : null; };
	const one = async id => {
		const lbPage = await get(`https://letterboxd.com/tmdb/${id}/`);
		const lb = num(lbPage, /"aggregateRating":\{[^}]*?"ratingValue":([\d.]+)/);
		let rt = null, aud = null, rtUrl = null;
		try {
			const ext = JSON.parse(await get(`${c.tmdbUrl}/3/movie/${id}/external_ids`, { Authorization: `Bearer ${c.tmdbToken}` }));
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
	let done = 0;
	const worker = async () => { while (need.length) { await one(need.shift()); if (++done % 3 === 0) c.draw(); } };
	await Promise.all([worker(), worker(), worker()]);
	await c.api.store.set(SCORES, c.state.scores).catch(e => console.error(e));
	if (!c.sortFocused()) c.draw();
}

// Watch c.state from Plex (viewCount / viewOffset per movie, matched on the tmdb guid). A failure just leaves the column blank.
async function refreshPlex() {
	if (!c.plexToken || !c.requestUrl) return;
	try {
		const headers = { "X-Plex-Token": c.plexToken, Accept: "application/json" };
		const secs = await c.requestUrl({ url: `${c.plexUrl}/library/sections`, headers, throw: false });
		if (secs.status >= 300) return;
		const meta = [];
		for (const d of secs.json.MediaContainer.Directory ?? []) {
			if (d.type !== "movie") continue;
			const r = await c.requestUrl({ url: `${c.plexUrl}/library/sections/${d.key}/all?includeGuids=1`, headers, throw: false });
			if (r.status < 300) meta.push(...(r.json.MediaContainer.Metadata ?? []));
		}
		const live = await c.requestUrl({ url: `${c.plexUrl}/status/sessions`, headers, throw: false });
		c.state.plex = lib.plexWatchMap(meta, live.status < 300 ? live.json.MediaContainer.Metadata : []);
	} catch (e) { console.error("Downloadrr: Plex lookup failed", e); }
}

Object.assign(c, { fillDates, fillAvailability, fillScores, refreshPlex });
}
