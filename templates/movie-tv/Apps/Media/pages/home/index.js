// Home page (was the Home app): the 00_Home dashboard. Sections, in the dashboard's order: headline stats, last 10 movies,
// this week's tasks + recent notes + Google Calendar, recommended movies, new & upcoming, charts, calendar.
// `export default` is a PageMount: (el, ctx) => cleanup. See ../../view.js for ctx.
// Dataview (dv.view / dv.pages) is replaced by api.notes.query; every other capability is the plain app API.
// Links to other pages go through the router (ctx.go), never api.workspace.openApp: a film or show opens the Movies / TV
// page with params.id = its tmdb id (those pages focus + highlight it; the link is read-only).
// Home keeps nothing in the store (core/migrate-keys.js HOME_KEYS is empty); any key added later goes through ctx.store.
import { FILMS, filmIndex, toPage, watchRows } from "./films.js";
import { iso, startOfDay } from "./dates.js";
import { renderCalendar } from "./sections/calendar.js";
import { loadEvents, renderCalendarEvents } from "./sections/gcal.js";
import { renderRecs } from "./sections/recs.js";
import { renderRow } from "./sections/row.js";
import { renderStats } from "./sections/stats.js";
import { loadNotes, loadTasks, renderRecent, renderTasks } from "./sections/tasks.js";
import { clear, div, el, link } from "./ui.js";
import { button, errorState, setBridge } from "../../core/ui-kit.js";

const RELEASES = { data: "99_Internal/Data/movie-releases.json", keys: ["released", "upcoming"] };

export default async function mount(host, pageCtx) {
	const { api } = pageCtx;
	setBridge(api);
	let alive = true;
	const root = host.ownerDocument.createElement("div");
	root.className = "media-home";
	host.appendChild(root);
	const page = root.ownerDocument.createElement("div");
	page.className = "home";
	root.appendChild(page);

	async function build() {
		clear(page);
		const now = new Date();
		const notes = await api.notes.query({ from: `${FILMS}/**/*.md` }).catch(() => []);
		const pages = notes.map(toPage);
		const paths = new Set(pages.map(p => p.file.path));
		const bodies = new Map();
		let selectionBox = null;

		const ctx = {
			api, pages, today: startOfDay(now), todayIso: iso(now), bodies,
			rows: watchRows(pages), find: filmIndex(pages), pathExists: p => paths.has(p),
			openNote: (path, e) => api.workspace.openNote(path, { newTab: !!(e && (e.metaKey || e.ctrlKey)) }),
			openUrl: url => api.workspace.openUrl(url),
			// A film (or a show, when its tmdb_type is "tv") opens on its page, by tmdb id; an item with no id just opens the page.
			openTitle: item => {
				const target = item?.tmdb_type === "tv" ? "tv" : "movies";
				const id = item?.tmdb_id;
				if (id == null || id === "") pageCtx.go(target);
				else pageCtx.go(target, { id: String(id) });
			},
			refresh: () => { if (alive) build().catch(e => { if (alive) { errorState(page, `Could not refresh: ${e?.message ?? e}`); api.log?.(e); } }); },
			async loadBodies(list) {
				for (const p of list.filter(x => !bodies.has(x))) bodies.set(p, await api.vault.read(p).catch(() => ""));
			},
			showSelection(title, list) {
				if (!selectionBox) return;
				clear(selectionBox);
				const head = div(selectionBox, "home-selection-head");
				div(head, "home-panel-title", `${title} · ${list.length}`);
				button(head, { text: "Close", onClick: () => clear(selectionBox) });
				const ul = el(selectionBox, "ul", { cls: "home-selection-list" });
				for (const p of [...new Set(list)]) {
					const name = p.split("/").pop().replace(/\.md$/, "");
					link(el(ul, "li"), { text: name, title: p, onClick: e => ctx.openNote(p, e) });
				}
				selectionBox.scrollIntoView?.({ block: "nearest" });
			},
		};

		const bar = div(page, "home-bar");
		div(bar, "home-title", "Home");
		const actions = div(bar, "home-actions");
		button(actions, { text: "Movies", onClick: () => { pageCtx.go("movies"); } });
		button(actions, { text: "TV", onClick: () => { pageCtx.go("tv"); } });
		button(actions, { text: "Refresh", onClick: ctx.refresh }).el.title = "Reload every section";

		const h = text => el(page, "h2", { cls: "home-h", text });
		const slot = () => div(page, "home-section");
		const draw = async (fn, where) => { try { await fn(where); } catch (e) { errorState(where, `Could not draw this section: ${e?.message ?? e}`); api.log?.(e); } };

		await draw(w => renderStats(w, ctx, { part: "numbers" }), slot());
		h("Last 10 Movies");
		await draw(w => renderRow(w, ctx, { last: 10 }), slot());

		const grid = div(page, "home-grid");
		const recent = await loadNotes(api);
		await draw(async w => renderTasks(w, ctx, await loadTasks(api, recent)), grid);
		await draw(w => renderRecent(w, ctx, recent), grid);
		await draw(async w => renderCalendarEvents(w, ctx, await loadEvents(api, ctx.today)), grid);

		h("Recommended Movies");
		await draw(w => renderRecs(w, ctx), slot());
		h("New & Upcoming");
		await draw(w => renderRecs(w, ctx, RELEASES), slot());
		h("Movie Stats");
		await draw(w => renderStats(w, ctx, { part: "charts" }), slot());
		h("Movie Calendar");
		await draw(w => renderCalendar(w, ctx), slot());
		selectionBox = div(page, "home-selection");
	}

	try { await build(); }
	catch (e) {
		// Nothing may stay behind: no element (Home registers no listeners or timers). The shell shows its error pane with Retry.
		alive = false;
		root.remove();
		throw e;
	}
	api.ui?.mark?.("ready");
	return () => { alive = false; root.remove(); };
}
