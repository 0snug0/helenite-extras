// The multi-page shell, shared by every app that ships pages: a nav bar, a status strip and one pane per page.
// Pages are imported on first visit, mounted once, then hidden and kept alive (their state survives navigation). A page whose
// import or mount fails gets an error state with a Retry button; the nav keeps working.
// create-helenite copies this file and router.js from here into `--template app-pages`, so there is one copy to maintain.
// A page keeps its scroll position while another is shown. A "Back" control appears in the nav while there is history.
// Class names are `<prefix>-shell`, `-nav`, `-nav-btn`, `-nav-back`, `-status`, `-chip`, `-body`, `-page`, `-error`, `-retry`.
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

/** nav: [[pageId, label], ...]; pages: { id: () => import("./pages/id/index.js") }; prefix: the CSS class prefix. */
export async function mountShell(root, api, { nav: NAV, pages, prefix = "app" }) {
	const shell = h(root, "div", `${prefix}-shell`);
	const nav = h(shell, "nav", `${prefix}-nav`);
	const backBtn = h(nav, "button", `${prefix}-nav-back`, "Back");
	backBtn.type = "button";
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
			const chip = h(status, "span", `${prefix}-chip ${prefix}-chip-${s}`, service);
			chip.title = `${service}: ${s}`;
		}
		status.hidden = states.size === 0;
	};
	paint();

	function showError(pane, page, err) {
		pane.el.replaceChildren();
		const box = h(pane.el, "div", `${prefix}-error`);
		h(box, "p", `${prefix}-error-title`, `Could not load ${page}.`);
		h(box, "p", `${prefix}-error-detail`, String((err && err.message) || err));
		const retry = h(box, "button", `${prefix}-retry`, "Retry");
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
		for (const id of Object.keys(panes)) {
			panes[id].el.hidden = id !== page;
			buttons[id].classList.toggle("is-active", id === page);
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

	router = createRouter({ pages, initial: { page: startPage, params: startParams }, onChange: render });
	backBtn.addEventListener("click", () => router.back());

	for (const [id, label] of NAV) {
		if (!(id in pages)) continue;
		const b = h(nav, "button", `${prefix}-nav-btn`, label);
		b.type = "button";
		b.addEventListener("click", () => router.go(id));
		buttons[id] = b;
		const el = h(body, "div", `${prefix}-page`);
		el.hidden = true;
		el.dataset.page = id;
		panes[id] = { el, cleanup: null, token: null, failed: false, params: {}, listeners: new Set(), hideListeners: new Set() };
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
