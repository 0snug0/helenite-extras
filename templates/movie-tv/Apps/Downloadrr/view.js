// Downloadrr: every film whose note is on the watchlist or pending, with Radarr status and an interactive release picker.
// Helenite app view: mount(root, api) is called by the host with the app's root element and its capability API.
// It returns a dispose function. Settings (service URLs) and secrets (API keys) come from the host, not from a .env.
//
// The original 814-line closure is split into parts that share one context object `c` (state, api, client, ...):
// services.js (Radarr/SABnzbd polling), cards.js (page), releases.js (release picker), modal.js, active.js (top table),
// actions.js (removals), fill.js (dates, availability, scores, Plex). Each exports install(c).
// TODO(connectors, Session J): the client/SABnzbd/Plex/TMDB request code becomes api.connectors.{radarr,sabnzbd,plex,tmdb}.
// UI: buttons, the filter segmented control, both tables, badges and the empty/loading/error states are @helenite/ui-kit's
// design-system parts (./ui-kit.js, built by scripts/build-ui-kit.mjs). The film cards stay hand-made: cardGrid's card has
// no slot for the scores, availability, status badge and per-card buttons.
// TODO(ui-kit): the release modal (modal.js) and the two-click delete (active.js xButton) become ui-kit `form`/`confirm`
// overlays once the host renders app modals; until then they stay inline.
import lib from "./lib.js";
import * as fl from "./films.js";
import { createClient } from "./radarr.js";
import { createAddSearch } from "./add-search.js";
import { DATES, AVAIL, SCORES, SERVICES_KEY, SORT_KEY, ICONS } from "./consts.js";
import { kitIconRenderer, setBridge, setIconRenderer } from "./ui-kit.js";
import { install as installServices } from "./services.js";
import { install as installReleases } from "./releases.js";
import { install as installCards } from "./cards.js";
import { install as installModal } from "./modal.js";
import { install as installActive } from "./active.js";
import { install as installActions } from "./actions.js";
import { install as installFill } from "./fill.js";

