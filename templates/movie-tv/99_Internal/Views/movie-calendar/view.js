// Month calendar of Letterboxd watches (one entry per viewing), Monday-first, with month navigation.
// Usage: await dv.view("99_Internal/Views/movie-calendar")
// Every day cell is the same size and reserves three two-line slots. A day with
// four or more films shows two plus a "+N more" slot that opens the full list.
const { DateTime } = dv.luxon;
const SLOTS = 3;

const fl = new Function("module", await app.vault.adapter.read("99_Internal/Views/films-lib.js"))(undefined);
// `rating` is Letterboxd's 0-5 x 2.
const starsOf = x => Number.isFinite(Number(x.rating)) && x.rating ? (Math.round(Number(x.rating)) / 2).toFixed(1) : "";

// One entry per viewing: { p: film page, date, rating, n }.
const byDay = new Map();
for (const x of fl.watchRows(dv.pages(`"${fl.FILMS}"`))) {
	if (!byDay.has(x.date)) byDay.set(x.date, []);
	byDay.get(x.date).push(x);
}
for (const list of byDay.values()) list.sort((a, b) => fl.order(a).localeCompare(fl.order(b)));

// Dataview re-runs this view whenever a note changes; keep the month being viewed.
const state = (window.movieCalendarState ??= { offset: 0 });
const root = dv.container.createDiv({ cls: "movie-cal" });

const open = (x, e) => {
	e.preventDefault();
	e.stopPropagation();
	app.workspace.openLinkText(x.p.file.path, dv.currentFilePath, e.metaKey || e.ctrlKey);
};

function film(parent, x) {
	const name = fl.nameOf(x.p), year = fl.yearOf(x.p);
	const stars = starsOf(x);
	const a = parent.createEl("a", {
		cls: "movie-cal-film",
		attr: { href: "#", title: `${name}${year ? ` (${year})` : ""}${stars ? ` · ${stars} / 5` : ""}` },
	});
	a.addEventListener("click", e => open(x, e));
	a.createSpan({ cls: "movie-cal-rating", text: stars });
	a.createSpan({ cls: "movie-cal-name", text: name });
}

function popover(cell, day, films) {
	root.querySelectorAll(".movie-cal-popover").forEach(el => el.remove());
	const pop = cell.createDiv({ cls: "movie-cal-popover" });
	pop.createDiv({ cls: "movie-cal-popover-title", text: `${day.toFormat("ccc MMM d")} · ${films.length} films` });
	const list = pop.createDiv({ cls: "movie-cal-popover-films" });
	for (const p of films) film(list, p);
	const close = () => {
		pop.remove();
		document.removeEventListener("mousedown", onDoc, true);
		document.removeEventListener("keydown", onKey, true);
	};
	const onDoc = e => { if (!pop.contains(e.target)) close(); };
	const onKey = e => { if (e.key === "Escape") close(); };
	document.addEventListener("mousedown", onDoc, true);
	document.addEventListener("keydown", onKey, true);
}

function render() {
	root.empty();
	const today = DateTime.now().startOf("day");
	const month = today.startOf("month").plus({ months: state.offset });

	const monthCount = [...byDay.entries()]
		.filter(([k]) => k.startsWith(month.toFormat("yyyy-MM")))
		.reduce((n, [, l]) => n + l.length, 0);

	const nav = root.createDiv({ cls: "movie-cal-nav" });
	const btn = (text, label, fn, disabled = false) => {
		const b = nav.createEl("button", { cls: "movie-cal-btn", text, attr: { "aria-label": label } });
		if (disabled) b.disabled = true;
		else b.addEventListener("click", () => { fn(); render(); });
		return b;
	};
	btn("‹", "Previous month", () => state.offset--);
	nav.createDiv({ cls: "movie-cal-title", text: month.toFormat("LLLL yyyy") });
	btn("›", "Next month", () => state.offset++, state.offset >= 0);
	nav.createDiv({ cls: "movie-cal-count", text: `${monthCount} film${monthCount === 1 ? "" : "s"}` });
	if (state.offset !== 0) btn("Today", "Back to this month", () => (state.offset = 0));

	const grid = root.createDiv({ cls: "movie-cal-grid" });
	for (const wd of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) grid.createDiv({ cls: "movie-cal-weekday", text: wd });

	const last = month.endOf("month").endOf("week");
	for (let d = month.startOf("week"); d <= last; d = d.plus({ days: 1 })) {
		const inMonth = d.month === month.month;
		const cell = grid.createDiv({ cls: "movie-cal-day" });
		if (!inMonth) cell.addClass("is-outside");
		if (d.hasSame(today, "day")) cell.addClass("is-today");
		cell.createDiv({ cls: "movie-cal-num", text: String(d.day) });

		const slots = cell.createDiv({ cls: "movie-cal-films" });
		if (!inMonth) continue;
		const films = byDay.get(d.toISODate()) ?? [];
		const shown = films.length > SLOTS ? films.slice(0, SLOTS - 1) : films;
		for (const p of shown) film(slots, p);
		if (films.length > SLOTS) {
			const more = slots.createEl("button", { cls: "movie-cal-more", text: `+${films.length - shown.length} more` });
			more.addEventListener("click", e => { e.stopPropagation(); popover(cell, d, films); });
		}
	}
}

render();
