// Media: one multi-page app (Home, Movies, TV, Settings). This file is the shell: a nav bar, a status strip and one pane per page.
// Pages are imported on first visit, mounted once, then hidden and kept alive (their state survives navigation). A page whose
// import or mount fails gets an error state with a Retry button; the nav keeps working.
import { createRouter } from "./router.js";

const NAV = [["home", "Home"], ["movies", "Movies"], ["tv", "TV"], ["settings", "Settings"]];
// Pages load on first visit. The path is built at runtime so nothing resolves a page before it is asked for.
const page = name => () => import(/* @vite-ignore */ `./pages/${name}.js`);
const PAGES = { home: page("home"), movies: page("movies"), tv: page("tv"), settings: page("settings") };
const LAST = "shell:last";

function h(parent, tag, cls, text) {
	const e = parent.ownerDocument.createElement(tag);
	if (cls) e.className = cls;
	if (text != null) e.textContent = text;
	parent.appendChild(e);
	return e;
}

// Page-scoped view of api.store: every key is prefixed "<page>:".
function scopedStore(store, page) {
	const k = key => `${page}:${key}`;
	const out = { get: key => store.get(k(key)), set: (key, value) => store.set(k(key), value) };
	if (typeof store.delete === "function") out.delete = key => store.delete(k(key));
	return out;
}

export async function mountShell(root, api, pages = PAGES) {
	const shell = h(root, "div", "media-shell");
	const nav = h(shell, "nav", "media-nav");
	const status = h(shell, "div", "media-status");
	const body = h(shell, "div", "media-body");
	const buttons = {};
	const panes = {}; // page -> { el, cleanup, params, listeners, token }
	const states = new Map(); // service -> "ok" | "down" | "unset"
	let alive = true;
	let router;

	const paramsOf = () => (api.view && api.view.params) || {};
	let stored = null;
	try { stored = await api.store.get(LAST); } catch { stored = null; }
	const p0 = paramsOf();
	let startPage = stored;
	let startParams = {};
	if (p0.page) { const { page, ...rest } = p0; startPage = page; startParams = rest; }

	const paint = () => {
		status.replaceChildren();
		for (const [service, s] of states) {
			const chip = h(status, "span", `media-chip media-chip-${s}`, service);
			chip.title = `${service}: ${s}`;
		}
		status.hidden = states.size === 0;
	};
	paint();

	function showError(pane, page, err) {
		pane.el.replaceChildren();
		const box = h(pane.el, "div", "media-error");
		h(box, "p", "media-error-title", `Could not load ${page}.`);
		h(box, "p", "media-error-detail", String((err && err.message) || err));
		const retry = h(box, "button", "media-retry", "Retry");
		retry.type = "button";
		retry.addEventListener("click", () => { pane.token = null; pane.failed = false; load(page); });
	}

	async function load(page) {
		const pane = panes[page];
		if (pane.cleanup || pane.token || pane.failed) return;
		const token = (pane.token = {});
		pane.el.replaceChildren();
		const ctx = {
			api,
			go: (p, params) => router.go(p, params),
			back: () => router.back(),
			get params() { return pane.params; },
			onParams: cb => { pane.listeners.add(cb); return () => pane.listeners.delete(cb); },
			setStatus: (service, state) => { states.set(service, state); if (alive) paint(); },
			store: scopedStore(api.store, page),
		};
		try {
			const mod = await pages[page]();
			const cleanup = await mod.default(pane.el, ctx);
			if (!alive || pane.token !== token) { if (typeof cleanup === "function") cleanup(); return; }
			pane.cleanup = typeof cleanup === "function" ? cleanup : () => {};
		} catch (err) {
			if (alive && pane.token === token) { pane.failed = true; showError(pane, page, err); }
		} finally {
			if (pane.token === token && !pane.cleanup) pane.token = null;
		}
	}

	function render({ page, params }) {
		for (const id of Object.keys(panes)) {
			panes[id].el.hidden = id !== page;
			buttons[id].classList.toggle("is-active", id === page);
			buttons[id].setAttribute("aria-current", id === page ? "page" : "false");
		}
		const pane = panes[page];
		pane.params = params;
		for (const cb of [...pane.listeners]) { try { cb(params); } catch { /* a page's listener must not break navigation */ } }
		Promise.resolve(api.store.set(LAST, page)).catch(() => {});
		load(page);
	}

	router = createRouter({ pages, initial: { page: startPage, params: startParams }, onChange: render });

	for (const [id, label] of NAV) {
		if (!(id in pages)) continue;
		const b = h(nav, "button", "media-nav-btn", label);
		b.type = "button";
		b.addEventListener("click", () => router.go(id));
		buttons[id] = b;
		const el = h(body, "div", "media-page");
		el.hidden = true;
		el.dataset.page = id;
		panes[id] = { el, cleanup: null, token: null, failed: false, params: {}, listeners: new Set() };
	}

	const off = api.view && api.view.onNavigate ? api.view.onNavigate(p => {
		const { page, ...rest } = p || {};
		router.go(page, rest);
	}) : () => {};

	render(router.current());

	return () => {
		alive = false;
		off();
		for (const id of Object.keys(panes)) {
			const c = panes[id].cleanup;
			panes[id].token = null;
			panes[id].cleanup = null;
			if (c) { try { c(); } catch { /* keep tearing the rest down */ } }
		}
		shell.remove();
	};
}

export default function mount(root, api) {
	return mountShell(root, api);
}
