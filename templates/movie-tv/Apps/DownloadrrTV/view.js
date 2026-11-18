// Downloadrr TV: every TV show whose note is on the watchlist or pending, with Sonarr status and an interactive release picker.
// Helenite app view: mount(root, api) is called by the host with the app's root element and its capability API, and returns a
// dispose function. Port of the vault's 99_Internal/Views/downloadrr_tv (a 1078-line DataviewJS view): the closure is now split
// across ES modules that share one `ctx` object (see install() in actions/draw/modal/panels/active/search/polling/services.js).
// Settings (service URLs) and secrets (API keys) come from the host, not from the vault's .env.
import base from "./base.js";
import lib from "./lib.js";
import * as fl from "./films.js";
import plex from "./plex.js";
import { createClient } from "./sonarr.js";
import { createAddSearch } from "./add-search.js";
import { KEYS, POLL_MS, ICONS } from "./constants.js";
import { kitIconRenderer, setBridge, setIconRenderer } from "./ui-kit.js";
import * as actions from "./actions.js";
import * as search from "./search.js";
import * as panels from "./panels.js";
import * as modal from "./modal.js";
import * as draw from "./draw.js";
import * as active from "./active.js";
import * as polling from "./polling.js";
import * as services from "./services.js";

const savedObject = v => (v && typeof v === "object" && !Array.isArray(v) ? v : null);

