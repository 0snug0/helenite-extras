// TV page (was the Downloadrr TV app): every TV show whose note is on the Serializd watchlist, being watched or pending, with
// Sonarr status, a seasons/episodes panel and an interactive release picker. `export default` is a PageMount:
// (el, ctx) => cleanup. See ../../view.js for ctx.
//
// The original closure is split into parts that share one context object `c` (state, clients, ...):
// actions.js (Sonarr refresh, panel, monitoring, grabs, removals), search.js (one-click season/episode search),
// panels.js (the season list and release table), draw.js (page), active.js (top table and on-disk tree), polling.js (SABnzbd
// and the poll), fill.js (Plex, missing shows, availability, scores). Each exports install(c).
// Shared code is in ../../core/: services (SABnzbd, Plex, TMDB), the release table and modal, posters, score badges.
// Store keys are used under their old names through ctx.store, which stores them as `tv:<key>` (core/migrate-keys.js).
// TODO(ui-kit): the release modal and the two-click delete (active.js xButton) become ui-kit `form`/`confirm` overlays
// once the host renders app modals; until then they stay inline.
import lib from "./lib.js";
import * as fl from "../../core/films.js";
import { createClient } from "./sonarr.js";
import { createServices } from "../../core/services.js";
import { createAddSearch } from "../../core/add-search.js";
import { createReleaseModal } from "../../core/modal.js";
import { button, emptyState, kitIconRenderer, setBridge, setIconRenderer } from "../../core/ui-kit.js";
import { KEYS, POLL_MS, ICONS } from "./consts.js";
import { install as installActions } from "./actions.js";
import { install as installSearch } from "./search.js";
import { install as installPanels } from "./panels.js";
import { install as installDraw } from "./draw.js";
import { install as installActive } from "./active.js";
import { install as installPolling } from "./polling.js";
import { install as installFill } from "./fill.js";

const savedObject = v => (v && typeof v === "object" && !Array.isArray(v) ? v : null);

