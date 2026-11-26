// The multi-page shell, shared by every app that ships pages: a nav bar, a status strip and one pane per page.
// Pages are imported on first visit, mounted once, then hidden and kept alive (their state survives navigation). A page whose
// import or mount fails gets an error state with a Retry button; the nav keeps working.
// create-helenite copies this file and router.js from here into `--template app-pages`, so there is one copy to maintain.
// A page keeps its scroll position while another is shown. A "Back" control appears in the nav while there is history.
// The nav is a sticky ui-kit toolbar holding tabs, the status strip is chips and a failed page is an errorState; the caller
// passes those parts as `parts` (the shell cannot know where an app keeps its ui-kit.js). The shell's own layout classes are
// `<prefix>-shell`, `-status`, `-body` and `-page`; `-nav`, `-nav-btn`, `-nav-back`, `-chip`, `-error` and `-retry` mark the parts.
import { createRouter } from "./router.js";

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
	if (typeof store.all === "function") {
		out.all = async () => {
			const prefix = k("");
			const res = {};
			for (const [key, value] of Object.entries((await store.all()) || {})) if (key.startsWith(prefix)) res[key.slice(prefix.length)] = value;
			return res;
		};
	}
	return out;
}

const TONES = { ok: "success", down: "danger", unset: "default" };

/** nav: [[pageId, label], ...]; pages: { id: () => import("./pages/id/index.js") }; prefix: the CSS class prefix;
 *  parts: { toolbar, tabs, button, chip, errorState } from ui-kit. */
export async function mountShell(root, api, { nav: NAV, pages, prefix = "app", parts }) {
	const { toolbar, tabs, button, chip, errorState } = parts;
	const shell = h(root, "div", `${prefix}-shell`);
	const nav = toolbar(shell, { sticky: true, label: "Pages" });
	nav.classList.add(`${prefix}-nav`);
	const back = button(nav, { icon: "chevron-left", label: "Back", variant: "icon", onClick: () => router.back() });
	const backBtn = back.el;
	backBtn.classList.add(`${prefix}-nav-back`);
	backBtn.hidden = true;
	const status = h(shell, "div", `${prefix}-status`);
	const body = h(shell, "div", `${prefix}-body`);
	const buttons = {};
	const panes = {}; // page -> { el, cleanup, params, listeners, hideListeners, token }
	const states = new Map(); // service -> "ok" | "down" | "unset"
	let alive = true;
	let router;

	const paramsOf = () => (api.view && api.view.params) || {};
	// The page a tab was left on is remembered per placement ("shell:last:tab"). An embed is driven by its fence params and never
	// reads or writes it: otherwise every note that embeds the app would change the page its tab reopens on.
	const placement = (api.view && api.view.placement) || "tab";
	const lastKey = placement === "embed" ? null : `shell:last:${placement}`;
	let stored = null;
	if (lastKey) { try { stored = await api.store.get(lastKey); } catch { stored = null; } }
	const p0 = paramsOf();
	let startPage = stored;
	let startParams = {};
	if (p0.page) { const { page, ...rest } = p0; startPage = page; startParams = rest; }

	const paint = () => {
		status.replaceChildren();
		for (const [service, s] of states) {
			chip(status, service, { tone: TONES[s], title: `${service}: ${s}` }).classList.add(`${prefix}-chip`, `${prefix}-chip-${s}`);
		}
		status.hidden = states.size === 0;
	};
	paint();

	function showError(pane, page, err) {
		pane.el.replaceChildren();
		const retry = () => { pane.token = null; pane.failed = false; load(page); };
		const box = errorState(pane.el, `Could not load ${page}. ${String((err && err.message) || err)}`, retry, { retryLabel: "Retry" });
		box.classList.add(`${prefix}-error`);
		box.querySelector("button").classList.add(`${prefix}-retry`);
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
			// cb() runs each time the shell hides this page (another page was shown). Anything the page put outside its own pane
			// (a modal on document.body, an overlay) must close here: a hidden page keeps running but must not keep the screen.
			onHide: cb => { pane.hideListeners.add(cb); return () => pane.hideListeners.delete(cb); },
			setStatus: (service, state) => { states.set(service, state === "ok" || state === "down" ? state : "unset"); if (alive) paint(); },
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

	// What scrolls depends on the layout: the shell's own body when it is height-bound, else the frame document. Remember both.
	const scrollers = () => { const d = body.ownerDocument; return [body, d.scrollingElement || d.documentElement]; };
	const scrollAfterLayout = fn => { const w = body.ownerDocument.defaultView; if (w && w.requestAnimationFrame) w.requestAnimationFrame(fn); };

	let shown = null;
	let reported = false;
	function render({ page, params }) {
		const leaving = shown && shown !== page ? panes[shown] : null;
		if (leaving) leaving.scroll = scrollers().map(el => el.scrollTop);   // before hiding: hiding shrinks the page and clamps it
		shown = page;
		strip.setValue(page);
		for (const id of Object.keys(panes)) {
			panes[id].el.hidden = id !== page;
			buttons[id].setAttribute("aria-current", id === page ? "page" : "false");
		}
		if (leaving) {
			const restore = () => scrollers().forEach((el, i) => { el.scrollTop = (panes[page].scroll || [0, 0])[i]; });
			restore();
			scrollAfterLayout(restore);
		}
		backBtn.hidden = !router || !router.canBack();
		if (leaving) for (const cb of [...leaving.hideListeners]) { try { cb(); } catch { /* a page's listener must not break navigation */ } }
		const pane = panes[page];
		pane.params = params;
		for (const cb of [...pane.listeners]) { try { cb(params); } catch { /* a page's listener must not break navigation */ } }
		if (lastKey) Promise.resolve(api.store.set(lastKey, page)).catch(() => {});
		// Tell the host the page changed, so the tab's Back/Forward buttons walk the pages like a browser (the first page replaces).
		if (placement !== "embed" && api.view && api.view.page) { try { api.view.page({ page, ...params }, { replace: !reported }); } catch { /* an older host */ } reported = true; }
		load(page);
	}

	const known = NAV.filter(([id]) => id in pages);
	// The tabs call onSelect only for another tab; a click on the current one still goes to it (which drops its params).
	const strip = tabs(nav, { tabs: known.map(([id, text]) => ({ id, text })), value: "", onSelect: id => router.go(id) });
	strip.el.addEventListener("click", e => {
		const b = e.target.closest("[data-tab]");
		if (b && b.classList.contains("is-active")) router.go(b.dataset.tab);
	}, true);
	for (const [id] of known) {
		const b = strip.el.querySelector(`[data-tab="${id}"]`);
		b.classList.add(`${prefix}-nav-btn`);
		buttons[id] = b;
		const el = h(body, "div", `${prefix}-page`);
		el.hidden = true;
		el.dataset.page = id;
		panes[id] = { el, cleanup: null, token: null, failed: false, params: {}, listeners: new Set(), hideListeners: new Set() };
	}
	router = createRouter({ pages, initial: { page: startPage, params: startParams }, onChange: render });

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
