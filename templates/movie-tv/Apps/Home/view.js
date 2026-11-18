// Home: the 00_Home dashboard as an app. Sections, in the dashboard's order: headline stats, last 10 movies,
// this week's tasks + recent notes + Google Calendar, recommended movies, new & upcoming, charts, calendar.
// Dataview (dv.view / dv.pages) is replaced by api.notes.query; every other capability is the plain app API.
// Buttons, empty and error states are @helenite/ui-kit's design-system parts (./ui-kit.js, built by scripts/build-ui-kit.mjs).
import { FILMS, filmIndex, toPage, watchRows } from "./films.js";
import { iso, startOfDay } from "./dates.js";
import { renderCalendar } from "./sections/calendar.js";
import { loadEvents, renderCalendarEvents } from "./sections/gcal.js";
import { renderRecs } from "./sections/recs.js";
import { renderRow } from "./sections/row.js";
import { renderStats } from "./sections/stats.js";
import { loadNotes, loadTasks, renderRecent, renderTasks } from "./sections/tasks.js";
import { clear, div, el, link } from "./ui.js";
import { button, errorState, notice, setBridge } from "./ui-kit.js";

const RELEASES = { data: "99_Internal/Data/movie-releases.json", keys: ["released", "upcoming"] };

export default async function mount(root, api) {
	setBridge(api);
	let alive = true;
	const host = root.ownerDocument.createElement("div");
	host.className = "home";
	root.appendChild(host);

	async function build() {
		clear(host);
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
			openApp: (id, params) => (api.workspace.openApp ? api.workspace.openApp(id, params) : notice(`Open the ${id} app from the Apps list.`)),
			refresh: () => { if (alive) build(); },
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

		const bar = div(host, "home-bar");
		div(bar, "home-title", "Home");
		const actions = div(bar, "home-actions");
		button(actions, { text: "Downloadrr", onClick: () => { ctx.openApp("downloadrr"); } });
		button(actions, { text: "Downloadrr TV", onClick: () => { ctx.openApp("downloadrr-tv"); } });
		button(actions, { text: "Refresh", onClick: ctx.refresh }).el.title = "Reload every section";

		const h = text => el(host, "h2", { cls: "home-h", text });
		const slot = () => div(host, "home-section");
		const draw = async (fn, where) => { try { await fn(where); } catch (e) { errorState(where, `Could not draw this section: ${e?.message ?? e}`); api.log(e); } };

		await draw(w => renderStats(w, ctx, { part: "numbers" }), slot());
		h("Last 10 Movies");
		await draw(w => renderRow(w, ctx, { last: 10 }), slot());

		const grid = div(host, "home-grid");
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
		selectionBox = div(host, "home-selection");
	}

	await build();
	api.ui.mark?.("ready");
	return () => { alive = false; host.remove(); };
}
