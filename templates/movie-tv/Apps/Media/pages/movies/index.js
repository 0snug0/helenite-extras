// Movies page (was the Downloadrr app): every film whose note is on the watchlist or pending, with Radarr status and an
// interactive release picker. `export default` is a PageMount: (el, ctx) => cleanup. See ../../view.js for ctx.
//
// The original closure is split into parts that share one context object `c` (state, clients, ...):
// services.js (Radarr refresh + SABnzbd polling), cards.js (page), releases.js (release picker panel), active.js (top
// table), actions.js (removals), fill.js (dates, availability, scores, Plex). Each exports install(c).
// Shared code is in ../../core/: services (SABnzbd, Plex, TMDB), the release table and modal, posters, score badges.
// Store keys are used under their old names through ctx.store, which stores them as `movies:<key>` (core/migrate-keys.js).
// TODO(ui-kit): the release modal and the two-click delete (active.js xButton) become ui-kit `form`/`confirm` overlays
// once the host renders app modals; until then they stay inline.
import lib from "./lib.js";
import * as fl from "../../core/films.js";
import { createClient } from "./radarr.js";
import { createServices } from "../../core/services.js";
import { createAddSearch } from "../../core/add-search.js";
import { createReleaseModal } from "../../core/modal.js";
import { button, emptyState, kitIconRenderer, setBridge, setIconRenderer } from "../../core/ui-kit.js";
import { DATES, AVAIL, SCORES, SERVICES_KEY, SORT_KEY, ACTIVE_SORT_KEY, ICONS } from "./consts.js";
import { install as installServices } from "./services.js";
import { install as installReleases } from "./releases.js";
import { install as installCards } from "./cards.js";
import { install as installActive } from "./active.js";
import { install as installActions } from "./actions.js";
import { install as installFill } from "./fill.js";

const savedObject = v => (v && typeof v === "object" && !Array.isArray(v) ? v : null);

export default async function mount(host, ctx) {
	const { api } = ctx;
	setBridge(api);
	// ui-kit draws its standard icons; this page's own (file, Radarr, pause, play) are inline SVG strings.
	setIconRenderer((el, name) => { if (!ICONS[name]) return kitIconRenderer(el, name); el.dataset.icon = name; el.innerHTML = ICONS[name]; });
	const root = host.createDiv({ cls: "media-movies media-scope" });
	let dispose = null, booting = false;
	// Back from Settings with the Radarr key now saved: start the page for real.
	const offParams = ctx.onParams(() => { if (!dispose && !booting) boot().catch(() => { /* the setup state or the failed first boot already shows */ }); });
	async function boot() {
		booting = true;
		try {
			const have = (await api.secrets.status()) ?? {};   // { NAME: true|false }: whether each secret is set, never its value
			if (!have.RADARR_API_KEY) { drawSetup(root, ctx); return; }
			root.empty();
			dispose = await start(root, ctx, have);
		} finally { booting = false; }
	}
	try { await boot(); }
	catch (e) {
		// Nothing may stay behind: no listener, no element. The shell shows its error pane with Retry.
		offParams();
		root.remove();
		throw e;
	}
	return () => { offParams(); dispose?.(); dispose = null; root.remove(); };
}

// No Radarr key: nothing to show but a way to get one set. Other services missing is fine, the page degrades.
function drawSetup(root, ctx) {
	root.empty();
	const box = root.createDiv({ cls: "dl-setup" });
	emptyState(box, "Radarr is not set up yet. Add the Radarr API key in Settings to see your films here.");
	button(box, { text: "Open Settings", variant: "primary", onClick: () => ctx.go("settings") });
}