export default async function mount(host, api) {
	setBridge(api);
	// ui-kit draws its standard icons; this app's own (file, Sonarr, bookmark, grid, pause, play) are inline SVG strings.
	setIconRenderer((el, name) => { if (!ICONS[name]) return kitIconRenderer(el, name); el.dataset.icon = name; el.innerHTML = ICONS[name]; });
	const disposers = [];
	const store = await api.store.all();
	const settings = api.settings;
	const secret = name => `{{secret:${name}}}`;   // placeholders: the host fills them in, only for each secret's bound hosts
	const root = host.createDiv({ cls: "downloadrr" });

	const state = { filter: "all", series: [], queue: [], error: null, panel: null, cache: new Map(), pollUntil: 0, grabbing: null, removing: null, armed: null, activeSort: { key: "title", dir: "asc" }, sent: new Set(), loading: false, sort: "title", query: "", ids: {}, pausing: null, free: null, trees: {}, open: new Set(), openSeason: new Set(), avail: {}, scores: {}, streaming: false, plexIndex: null, plexEps: new Map() };
	state.streaming = store[KEYS.services] === true;
	state.scores = savedObject(store[KEYS.scores]) ?? {};
	state.avail = savedObject(store[KEYS.avail]) ?? {};
	state.ids = savedObject(store[KEYS.ids]) ?? {};
	if (lib.SORTS.some(([id]) => id === store[KEYS.sort])) state.sort = store[KEYS.sort];
	const savedActive = store[KEYS.activeSort];
	if (["title", "date", "status", "size", "progress"].includes(savedActive?.key)) state.activeSort = { key: savedActive.key, dir: savedActive.dir === "desc" ? "desc" : "asc" };

	const trim = u => String(u).replace(/\/+$/, "");
	const have = await api.secrets.status();   // { NAME: boolean }: whether each declared secret is set, never its value
	const ctx = {
		api, base, lib, plex, fl, state, root, notes: [],
		client: null, plexClient: null, tmdbToken: null, omdbKey: null,
		tmdbUrl: trim(settings.TMDB_URL),
		sab: { url: trim(settings.SABNZBD_URL), key: have.SABNZBD_API_KEY ? secret("SABNZBD_API_KEY") : null, slots: new Map(), states: new Map(), paused: false },
		modal: { el: null },
		// Sort choices and toggles persist in the app store (were Obsidian localStorage keys).
		save: (k, v) => { store[k] = v; api.store.set(k, v); },
		load: k => store[k],
		register: fn => disposers.push(fn),
	};
	if (have.TMDB_TOKEN) ctx.tmdbToken = secret("TMDB_TOKEN");
	if (have.OMDB_API_KEY) ctx.omdbKey = secret("OMDB_API_KEY");   // optional: without it TV cards have no IMDb score
	if (have.PLEX_TOKEN) ctx.plexClient = plex.createClient({ url: trim(settings.PLEX_URL), token: secret("PLEX_TOKEN"), request: api.net.fetch });   // optional: without it nothing is marked watched
	if (!have.SONARR_API_KEY) state.error = "Set the Sonarr API key in Downloadrr TV's settings.";
	else ctx.client = createClient({ url: settings.SONARR_URL, key: secret("SONARR_API_KEY"), request: api.net.fetch });

	// TV notes: tmdb_type "tv", or no TMDB movie id at all (Letterboxd's feed gives TV series none).
	// dv.pages('"Films"').where(...) -> notes.query: every film note's frontmatter, from the host's metadata index.
	const filmPages = await api.notes.query({ from: `${fl.FILMS}/**/*.md` });
	const isTv = n => n.tmdb_type === "tv" || !fl.num(n.tmdb_id);
	for (const p of filmPages) {
		const n = p.frontmatter;
		if (!((n.on_watchlist || n.pending) && isTv(n))) continue;
		ctx.notes.push({
			path: p.path,
			pending: !!n.pending,
			title: fl.nameOf(p),
			year: n.year,
			added: [fl.iso(n.watchlist_added), fl.iso(n.pending_added)].sort().at(-1),
			tmdbId: fl.num(n.tmdb_id) && n.tmdb_type === "tv" ? Number(n.tmdb_id) : null,
			poster: n.poster || null,
			url: n.letterboxd_url,
		});
	}

	// TODO(J): replace createClient/plex.createClient/SABnzbd calls by api.connectors.{sonarr,plex,sabnzbd,tmdb} when the connector SDK lands.
	// UI: buttons, the filter segmented control, both tables, badges, status dots and the empty/loading/error states are
	// @helenite/ui-kit's design-system parts (./ui-kit.js). The show cards stay hand-made: cardGrid's card has no slot for
	// the scores, availability, status badges and per-card buttons.
	// TODO(ui-kit): the season/release modal (modal.js) and the two-click delete (active.js xButton) become ui-kit
	// `form`/`confirm` overlays once the host renders app modals; until then they stay inline.
	for (const m of [actions, search, panels, modal, draw, active, polling, services]) m.install(ctx);

	// "Find a show to monitor": Sonarr's own title search; Add puts the show on the monitor list (every episode monitored, nothing searched).
	ctx.addSearch = createAddSearch({
		placeholder: "Find a TV show to monitor…",
		serviceName: "Sonarr",
		redraw: () => ctx.draw(),
		lookup: async term => {
			if (!ctx.client) throw new Error(state.error ?? "Sonarr is not configured");
			return (await ctx.client.lookup(term)).filter(r => r.tvdbId).map(r => ({ key: `tvdb:${r.tvdbId}`, title: r.title, year: r.year, overview: r.overview, poster: lib.posterOf(r), inLibrary: r.id > 0, monitored: !!r.monitored, raw: r }));
		},
		add: async r => { await ctx.client.addMonitored(r.raw, state.series); await ctx.refreshSonarr(); },
	});

	// Render the notes first so a hung Sonarr cannot blank the page; chips say "Checking Sonarr" until the first fetch settles.
	state.loading = !!ctx.client;
	ctx.draw();
	api.ui.mark("first-draw");
	// SABnzbd too, or the queue numbers and pause buttons would pop in a second after the first draw; but not for long if it hangs.
	await Promise.all([ctx.refreshSonarr(), Promise.race([ctx.refreshSab(), new Promise(done => setTimeout(done, 2000))])]);
	state.loading = false;
	ctx.draw();
	api.ui.mark("ready");

	ctx.startPolling(POLL_MS);
	ctx.loadPlex().then(() => { if (!ctx.sortFocused()) ctx.draw(); });
	ctx.fillAvailability();
	ctx.resolveIds().then(ctx.addMissing).then(() => { if (!ctx.sortFocused()) ctx.draw(); return Promise.all([ctx.fillAvailability(), ctx.fillScores()]); });

	return () => { for (const fn of disposers.splice(0)) fn(); root.remove(); };
}
