// Month calendar of watches (one entry per viewing), Monday-first, with month navigation (movie-calendar).
import { MONTHS, WEEKDAYS, addDays, addMonths, iso, sameDay, startOfMonth, startOfWeek } from "../dates.js";
import { nameOf, order, starsOf, yearOf } from "../films.js";
import { clear, div, link, span } from "../ui.js";
import { button } from "../../../core/ui-kit.js";

const SLOTS = 3;
const state = { offset: 0 };

export function renderCalendar(root, ctx) {
	const byDay = new Map();
	for (const x of ctx.rows) {
		if (!byDay.has(x.date)) byDay.set(x.date, []);
		byDay.get(x.date).push(x);
	}
	for (const l of byDay.values()) l.sort((a, b) => order(a).localeCompare(order(b)));
	const box = div(root, "movie-cal");

	function film(parent, x) {
		const name = nameOf(x.p), year = yearOf(x.p), stars = starsOf(x);
		const a = link(parent, {
			cls: "movie-cal-film", onClick: e => ctx.openNote(x.p.file.path, e),
			title: `${name}${year ? ` (${year})` : ""}${stars ? ` · ${stars.toFixed(1)} / 5` : ""}`,
		});
		span(a, "movie-cal-rating", stars ? stars.toFixed(1) : "");
		span(a, "movie-cal-name", name);
	}

	function popover(cell, day, films) {
		box.querySelectorAll(".movie-cal-popover").forEach(n => n.remove());
		const pop = div(cell, "movie-cal-popover");
		div(pop, "movie-cal-popover-title", `${day.toDateString().slice(0, 10)} · ${films.length} films`);
		const l = div(pop, "movie-cal-popover-films");
		for (const x of films) film(l, x);
		const doc = box.ownerDocument;
		const close = () => { pop.remove(); doc.removeEventListener("mousedown", onDoc, true); doc.removeEventListener("keydown", onKey, true); };
		const onDoc = e => { if (!pop.contains(e.target)) close(); };
		const onKey = e => { if (e.key === "Escape") close(); };
		doc.addEventListener("mousedown", onDoc, true);
		doc.addEventListener("keydown", onKey, true);
	}

	function render() {
		clear(box);
		const today = ctx.today;
		const month = addMonths(startOfMonth(today), state.offset);
		const prefix = iso(month).slice(0, 7);
		const monthCount = [...byDay.entries()].filter(([k]) => k.startsWith(prefix)).reduce((n, [, l]) => n + l.length, 0);

		const nav = div(box, "movie-cal-nav");
		const go = fn => () => { fn(); render(); };
		button(nav, { icon: "chevron-left", label: "Previous month", variant: "icon", onClick: go(() => state.offset--) });
		div(nav, "movie-cal-title", `${MONTHS[month.getMonth()]} ${month.getFullYear()}`);
		button(nav, { icon: "chevron-right", label: "Next month", variant: "icon", disabled: state.offset >= 0, onClick: go(() => state.offset++) });
		div(nav, "movie-cal-count", `${monthCount} film${monthCount === 1 ? "" : "s"}`);
		if (state.offset !== 0) button(nav, { text: "Today", label: "Back to this month", onClick: go(() => (state.offset = 0)) });

		const grid = div(box, "movie-cal-grid");
		for (const wd of WEEKDAYS) div(grid, "movie-cal-weekday", wd);
		const end = addDays(startOfWeek(new Date(month.getFullYear(), month.getMonth() + 1, 0)), 6);
		for (let d = startOfWeek(month); d <= end; d = addDays(d, 1)) {
			const inMonth = d.getMonth() === month.getMonth();
			const cell = div(grid, "movie-cal-day");
			if (!inMonth) cell.classList.add("is-outside");
			if (sameDay(d, today)) cell.classList.add("is-today");
			div(cell, "movie-cal-num", String(d.getDate()));
			const slots = div(cell, "movie-cal-films");
			if (!inMonth) continue;
			const films = byDay.get(iso(d)) ?? [];
			const shown = films.length > SLOTS ? films.slice(0, SLOTS - 1) : films;
			for (const x of shown) film(slots, x);
			if (films.length > SLOTS) {
				button(slots, { text: `+${films.length - shown.length} more`, onClick: e => { e.stopPropagation(); popover(cell, d, films); } }).el.classList.add("movie-cal-more");
			}
		}
	}
	render();
}
