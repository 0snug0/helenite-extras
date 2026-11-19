// Year-in-review (movie-stats): headline tiles ("numbers") and bar charts ("charts"). Every instance shares the
// selected year. The original rewrote a Bases file on every click; an app must not write outside its globs, so a
// click now lists the films behind the number in a panel below (each opens its note).
import { fmtMonthDay, isoWeekStart, addDays, parse } from "../dates.js";
import { computeStats, withDates, yearsOf } from "../stats-data.js";
import { clear, div, plural, span } from "../ui.js";
import { button, emptyState } from "../../../core/ui-kit.js";

const state = { year: null };
const instances = new Set();
const RAMP = [[0, 224, 84], [32, 200, 180], [64, 188, 244]];
function ramp(t) {
	const seg = t <= 0.5 ? 0 : 1, u = (t - seg * 0.5) * 2;
	const [a, b] = [RAMP[seg], RAMP[seg + 1]];
	return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * u)).join(",")})`;
}
const fmt1 = n => (Math.round(n * 10) / 10).toLocaleString(undefined, { minimumFractionDigits: n % 1 ? 1 : 0, maximumFractionDigits: 1 });

function section(parent, title, extra) {
	const head = div(parent, "ms-section");
	span(head, "ms-section-title", title);
	div(head, "ms-rule");
	if (extra) span(head, "ms-section-extra", extra);
}

// part: "numbers" | "charts" | "all". `bodies` (path -> text) feeds the review count.
export function renderStats(root, ctx, { part = "all" } = {}) {
	const all = withDates(ctx.rows);
	const years = yearsOf(all);
	if (state.year == null || !years.includes(state.year)) state.year = years.at(-1) ?? ctx.today.getFullYear();
	const box = div(root, `movie-stats ms-part-${part}`);
	const tip = div(box, "ms-tip");

	const showTip = (target, text) => {
		tip.textContent = text;
		tip.classList.add("is-visible");
		const r = target.getBoundingClientRect(), o = box.getBoundingClientRect();
		const x = Math.min(Math.max(r.left + r.width / 2 - o.left, tip.offsetWidth / 2), Math.max(o.width - tip.offsetWidth / 2, 0));
		tip.style.left = `${x}px`;
		tip.style.top = `${r.top - o.top - tip.offsetHeight - 6}px`;
	};
	const hideTip = () => tip.classList.remove("is-visible");
	const clickable = (node, tipText, title, paths) => {
		node.addEventListener("mouseenter", () => showTip(node, tipText));
		node.addEventListener("mouseleave", hideTip);
		if (paths?.length) {
			node.classList.add("is-clickable");
			node.addEventListener("click", () => { hideTip(); ctx.showSelection(title, paths); });
		}
	};

	function bars(parent, items, { cls = "", colored = true, labels = true } = {}) {
		const max = Math.max(1, ...items.map(i => i.paths.length));
		const wrap = div(parent, `ms-bars ${cls}`);
		items.forEach((it, i) => {
			const n = it.paths.length;
			const col = div(wrap, "ms-bar-col");
			const bar = div(div(col, "ms-bar-track"), "ms-bar" + (it.future ? " is-future" : "") + (n ? "" : " is-zero"));
			if (!it.future) {
				bar.style.height = n ? `${Math.max(4, (n / max) * 100)}%` : "2px";
				if (colored && n) bar.style.background = ramp(items.length > 1 ? i / (items.length - 1) : 0);
				clickable(col, `${it.tip} · ${plural(n)}`, it.title ?? it.tip, it.paths);
			}
			if (labels) div(col, "ms-bar-label", it.label);
		});
		return wrap;
	}

	async function render() {
		clear(box);
		box.appendChild(tip);
		hideTip();
		const year = state.year;
		const nav = div(box, "ms-nav");
		const btn = (icon, label, delta) => {
			const i = years.indexOf(year) + delta;
			button(nav, { icon, label, variant: "icon", disabled: i < 0 || i >= years.length, onClick: () => { state.year = years[i]; renderAll(); } });
		};
		btn("chevron-left", "Previous year", -1);
		div(nav, "ms-year", String(year));
		btn("chevron-right", "Next year", 1);
		if (year === ctx.today.getFullYear()) span(nav, "ms-asof", `through ${fmtMonthDay(ctx.today)}`);

		// Review counts need each note's body; load only the notes of the selected year, once.
		const yearRows = all.filter(x => x.d.getFullYear() === year);
		await ctx.loadBodies(yearRows.map(x => x.p.file.path));
		const s = computeStats(all, year, ctx.today, ctx.bodies);
		if (s.empty) return emptyState(box, "No diary entries this year.");
		const paths = xs => xs.map(x => x.p.file.path);

		if (part !== "charts") {
			const tiles = div(box, "ms-tiles");
			const tile = (value, label, tipText, title, ps) => {
				const t = div(tiles, "ms-tile");
				div(t, "ms-tile-value", value);
				div(t, "ms-tile-label", label);
				clickable(t, tipText, title, ps);
			};
			const from = s.bestRun.length ? fmtMonthDay(parse(s.bestRun[0])) : "", to = s.bestRun.length ? fmtMonthDay(parse(s.bestRun.at(-1))) : "";
			tile(s.rows.length.toLocaleString(), "Diary entries", `All ${year} diary entries · ${plural(s.rows.length)}`, `${year} diary`, paths(s.rows));
			tile(fmt1(s.perMonth), "Per month", "Average films per month");
			tile(fmt1(s.perWeek), "Per week", "Average films per week");
			tile(String(s.reviewed.length), "Reviews", `Films you reviewed · ${plural(s.reviewed.length)}`, `${year} reviews`, paths(s.reviewed));
			tile(String(s.newReleases.length), `${year} releases`, `Films released in ${year} · ${plural(s.newReleases.length)}`, `${year} releases`, paths(s.newReleases));
			tile(String(s.bestRun.length), "Day streak", `${from} – ${to} · ${plural(s.streakPaths.length)} · watched on ${s.dayKeys.length} days`, `Longest streak · ${from} – ${to}, ${year}`, s.streakPaths);
		}
		if (part === "numbers") return;

		const activity = div(box, "ms-row ms-row-split ms-activity");
		const weekPanel = div(activity, "ms-panel ms-panel-week");
		section(weekPanel, "By week", `busiest: ${fmtMonthDay(parse(s.busiestDay))} · ${plural(s.busiestPaths.length)}`);
		const weekChart = div(weekPanel, "ms-week-chart");
		bars(weekChart, Array.from({ length: s.weeks }, (_, i) => {
			const start = isoWeekStart(year, i + 1);
			const range = `${fmtMonthDay(start)} – ${fmtMonthDay(addDays(start, 6))}`;
			const w = String(i + 1).padStart(2, "0");
			return { paths: s.byWeek.get(i + 1) ?? [], future: i + 1 > s.thisWeek, tip: `W${w} · ${range}`, title: `${year}-W${w} · ${range}` };
		}), { cls: "ms-bars-week", labels: false });
		const axis = div(weekChart, "ms-axis");
		span(axis, "", "Jan");
		span(axis, "", "Dec");

		const dowPanel = div(activity, "ms-panel ms-panel-dow");
		section(dowPanel, "By day");
		const longDows = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
		bars(dowPanel, "MTWTFSS".split("").map((label, i) => ({
			label, paths: s.byDow.get(i + 1) ?? [], tip: longDows[i], title: `${longDows[i]}s in ${year}`,
		})), { cls: "ms-bars-dow", colored: false });

		const lower = div(box, "ms-row ms-row-split");
		const left = div(lower, "ms-panel");
		section(left, "Ratings", `avg ${s.avgRating.toFixed(2)} ★`);
		const ratingWrap = div(left, "ms-ratings");
		span(ratingWrap, "ms-star-end", "★");
		bars(ratingWrap, Array.from({ length: 10 }, (_, i) => {
			const v = (i + 1) / 2;
			const label = "★".repeat(Math.floor(v)) + (v % 1 ? "½" : "");
			return { paths: s.byHalf.get(v) ?? [], tip: label, title: `Rated ${label} in ${year}` };
		}), { cls: "ms-bars-rating", colored: false, labels: false });
		span(ratingWrap, "ms-star-end", "★★★★★");

		const right = div(lower, "ms-panel");
		section(right, "Release decades");
		const decades = [...s.byDecade.keys()].sort((a, b) => a - b);
		const span10 = decades.length ? Array.from({ length: (decades.at(-1) - decades[0]) / 10 + 1 }, (_, i) => decades[0] + i * 10) : [];
		bars(right, span10.map(d => ({ label: `'${String(d).slice(2)}s`, paths: s.byDecade.get(d) ?? [], tip: `${d}s releases`, title: `${d}s films watched in ${year}` })), { cls: "ms-bars-decade" });
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