export default async function mount(host, ctx) {
	const { api } = ctx;
	setBridge(api);
	// ui-kit draws its standard icons; this page's own (file, Sonarr, bookmark, grid, pause, play) are inline SVG strings.
	setIconRenderer((el, name) => { if (!ICONS[name]) return kitIconRenderer(el, name); el.dataset.icon = name; el.innerHTML = ICONS[name]; });
	const root = host.createDiv({ cls: "media-tv media-scope" });
	let dispose = null, booting = false;
	// Back from Settings with the Sonarr key now saved: start the page for real.
	const offParams = ctx.onParams(() => { if (!dispose && !booting) boot().catch(() => { /* the setup state or the failed first boot already shows */ }); });
	async function boot() {
		booting = true;
		try {
			const have = (await api.secrets.status()) ?? {};   // { NAME: true|false }: whether each secret is set, never its value
			if (!have.SONARR_API_KEY) { drawSetup(root, ctx); return; }
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

// No Sonarr key: nothing to show but a way to get one set. Other services missing is fine, the page degrades.
function drawSetup(root, ctx) {
	root.empty();
	const box = root.createDiv({ cls: "dl-setup" });
	emptyState(box, "Sonarr is not set up yet. Add the Sonarr API key in Settings to see your shows here.");
	button(box, { text: "Open Settings", variant: "primary", onClick: () => ctx.go("settings") });
}

async function start(root, ctx, have) {
	const { api } = ctx;
	const disposers = [];
	const timeouts = new Set();
	let alive = true;
	const store = await ctx.store.all();   // keys unprefixed here; ctx.store prefixes them with "tv:" on disk
	const settings = api.settings ?? {};
	const services = createServices(api);
	const c = {
		api, ctx, settings, store, root, services, notes: [],
		sab: services.sab, plex: services.plex, tmdb: services.tmdb,
		request: (...a) => api.net.fetch(...a),   // CORS-free, limited to the manifest's net hosts; secrets are placeholders it fills in
		component: { register: fn => disposers.push(fn) },
		alive: () => alive,
		save: (k, v) => { store[k] = v; return Promise.resolve(ctx.store.set(k, v)).catch(e => console.error(e)); },
		later: (fn, ms) => { const t = setTimeout(() => { timeouts.delete(t); if (alive) fn(); }, ms); timeouts.add(t); return t; },
		// A deep link must never change Sonarr: the page does not add the watchlist's missing shows when opened by one.
		linked: ctx.params?.id != null && ctx.params.id !== "",
	};
	const state = c.state = { filter: "all", series: [], queue: [], error: null, panel: null, cache: new Map(), pollUntil: 0, grabbing: null, removing: null, armed: null, activeSort: { key: "title", dir: "asc" }, sent: new Set(), loading: false, sort: "title", query: "", ids: {}, pausing: null, free: null, trees: {}, open: new Set(), openSeason: new Set(), avail: {}, scores: {}, streaming: false, plexIndex: null, plexEps: new Map(), focus: null };
	state.streaming = store[KEYS.services] === true;
	state.scores = savedObject(store[KEYS.scores]) ?? {};
	state.avail = savedObject(store[KEYS.avail]) ?? {};
	state.ids = savedObject(store[KEYS.ids]) ?? {};
	if (lib.SORTS.some(([id]) => id === store[KEYS.sort])) state.sort = store[KEYS.sort];
	const savedActive = store[KEYS.activeSort];
	if (["title", "date", "status", "size", "progress"].includes(savedActive?.key)) state.activeSort = { key: savedActive.key, dir: savedActive.dir === "desc" ? "desc" : "asc" };
	c.sabSlots = new Map(); c.sabStates = new Map(); c.sabQueuePaused = false;
	c.sabSet = !!have.SABNZBD_API_KEY; c.plexSet = !!have.PLEX_TOKEN;
	c.omdbKey = have.OMDB_API_KEY ? "{{secret:OMDB_API_KEY}}" : null;   // optional: without it TV cards have no IMDb score
	c.client = createClient({ url: settings.SONARR_URL, key: "{{secret:SONARR_API_KEY}}", request: c.request });

	// Show notes (serializd_sync.py) on the Serializd watchlist, currently watching, or pending. notes.query reads every
	// note's frontmatter from the host's metadata index, so the page needs no Serializd account or network call.
	const showPages = await api.notes.query({ from: `${fl.SHOWS}/**/*.md` });
	for (const p of showPages) {
		const n = p.frontmatter;
		if (!(n.on_watchlist || n.watching || n.pending)) continue;
		const tmdbId = fl.num(n.tmdb_id) || null;
		c.notes.push({
			path: p.path,
			pending: !!n.pending,
			watching: !!n.watching,
			title: fl.nameOf(p),
			year: n.year,
			added: [fl.iso(n.watchlist_added), fl.iso(n.watching_added), fl.iso(n.pending_added)].filter(Boolean).sort().at(-1),
			tmdbId,
			poster: n.poster || null,
			url: n.serializd_url || (tmdbId ? fl.serializdUrl(tmdbId) : null),
		});
	}

	for (const install of [installActions, installSearch, installPanels, installDraw, installActive, installPolling, installFill]) install(c);
	c.busy = () => state.grabbing || state.panel?.phase === "loading";
	// The release picker modal is core's; this page supplies the panel and the redraw.
	const modal = createReleaseModal({
		state, api: { ui: { overlay: on => api.ui?.overlay?.(on) } },
		draw: () => c.draw(), releasePanel: show => c.releasePanel(show), register: fn => disposers.push(fn), onHide: ctx.onHide,
	});
	Object.assign(c, { drawModal: modal.drawModal, redrawModal: modal.redrawModal });

	// "Find a show to monitor": Sonarr's own title search; Add puts the show on the monitor list (every episode monitored, nothing searched).
	c.addSearch = createAddSearch({
		placeholder: "Find a TV show to monitor…",
		serviceName: "Sonarr",
		redraw: () => c.draw(),
		lookup: async term => (await c.client.lookup(term)).filter(r => r.tvdbId).map(r => ({ key: `tvdb:${r.tvdbId}`, title: r.title, year: r.year, overview: r.overview, poster: lib.posterOf(r), inLibrary: r.id > 0, monitored: !!r.monitored, raw: r })),
		add: async r => { await c.client.addMonitored(r.raw, state.series); await c.refreshSonarr(); },
	});

	// ctx.params.id (a show's tmdb or tvdb id, or its card key) scrolls to that show's card and highlights it. The panel opens
	// by itself only when Sonarr already has the show: opening it for any other show would add it to Sonarr, which a link
	// must not do. An id that matches no show is ignored.
	let openedFor = null;
	function openFromParams() {
		const id = ctx.params?.id;
		state.focus = null;
		if (id == null || id === "" || String(id) === openedFor) return;
		const known = !state.loading && !(state.error && state.series.length === 0);
		const shows = lib.buildShows(c.notes, state.series, state.queue, known, state.ids);
		const show = shows.find(s => s.key === String(id) || [s.tmdbId, s.tvdbId].some(x => x && String(x) === String(id)));
		if (!show) return;
		openedFor = String(id);
		state.focus = show.key;
		if (show.series && state.panel?.key !== show.key) c.openShow(show);
		else c.draw();
		const card = [...root.querySelectorAll(".dl-card")].find(el => el.dataset.showKey === show.key);
		card?.scrollIntoView?.({ block: "center" });
	}
	const offFocus = ctx.onParams(() => { openedFor = null; if (c.ready && !state.loading) openFromParams(); });
	disposers.push(offFocus);

	// Render the notes first so a hung Sonarr cannot blank the page; chips say "Checking Sonarr" until the first fetch settles.
	state.loading = true;
	c.draw();
	api.ui?.mark?.("first-draw");   // notes and cached state on screen, services still loading
	const ready = c.ready = (async () => {
		// SABnzbd too, or the queue numbers and pause buttons would pop in a second after the first draw; but not for long if it hangs.
		let giveUp;
		await Promise.all([c.refreshSonarr(), Promise.race([c.refreshSab(), new Promise(done => { giveUp = setTimeout(done, 2000); timeouts.add(giveUp); })])]);
		clearTimeout(giveUp); timeouts.delete(giveUp);
		state.loading = false;
		c.draw();
		api.ui?.mark?.("ready");   // Sonarr and SABnzbd answered
	})();
	await ready;

	c.startPolling(POLL_MS);
	c.loadPlex().then(() => { if (alive && !c.sortFocused()) c.draw(); });
	c.fillAvailability();
	c.resolveIds().then(c.addMissing).then(() => { if (alive && !c.sortFocused()) c.draw(); return Promise.all([c.fillAvailability(), c.fillScores()]); });
	openFromParams();

	return () => {
		alive = false;
		for (const t of timeouts) clearTimeout(t);
		timeouts.clear();
		for (const fn of disposers.splice(0)) fn();
	};
}
