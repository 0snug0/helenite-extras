// Poster row of Letterboxd watches, one box per day (movie-row). { last: N } = newest N watches.
import { fmtDayLabel, parse } from "../dates.js";
import { nameOf, order, yearOf } from "../films.js";
import { div, scoreRow } from "../ui.js";
import { card, emptyState, mediaCard, mediaGrid, rating as stars, statusText } from "../../../core/ui-kit.js";

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
		const day = card(row, { title: fmtDayLabel(parse(group[0].date)), compact: true });
		day.el.classList.add("movie-day");
		const films = mediaGrid(day.body, { layout: "strip", minWidth: 120 });
		for (const { p, rating } of group) {
			const name = nameOf(p);
			const open = e => ctx.openTitle(p, e, p);
			const film = mediaCard(films, { art: { title: name, src: p.poster, onClick: open }, title: name, plain: true });
			film.el.classList.add("movie-card");
			film.el.title = name;
			film.el.addEventListener("click", open);
			statusText(film.body, String(yearOf(p)));
			stars(film.body, { value: rating ? Math.round(Number(rating)) / 2 : null });
			scoreRow(film.body, { lb: p.lb_rating, rt: p.rt_score, aud: p.rt_audience, lbUrl: p.letterboxd_url, rtUrl: p.rt_url, imdb: p.imdb_rating, imdbUrl: p.imdb_url }, ctx.openUrl);
		}
	}
}
