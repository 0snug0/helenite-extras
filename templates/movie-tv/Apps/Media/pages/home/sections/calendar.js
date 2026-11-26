// Month calendar of watches (one entry per viewing), Monday-first, with month navigation (movie-calendar).
import { MONTHS, addMonths, iso, startOfMonth } from "../dates.js";
import { nameOf, order, starsOf, yearOf } from "../films.js";
import { clear, div } from "../ui.js";
import { button, monthGrid, sectionHeading, toolbar } from "../../../core/ui-kit.js";

const state = { offset: 0 };

export function renderCalendar(root, ctx) {
	const byDay = new Map();
	for (const x of ctx.rows) {
		if (!byDay.has(x.date)) byDay.set(x.date, []);
		byDay.get(x.date).push(x);
	}
	for (const l of byDay.values()) l.sort((a, b) => order(a).localeCompare(order(b)));
	const box = div(root, "movie-cal");

	const film = x => {
		const name = nameOf(x.p), year = yearOf(x.p), stars = starsOf(x);
		return {
			title: name, lead: stars ? stars.toFixed(1) : "", onClick: e => ctx.openNote(x.p.file.path, e),
			tooltip: `${name}${year ? ` (${year})` : ""}${stars ? ` · ${stars.toFixed(1)} / 5` : ""}`,
		};
	};

	function render() {
		clear(box);
		const today = ctx.today;
		const month = addMonths(startOfMonth(today), state.offset);
		const prefix = iso(month).slice(0, 7);
		const monthCount = [...byDay.entries()].filter(([k]) => k.startsWith(prefix)).reduce((n, [, l]) => n + l.length, 0);

		const nav = toolbar(box);
		nav.classList.add("movie-cal-nav");
		const go = fn => () => { fn(); render(); };
		button(nav, { icon: "chevron-left", label: "Previous month", variant: "icon", onClick: go(() => state.offset--) });
		const head = sectionHeading(nav, { title: `${MONTHS[month.getMonth()]} ${month.getFullYear()}`, level: 3, extra: `${monthCount} film${monthCount === 1 ? "" : "s"}` });
		head.titleEl.classList.add("movie-cal-title");
		button(nav, { icon: "chevron-right", label: "Next month", variant: "icon", disabled: state.offset >= 0, onClick: go(() => state.offset++) });
		if (state.offset !== 0) button(nav, { text: "Today", label: "Back to this month", onClick: go(() => (state.offset = 0)) });

		monthGrid(box, { month, today, events: day => (byDay.get(day) ?? []).map(film) });
	}
	render();
}
