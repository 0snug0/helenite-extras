// Poster row of Letterboxd watches, one box per day.
// Usage: await dv.view("99_Internal/Views/movie-row", { week: 0 })   // ISO week (Mon-Sun): 0 = this, -1 = last
//        await dv.view("99_Internal/Views/movie-row", { last: 10 })  // most recent N watches, newest first
//        await dv.view("99_Internal/Views/movie-row", { tv: true, last: 10 })      // the same from Serializd: one card per episode logged
//        await dv.view("99_Internal/Views/movie-row", { tv: true, watching: true }) // shows on the Serializd currently-watching list
// A film watched twice appears once per watch; both cards open the same film note.
const { DateTime } = dv.luxon;
const fl = new Function("module", await app.vault.adapter.read("99_Internal/Views/films-lib.js"))(undefined);
const tv = !!input?.tv;
const folder = tv ? fl.SHOWS : fl.FILMS;
const last = input?.last;
// A show's watch guid is "sz:<diary id>:S01E05" (or ":S01" for a whole season), so the episode reads back from it.
const episodeOf = guid => (String(guid ?? "").match(/^sz:\d+:(S\d+(?:E\d+)?)$/) || [])[1] ?? "";
const start = DateTime.now().startOf("week").plus({ weeks: input?.week ?? 0 });
const end = start.plus({ weeks: 1 });

// `rating` is Letterboxd's 0-5 x 2, so 7 -> 3.5 stars. A faint row of five stars
// sits under a filled row clipped to the rating's width, which renders halves exactly.
function stars(parent, rating) {
	const el = parent.createDiv({ cls: "movie-stars" });
	const r = Number(rating);
	if (!rating || !Number.isFinite(r)) {
		el.addClass("movie-stars-none");         // unrated: keep the line, show nothing
		el.setAttr("aria-label", "Not rated");
		return;
	}
	const outOf5 = Math.round(r) / 2;
	el.setAttr("aria-label", `${outOf5} of 5 stars`);
	el.setAttr("title", `${outOf5} / 5`);
	el.createSpan({ cls: "movie-stars-base", text: "★★★★★" });
	el.createSpan({ cls: "movie-stars-fill", text: "★★★★★", attr: { style: `width: ${outOf5 * 20}%` } });
}

function card(parent, p, sub, rating) {
	const name = fl.nameOf(p);
	const el = parent.createEl("a", { cls: "movie-card", attr: { href: "#", title: name } });
	el.addEventListener("click", e => {
		e.preventDefault();
		app.workspace.openLinkText(p.file.path, dv.currentFilePath, e.metaKey || e.ctrlKey);
	});
	if (p.poster) el.createEl("img", { cls: "movie-poster", attr: { src: p.poster, alt: name, loading: "lazy" } });
	else el.createDiv({ cls: "movie-poster movie-poster-missing", text: name });
	el.createDiv({ cls: "movie-year", text: sub });
	if (rating !== undefined) stars(el, rating);
	if (!tv) fl.scoreRow(el, { lb: p.lb_rating, rt: p.rt_score, aud: p.rt_audience, lbUrl: p.letterboxd_url, rtUrl: p.rt_url, imdb: p.imdb_rating, imdbUrl: p.imdb_url });
	return el;
}

// Currently watching (TV): one card per show, the episode logged last under it, newest first.
if (tv && input?.watching) {
	const shows = dv.pages(`"${folder}"`).where(p => p.watching).array()
		.map(p => ({ p, rows: fl.watchRows([p]).sort((a, b) => fl.order(b).localeCompare(fl.order(a))) }))
		.sort((a, b) => String(b.rows[0]?.date ?? fl.iso(b.p.watching_added) ?? "").localeCompare(String(a.rows[0]?.date ?? fl.iso(a.p.watching_added) ?? "")));
	if (!shows.length) dv.container.createDiv({ cls: "movie-week-empty", text: "Nothing on your Serializd currently-watching list." });
	else {
		const films = dv.container.createDiv({ cls: "movie-week" }).createDiv({ cls: "movie-day" }).createDiv({ cls: "movie-day-films" });
		for (const { p, rows } of shows) {
			const ep = episodeOf(rows[0]?.guid);
			card(films, p, ep ? `Last: ${ep}` : "Not started").setAttr("title", `${fl.nameOf(p)}${rows[0] ? ` · last logged ${rows[0].date}` : ""}`);
		}
	}
	return;
}

// One row per viewing: { p: film page, date, rating, n }.
const dated = fl.watchRows(dv.pages(`"${folder}"`)).map(x => ({ ...x, d: DateTime.fromISO(x.date) }));
const sorted = last
	? dated.sort((a, b) => fl.order(b).localeCompare(fl.order(a)))
	: dated.filter(x => x.d >= start && x.d < end).sort((a, b) => fl.order(a).localeCompare(fl.order(b)));
// TV: episodes of one show logged back to back on the same day become one card ("S01E01–E05 · 5 episodes").
// `last` then counts those cards, not episodes.
const runs = [];
for (const x of sorted) {
	const prev = runs.at(-1);
	if (tv && prev && prev.date === x.date && prev.p.file.path === x.p.file.path) prev.eps.push(x);
	else runs.push({ ...x, eps: [x] });
}
const entries = last ? runs.slice(0, last) : runs;
// "S01E05", "S01E01–E05", "S01E09–S02E02" (by episode order, whatever order they were logged in).
function episodeRange(eps) {
	const codes = eps.map(e => episodeOf(e.guid)).filter(Boolean).sort();
	if (!codes.length) return "";
	const [a, b] = [codes[0], codes.at(-1)];
	if (a === b) return a;
	return a.slice(0, 3) === b.slice(0, 3) ? `${a}–${b.slice(3)}` : `${a}–${b}`;
}

if (!last) dv.container.createDiv({
	cls: "movie-week-range",
	text: `${start.toFormat("kkkk-'W'WW")} · ${start.toFormat("LLL d")} – ${end.minus({ days: 1 }).toFormat("LLL d")}`,
});

if (entries.length === 0) {
	dv.container.createDiv({ cls: "movie-week-empty", text: tv ? "No episodes logged." : "No movies logged." });
} else {
	const row = dv.container.createDiv({ cls: "movie-week" });
	// One box per day; the date sits centered over however many films share it.
	const days = new Map();
	for (const x of entries) {
		if (!days.has(x.date)) days.set(x.date, []);
		days.get(x.date).push(x);
	}
	for (const group of days.values()) {
		const day = row.createDiv({ cls: "movie-day" });
		day.createDiv({ cls: "movie-date", text: group[0].d.toFormat("ccc MM/dd") });
		const films = day.createDiv({ cls: "movie-day-films" });
		for (const { p, rating, guid, eps } of group) {
			if (!tv) { card(films, p, String(fl.yearOf(p)), rating); continue; }
			// A run's stars are the average of its rated episodes.
			const rated = eps.map(e => Number(e.rating)).filter(r => r > 0);
			const avg = rated.length ? rated.reduce((s, r) => s + r, 0) / rated.length : null;
			const el = card(films, p, episodeRange(eps) || episodeOf(guid) || String(fl.yearOf(p)), eps.length > 1 ? avg : rating);
			if (eps.length > 1) {
				el.addClass("movie-card-run");
				el.createDiv({ cls: "movie-run-count", text: `${eps.length} episodes` });
				el.setAttr("title", `${fl.nameOf(p)} · ${eps.length} episodes`);
			}
		}
	}
}
