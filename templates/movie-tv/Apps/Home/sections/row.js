// Poster row of Letterboxd watches, one box per day (movie-row). { last: N } = newest N watches.
import { fmtDayLabel, parse } from "../dates.js";
import { nameOf, order, yearOf } from "../films.js";
import { div, el, link, scoreRow } from "../ui.js";
import { emptyState } from "../ui-kit.js";

function stars(parent, rating) {
	const node = div(parent, "movie-stars");
	const r = Number(rating);
	if (!rating || !Number.isFinite(r)) {
		node.classList.add("movie-stars-none");
		node.setAttribute("aria-label", "Not rated");
		return;
	}
	const outOf5 = Math.round(r) / 2;
	node.setAttribute("aria-label", `${outOf5} of 5 stars`);
	node.title = `${outOf5} / 5`;
	el(node, "span", { cls: "movie-stars-base", text: "★★★★★" });
	el(node, "span", { cls: "movie-stars-fill", text: "★★★★★", attr: { style: `width: ${outOf5 * 20}%` } });
}

export function renderRow(root, ctx, { last = 10 } = {}) {
	const entries = [...ctx.rows].sort((a, b) => order(b).localeCompare(order(a))).slice(0, last);
	if (!entries.length) return emptyState(root, "No movies logged.");
	const row = div(root, "movie-week");
	const days = new Map();
	for (const x of entries) {
		if (!days.has(x.date)) days.set(x.date, []);
		days.get(x.date).push(x);
	}
	for (const group of days.values()) {
		const day = div(row, "movie-day");
		div(day, "movie-date", fmtDayLabel(parse(group[0].date)));
		const films = div(day, "movie-day-films");
		for (const { p, rating } of group) {
			const name = nameOf(p);
			const card = link(films, { cls: "movie-card", title: name, onClick: e => ctx.openNote(p.file.path, e) });
			if (p.poster) el(card, "img", { cls: "movie-poster", attr: { src: p.poster, alt: name, loading: "lazy" } });
			else div(card, "movie-poster movie-poster-missing", name);
			div(card, "movie-year", String(yearOf(p)));
			stars(card, rating);
			scoreRow(card, { lb: p.lb_rating, rt: p.rt_score, aud: p.rt_audience, lbUrl: p.letterboxd_url, rtUrl: p.rt_url, imdb: p.imdb_rating, imdbUrl: p.imdb_url }, ctx.openUrl);
		}
	}
}
