// Downloadrr TV: services. Ported from the vault's downloadrr_tv/view.js; `ctx` is the shared view context built in view.js.
import { KEYS, AVAIL_DAYS, AVAIL_VERSION, SCORE_DAYS } from "./constants.js";

export function install(ctx) {
	const { state, api, base, lib, plex, notes } = ctx;
	const requestUrl = api.net.fetch;
	const draw = (...a) => ctx.draw(...a);
	const today = (...a) => ctx.today(...a);
	const tmdbOf = (...a) => ctx.tmdbOf(...a);
	const refreshSonarr = (...a) => ctx.refreshSonarr(...a);
	const resolveIds = (...a) => ctx.resolveIds(...a);
	const sortFocused = (...a) => ctx.sortFocused(...a);
	// Plex watch state. The show list (with watched counts) loads once and on every refresh; a show's episodes load when it is opened.
	const plexOf = show => plex.findShow(state.plexIndex, show);
	const plexEpisodes = show => { const e = plexOf(show); return e ? state.plexEps.get(e.ratingKey) : undefined; };
	async function loadPlex() {
		if (!ctx.plexClient) return;
		try { state.plexIndex = await ctx.plexClient.getShows(); } catch (e) { console.warn("Plex:", e.message); }
	}
	async function loadPlexEpisodes(show) {
		const e = plexOf(show);
		if (!e || !ctx.plexClient) return;
		try { state.plexEps.set(e.ratingKey, await ctx.plexClient.getEpisodes(e.ratingKey)); } catch (err) { console.warn("Plex:", err.message); }
	}
	// Watched mark for an episode row: a check when seen, a percentage when partway through, nothing when Plex has no record.
	function watchMark(parent, map, e) {
		const w = map?.get(plex.epKey(e));
		if (!w || (!w.watched && !w.progress)) return;
		parent.createSpan(w.watched
			? { cls: "dl-watch dl-watch-done", text: "✓ Watched", attr: { title: "Watched in Plex" } }
			: { cls: "dl-watch dl-watch-part", text: `▶ ${Math.round(w.progress * 100)}%`, attr: { title: "Partway through in Plex" } });
	}
	// Every watchlist show Sonarr does not have goes into Sonarr: monitored, nothing searched (so nothing downloads until a
	// release is picked). Needs the tvdb id that resolveIds found; a show with no lookup match stays "Not in Sonarr".
	async function addMissing() {
		if (!ctx.client) return;
		const todo = lib.buildShows(notes, state.series, state.queue, true, state.ids).filter(s => s.path && !s.series && s.tvdbId);
		let added = 0;
		for (const s of todo) {
			try {
				const found = (await ctx.client.lookup(`tvdb:${s.tvdbId}`))[0];
				if (!found) continue;
				await ctx.client.addMonitored(found, state.series);
				await refreshSonarr();
				added++;
			} catch (e) { state.error = `Could not add ${s.title} to Sonarr: ${e.message}`; break; }
		}
		if (added) draw();
	}
	// Where each show can be watched in the US (stream / rent-buy / coming), from TMDB's watch providers. Cached for
	// AVAIL_DAYS, refreshed in the background. The movie page's availability() does the work: a show's first air date
	// stands in for a film's release date.
	async function fillAvailability() {
		if (!ctx.tmdbToken || !requestUrl) return;
		const day = today();
		const stale = c => !c || c.v !== AVAIL_VERSION || !c.checked || (Date.parse(day) - Date.parse(c.checked)) / 86400000 >= AVAIL_DAYS;
		const need = [...new Set(lib.buildShows(notes, state.series, state.queue, true, state.ids).map(tmdbOf).filter(Boolean))].filter(id => stale(state.avail[id]));
		if (!need.length) return;
		let done = 0, failed = false;
		const worker = async () => {
			while (need.length && !failed) {
				const id = need.shift();
				try {
					const res = await requestUrl({ url: `${ctx.tmdbUrl}/3/tv/${id}?append_to_response=watch/providers`, headers: { Authorization: `Bearer ${ctx.tmdbToken}` }, throw: false });
					if (res.status === 401) { failed = true; console.error("Downloadrr TV: TMDB rejected the token"); break; }
					if (res.status >= 200 && res.status < 300) state.avail[id] = { ...base.availability({ ...res.json, release_date: res.json.first_air_date }, day), checked: day, v: AVAIL_VERSION };
				} catch (e) { failed = true; console.error("Downloadrr TV: TMDB lookup failed", e); }
				if (++done % 5 === 0 && !sortFocused()) draw();
			}
		};
		await Promise.all([worker(), worker(), worker()]);
		if (done) await api.store.set(KEYS.avail, state.avail).catch(e => console.error(e));
		if (!sortFocused()) draw();
	}
	// Letterboxd average (from the note's Letterboxd page) and the RT critics/audience scores for each show, scraped from
	// the public pages. The RT page comes from Wikidata by TheTVDB id (P4835 -> P1258), cached SCORE_DAYS. A show with
	// nothing found is not cached, so it is tried again next load.
	async function fillScores() {
		if (!requestUrl || !api.settings.SCRAPE_SCORES) return;
		const day = today();
		const stale = c => !c || !c.checked || (Date.parse(day) - Date.parse(c.checked)) / 86400000 >= SCORE_DAYS;
		const todo = new Map();
		for (const s of lib.buildShows(notes, state.series, state.queue, true, state.ids)) if (s.tvdbId && stale(state.scores[s.tvdbId])) todo.set(s.tvdbId, s);
		const need = [...todo.values()];
		if (!need.length) return;
		const get = async (url, headers = {}) => { try { const r = await requestUrl({ url, headers, throw: false }); return r.status < 300 ? r.text : ""; } catch (e) { return ""; } };
		const num = (text, re) => { const m = text.match(re); return m ? Number(m[1]) : null; };
		const one = async show => {
			const lbPage = show.url ? await get(show.url) : "";
			const lb = num(lbPage, /"aggregateRating":\{[^}]*?"ratingValue":([\d.]+)/);
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
			// IMDb: Sonarr knows each series' tt id; OMDb (needs OMDB_API_KEY in .env) gives the rating.
			const imdbId = show.series?.imdbId || null;
			const imdbUrl = imdbId ? `https://www.imdb.com/title/${imdbId}/` : null;
			let imdb = null;
			if (imdbId && ctx.omdbKey) { try { const v = JSON.parse(await get(`https://www.omdbapi.com/?i=${imdbId}&apikey=${ctx.omdbKey}`)).imdbRating; imdb = v && v !== "N/A" ? Number(v) : null; } catch (e) { /* leave null */ } }
			if (lb != null || rt != null || aud != null || imdb != null) state.scores[show.tvdbId] = { lb, rt, aud, rtUrl, imdb, imdbUrl, checked: day };
		};
		let done = 0;
		const worker = async () => { while (need.length) { await one(need.shift()); if (++done % 3 === 0 && !sortFocused()) draw(); } };
		await Promise.all([worker(), worker(), worker()]);
		await api.store.set(KEYS.scores, state.scores).catch(e => console.error(e));
		if (!sortFocused()) draw();
	}
	loadPlex().then(() => { if (!sortFocused()) draw(); });
	fillAvailability();
	resolveIds().then(addMissing).then(() => { if (!sortFocused()) draw(); return Promise.all([fillAvailability(), fillScores()]); });

	Object.assign(ctx, { plexOf, plexEpisodes, loadPlex, loadPlexEpisodes, watchMark, addMissing, fillAvailability, fillScores });
}