async function start(root, ctx, have) {
	const { api } = ctx;
	const disposers = [];
	const timeouts = new Set();
	let alive = true;
	const store = await ctx.store.all();   // keys unprefixed here; ctx.store prefixes them with "movies:" on disk
	const settings = api.settings ?? {};
	const services = createServices(api);
	const c = {
		api, ctx, settings, store, root, services,
		sab: services.sab, plex: services.plex, tmdb: services.tmdb,
		request: (...a) => api.net.fetch(...a),   // CORS-free, limited to the manifest's net hosts; secrets are placeholders it fills in
		component: { register: fn => disposers.push(fn) },
		alive: () => alive,
		save: (k, v) => { store[k] = v; return Promise.resolve(ctx.store.set(k, v)).catch(e => console.error(e)); },
		later: (fn, ms) => { const t = setTimeout(() => { timeouts.delete(t); if (alive) fn(); }, ms); timeouts.add(t); return t; },
	};
	const state = c.state = { filter: "all", movies: [], queue: [], error: null, panel: null, cache: new Map(), pollUntil: 0, grabbing: null, removing: null, armed: null, activeSort: { key: "title", dir: "asc" }, sent: new Set(), loading: false, sort: "title", query: "", dates: {}, datesBusy: false, avail: {}, scores: {}, plex: {}, pausing: null, free: null, streaming: false, focus: null };
	state.streaming = store[SERVICES_KEY] === true;
	state.avail = savedObject(store[AVAIL]) ?? {};
	state.scores = savedObject(store[SCORES]) ?? {};
	state.dates = savedObject(store[DATES]) ?? {};
	const savedSort = store[SORT_KEY];
	if (lib.SORTS.some(([id]) => id === savedSort)) state.sort = savedSort;
	const savedActive = store[ACTIVE_SORT_KEY];
	if (["title", "year", "date", "status", "size", "progress", "lb", "rt", "aud"].includes(savedActive?.key)) state.activeSort = { key: savedActive.key, dir: savedActive.dir === "desc" ? "desc" : "asc" };
	c.sabSlots = new Map(); c.sabStates = new Map(); c.sabQueuePaused = false;
	c.sabSet = !!have.SABNZBD_API_KEY; c.plexSet = !!have.PLEX_TOKEN;
	c.client = createClient({ url: settings.RADARR_URL, key: "{{secret:RADARR_API_KEY}}", request: c.request });

	// dv.pages('"Films"') -> notes.query: every film note's frontmatter, from the host's metadata index.
	const filmPages = await api.notes.query({ from: `${fl.FILMS}/**/*.md` });
	const isMovie = n => fl.num(n.frontmatter.tmdb_id) && (!n.frontmatter.tmdb_type || n.frontmatter.tmdb_type === "movie");
	const notes = c.notes = filmPages
		.filter(({ frontmatter: n }) => n.on_watchlist || n.pending)
		.map(p => { const n = p.frontmatter; return {
			path: p.path,
			pending: !!n.pending,
			title: fl.nameOf(p),
			year: n.year,
			added: [fl.iso(n.watchlist_added), fl.iso(n.pending_added)].sort().at(-1),
			tmdbId: isMovie(p) ? Number(n.tmdb_id) : null,
			poster: n.poster || null,
			url: n.letterboxd_url,
		}; });
	// Scores kept on the film notes by scores.py (refreshed weekly), only the fields a note has. They win over the
	// page's own cache (state.scores) field by field; the scrape in fillScores() covers the gaps.
	const noteScores = c.noteScores = {};
	for (const p of filmPages) {
		const n = p.frontmatter;
		if (!isMovie(p)) continue;
		const got = { lb: fl.num(n.lb_rating), rt: fl.num(n.rt_score), aud: fl.num(n.rt_audience), rtUrl: n.rt_url || null, imdb: fl.num(n.imdb_rating), imdbUrl: n.imdb_url || null };
		for (const k of Object.keys(got)) if (got[k] == null) delete got[k];
		if (Object.keys(got).length) noteScores[Number(n.tmdb_id)] = got;
	}
	c.scoresFor = id => (noteScores[id] || state.scores[id]) ? { ...state.scores[id], ...noteScores[id] } : undefined;
	c.mergedScores = () => Object.fromEntries([...new Set([...Object.keys(state.scores), ...Object.keys(noteScores)])].map(id => [id, c.scoresFor(id)]));

	c.busy = () => state.grabbing || state.panel?.phase === "loading";
	// The sandbox has no popups and no host workspace: both go through the host.
	c.openUrl = url => e => { e.preventDefault(); e.stopPropagation(); api.workspace.openUrl(url); };
	c.openNote = path => e => { e.preventDefault(); api.workspace.openNote(path, { newTab: e.metaKey || e.ctrlKey }); };

	for (const install of [installServices, installReleases, installCards, installActive, installActions, installFill]) install(c);
	// The release picker modal is core's; this page supplies the panel and the redraw.
	const modal = createReleaseModal({
		state, api: { ui: { overlay: on => api.ui?.overlay?.(on) } },
		draw: () => c.draw(), releasePanel: film => c.releasePanel(film), register: fn => disposers.push(fn), onHide: ctx.onHide,
	});
	Object.assign(c, { drawModal: modal.drawModal, redrawModal: modal.redrawModal });

	// "Find a film to monitor": Radarr's own title search; Add puts the film on the monitor list (monitored, not searched).
	c.addSearch = createAddSearch({
		placeholder: "Find a movie to monitor…",
		serviceName: "Radarr",
		redraw: () => c.draw(),
		lookup: async term => (await c.client.lookup(term)).filter(r => r.tmdbId).map(r => ({ key: `tmdb:${r.tmdbId}`, title: r.title, year: r.year, overview: r.overview, poster: r.remotePoster ?? (r.images ?? []).find(i => i.coverType === "poster")?.remoteUrl ?? null, inLibrary: r.id > 0, monitored: !!r.monitored, raw: r })),
		add: async r => { await c.client.addMonitored(r.raw, state.movies); await c.refreshRadarr(); },
	});

	// ctx.params.id (a film's tmdb id, or its card key) scrolls to that film's card and highlights it. The release picker
	// opens by itself only when Radarr already has the film: opening it for any other film would add it to Radarr and
	// search the indexers, which a link must not do. An id that matches no film is ignored.
	let openedFor = null;
	function openFromParams() {
		const id = ctx.params?.id;
		state.focus = null;
		if (id == null || id === "" || String(id) === openedFor) return;
		const films = lib.buildFilms(c.notes, state.movies, state.queue, !state.loading && !(state.error && state.movies.length === 0));
		const film = films.find(f => f.key === String(id) || (f.tmdbId && String(f.tmdbId) === String(id)));
		if (!film) return;
		openedFor = String(id);
		state.focus = film.key;
		if (film.movie && film.tmdbId && state.panel?.key !== film.key) c.loadReleases(film, false);
		else c.draw();
		const card = [...root.querySelectorAll(".dl-card")].find(el => el.dataset.filmKey === film.key);
		card?.scrollIntoView?.({ block: "center" });
	}
	const offFocus = ctx.onParams(() => { openedFor = null; if (c.ready && !state.loading) openFromParams(); });
	disposers.push(offFocus);

	// Render the notes first so a hung Radarr cannot blank the page; chips say "Checking Radarr" until the first fetch settles.
	state.loading = true;
	c.draw();
	api.ui?.mark?.("first-draw");   // notes and cached state on screen, services still loading
	const ready = c.ready = (async () => {
		// SABnzbd too, or the queue numbers and pause buttons would pop in a second after the first draw; but not for long if it hangs.
		let giveUp;
		await Promise.all([c.refreshRadarr(), Promise.race([c.refreshSab(), new Promise(done => { giveUp = setTimeout(done, 2000); timeouts.add(giveUp); })])]);
		clearTimeout(giveUp); timeouts.delete(giveUp);
		state.loading = false;
		c.draw();
		api.ui?.mark?.("ready");   // Radarr and SABnzbd answered
	})();
	await ready;

	// A saved "Newest release" sort needs its dates filled, same as picking it from the dropdown.
	if (state.sort === "release") c.fillDates();
	c.fillAvailability();
	c.fillScores();
	c.refreshPlex().then(() => { if (alive && !c.sortFocused()) c.draw(); });
	openFromParams();

	return () => {
		alive = false;
		for (const t of timeouts) clearTimeout(t);
		timeouts.clear();
		for (const fn of disposers.splice(0)) fn();
	};
}