export default async function mount(host, api) {
setBridge(api);
// ui-kit draws its standard icons; this app's own (file, Radarr, pause, play) are inline SVG strings.
setIconRenderer((el, name) => { if (!ICONS[name]) return kitIconRenderer(el, name); el.dataset.icon = name; el.innerHTML = ICONS[name]; });
const disposers = [];
const store = await api.store.all();
const settings = api.settings;
const c = { api, settings, store, component: { register: fn => disposers.push(fn) } };
c.app = { saveLocalStorage: (k, v) => { store[k] = v; api.store.set(k, v); } };
// Requests go through the host (CORS-free, limited to the manifest's net hosts). Secrets are placeholders it fills in.
c.requestUrl = api.net.fetch;
c.secret = name => `{{secret:${name}}}`;
c.root = host.createDiv({ cls: "downloadrr" });
const { root, secret } = c;

const state = c.state = { filter: "all", movies: [], queue: [], error: null, panel: null, cache: new Map(), pollUntil: 0, grabbing: null, removing: null, armed: null, activeSort: { key: "title", dir: "asc" }, sent: new Set(), loading: false, sort: "title", query: "", dates: {}, datesBusy: false, avail: {}, scores: {}, plex: {}, pausing: null, free: null, streaming: false };
state.streaming = store[SERVICES_KEY] === true;
const savedObject = v => (v && typeof v === "object" && !Array.isArray(v) ? v : null);
state.avail = savedObject(store[AVAIL]) ?? {};
state.scores = savedObject(store[SCORES]) ?? {};
state.dates = savedObject(store[DATES]) ?? {};
const savedSort = store[SORT_KEY];
if (lib.SORTS.some(([id]) => id === savedSort)) state.sort = savedSort;

const savedActive = store["downloadrr-active-sort"];
if (["title", "year", "date", "status", "size", "progress", "lb", "rt", "aud"].includes(savedActive?.key)) state.activeSort = { key: savedActive.key, dir: savedActive.dir === "desc" ? "desc" : "asc" };
c.sabSlots = new Map(); c.sabStates = new Map(); c.sabQueuePaused = false; c.client = null;
const have = await api.secrets.status();   // { NAME: true|false }: whether each declared secret is set, never its value
c.sabKey = have.SABNZBD_API_KEY ? secret("SABNZBD_API_KEY") : null;
c.sabUrl = String(settings.SABNZBD_URL).replace(/\/+$/, "");
c.tmdbToken = have.TMDB_TOKEN ? secret("TMDB_TOKEN") : null;
c.tmdbUrl = String(settings.TMDB_URL).replace(/\/+$/, "");
c.plexToken = have.PLEX_TOKEN ? secret("PLEX_TOKEN") : null;
c.plexUrl = String(settings.PLEX_URL).replace(/\/+$/, "");
if (!have.RADARR_API_KEY) state.error = "Set the Radarr API key in Downloadrr's settings.";
else c.client = createClient({ url: settings.RADARR_URL, key: secret("RADARR_API_KEY"), request: c.requestUrl });

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
// view's own cache (state.scores) field by field; the scrape in fillScores() below covers the gaps.
const noteScores = c.noteScores = {};
for (const p of filmPages) {
	const n = p.frontmatter;
	if (!isMovie(p)) continue;
	const have = { lb: fl.num(n.lb_rating), rt: fl.num(n.rt_score), aud: fl.num(n.rt_audience), rtUrl: n.rt_url || null, imdb: fl.num(n.imdb_rating), imdbUrl: n.imdb_url || null };
	for (const k of Object.keys(have)) if (have[k] == null) delete have[k];
	if (Object.keys(have).length) noteScores[Number(n.tmdb_id)] = have;
}
const scoresFor = c.scoresFor = id => (noteScores[id] || state.scores[id]) ? { ...state.scores[id], ...noteScores[id] } : undefined;
c.mergedScores = () => Object.fromEntries([...new Set([...Object.keys(state.scores), ...Object.keys(noteScores)])].map(id => [id, scoresFor(id)]));

c.busy = () => state.grabbing || state.panel?.phase === "loading";
// The sandbox has no popups and no host workspace: both go through the host.
c.openUrl = url => e => { e.preventDefault(); e.stopPropagation(); api.workspace.openUrl(url); };
c.openNote = path => e => { e.preventDefault(); api.workspace.openNote(path, { newTab: e.metaKey || e.ctrlKey }); };

for (const install of [installServices, installReleases, installCards, installModal, installActive, installActions, installFill]) install(c);

// "Find a film to monitor": Radarr's own title search; Add puts the film on the monitor list (monitored, not searched).
c.addSearch = createAddSearch({
	placeholder: "Find a movie to monitor…",
	serviceName: "Radarr",
	redraw: () => c.draw(),
	lookup: async term => {
		if (!c.client) throw new Error(state.error ?? "Radarr is not configured");
		return (await c.client.lookup(term)).filter(r => r.tmdbId).map(r => ({ key: `tmdb:${r.tmdbId}`, title: r.title, year: r.year, overview: r.overview, poster: r.remotePoster ?? (r.images ?? []).find(i => i.coverType === "poster")?.remoteUrl ?? null, inLibrary: r.id > 0, monitored: !!r.monitored, raw: r }));
	},
	add: async r => { await c.client.addMonitored(r.raw, state.movies); await c.refreshRadarr(); },
});

// Render the notes first so a hung Radarr cannot blank the page; chips say "Checking Radarr" until the first fetch settles.
state.loading = !!c.client;
c.draw();
api.ui.mark("first-draw");   // notes and cached state on screen, services still loading
const ready = c.ready = (async () => {
	// SABnzbd too, or the queue numbers and pause buttons would pop in a second after the first draw; but not for long if it hangs.
	await Promise.all([c.refreshRadarr(), Promise.race([c.refreshSab(), new Promise(done => setTimeout(done, 2000))])]);
	state.loading = false;
	c.draw();
	api.ui.mark("ready");   // Radarr and SABnzbd answered
})();
await ready;

// A saved "Newest release" sort needs its dates filled, same as picking it from the dropdown.
if (state.sort === "release") c.fillDates();
c.fillAvailability();
c.fillScores();
c.refreshPlex().then(() => { if (!c.sortFocused()) c.draw(); });

return () => { for (const fn of disposers.splice(0)) fn(); root.remove(); };
}
