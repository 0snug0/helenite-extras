// Year-in-review (movie-stats): headline tiles ("numbers") and bar charts ("charts"). Every instance shares the
// selected year. The original rewrote a Bases file on every click; an app must not write outside its globs, so a
// click now lists the films behind the number in a panel below (each opens its note).
import { fmtMonthDay, isoWeekStart, addDays, parse } from "../dates.js";
import { computeStats, withDates, yearsOf } from "../stats-data.js";
import { clear, div, plural } from "../ui.js";
import { barChart, button, card, emptyState, sectionHeading, statTiles, statusText, toolbar } from "../../../core/ui-kit.js";

const state = { year: null };
const instances = new Set();
const fmt1 = n => (Math.round(n * 10) / 10).toLocaleString(undefined, { minimumFractionDigits: n % 1 ? 1 : 0, maximumFractionDigits: 1 });

// A titled card around one chart.
function section(parent, cls, title, extra) {
	const c = card(parent, { compact: true });
	c.el.classList.add("ms-panel", cls);
	sectionHeading(c.body, { title, extra, level: 3 });
	return c.body;
}

// part: "numbers" | "charts" | "all". `bodies` (path -> text) feeds the review count.
export function renderStats(root, ctx, { part = "all" } = {}) {
	const all = withDates(ctx.rows);
	const years = yearsOf(all);
	if (state.year == null || !years.includes(state.year)) state.year = years.at(-1) ?? ctx.today.getFullYear();
	const box = div(root, `movie-stats ms-part-${part}`);

	// items: [{ paths, tip, title?, label?, future? }], one column each; a column with films lists them.
	function bars(parent, label, items, labels) {
		const buckets = items.map((it, i) => ({ key: String(i), value: it.paths.length, label: it.label ?? "", muted: !!it.future, title: it.future ? undefined : `${it.tip} · ${plural(it.paths.length)}` }));
		barChart(parent, { label, buckets, labels, onSelect: b => { const it = items[Number(b.key)]; ctx.showSelection(it.title ?? it.tip, it.paths); } });
	}

	async function render() {
		clear(box);
		const year = state.year;
		const nav = toolbar(box);
		nav.classList.add("ms-nav");
		const btn = (icon, label, delta) => {
			const i = years.indexOf(year) + delta;
			button(nav, { icon, label, variant: "icon", disabled: i < 0 || i >= years.length, onClick: () => { state.year = years[i]; renderAll(); } });
		};
		btn("chevron-left", "Previous year", -1);
		sectionHeading(nav, { title: String(year), level: 3 }).titleEl.classList.add("ms-year");
		btn("chevron-right", "Next year", 1);
		if (year === ctx.today.getFullYear()) statusText(nav, `through ${fmtMonthDay(ctx.today)}`).classList.add("ms-asof");

		// Review counts need each note's body; load only the notes of the selected year, once.
		const yearRows = all.filter(x => x.d.getFullYear() === year);
		await ctx.loadBodies(yearRows.map(x => x.p.file.path));
		const s = computeStats(all, year, ctx.today, ctx.bodies);
		if (s.empty) return emptyState(box, "No diary entries this year.");
		const paths = xs => xs.map(x => x.p.file.path);

		if (part !== "charts") {
			const tile = (value, label, title, heading, ps) => ({ value, label, title, onClick: ps?.length ? () => ctx.showSelection(heading, ps) : undefined });
			const from = s.bestRun.length ? fmtMonthDay(parse(s.bestRun[0])) : "", to = s.bestRun.length ? fmtMonthDay(parse(s.bestRun.at(-1))) : "";
			const tiles = statTiles(box, [
				tile(s.rows.length.toLocaleString(), "Diary entries", `All ${year} diary entries · ${plural(s.rows.length)}`, `${year} diary`, paths(s.rows)),
				tile(fmt1(s.perMonth), "Per month", "Average films per month"),
				tile(fmt1(s.perWeek), "Per week", "Average films per week"),
				tile(String(s.reviewed.length), "Reviews", `Films you reviewed · ${plural(s.reviewed.length)}`, `${year} reviews`, paths(s.reviewed)),
				tile(String(s.newReleases.length), `${year} releases`, `Films released in ${year} · ${plural(s.newReleases.length)}`, `${year} releases`, paths(s.newReleases)),
				tile(String(s.bestRun.length), "Day streak", `${from} – ${to} · ${plural(s.streakPaths.length)} · watched on ${s.dayKeys.length} days`, `Longest streak · ${from} – ${to}, ${year}`, s.streakPaths),
			]);
			tiles.classList.add("ms-tiles");
			for (const t of tiles.children) t.classList.add("ms-tile");
		}
		if (part === "numbers") return;

		const activity = div(box, "ms-row ms-activity");
		const week = section(activity, "ms-panel-week", "By week", `busiest: ${fmtMonthDay(parse(s.busiestDay))} · ${plural(s.busiestPaths.length)}`);
		bars(week, "Films per week", Array.from({ length: s.weeks }, (_, i) => {
			const start = isoWeekStart(year, i + 1);
			const range = `${fmtMonthDay(start)} – ${fmtMonthDay(addDays(start, 6))}`;
			const w = String(i + 1).padStart(2, "0");
			return { paths: s.byWeek.get(i + 1) ?? [], future: i + 1 > s.thisWeek, tip: `W${w} · ${range}`, title: `${year}-W${w} · ${range}`, label: i === 0 ? "Jan" : i === s.weeks - 1 ? "Dec" : "" };
		}), "ends");

		const dow = section(activity, "ms-panel-dow", "By day");
		const longDows = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
		bars(dow, "Films per weekday", "MTWTFSS".split("").map((label, i) => ({
			label, paths: s.byDow.get(i + 1) ?? [], tip: longDows[i], title: `${longDows[i]}s in ${year}`,
		})), "all");

		const lower = div(box, "ms-row");
		const ratings = section(lower, "ms-panel-ratings", "Ratings", `avg ${s.avgRating.toFixed(2)} ★`);
		bars(ratings, "Films per rating", Array.from({ length: 10 }, (_, i) => {
			const v = (i + 1) / 2;
			const label = "★".repeat(Math.floor(v)) + (v % 1 ? "½" : "");
			return { paths: s.byHalf.get(v) ?? [], tip: label, title: `Rated ${label} in ${year}`, label: i === 0 ? "½" : i === 9 ? "★★★★★" : "" };
		}), "ends");

		const eras = section(lower, "ms-panel-decades", "Release decades");
		const decades = [...s.byDecade.keys()].sort((a, b) => a - b);
		const span10 = decades.length ? Array.from({ length: (decades.at(-1) - decades[0]) / 10 + 1 }, (_, i) => decades[0] + i * 10) : [];
		bars(eras, "Films per release decade", span10.map(d => ({ label: `'${String(d).slice(2)}s`, paths: s.byDecade.get(d) ?? [], tip: `${d}s releases`, title: `${d}s films watched in ${year}` })), "all");
	}

	const inst = { box, render };
	instances.add(inst);
	async function renderAll() {
		for (const i of [...instances]) {
			if (i.box.isConnected) await i.render();
			else instances.delete(i);
		}
	}
	return render();
}
