// The numbers behind the year-in-review tiles and charts (ported from movie-stats/view.js, minus the drawing).
import { dayOfYear, daysInMonth, isoWeek, parse, weekday, weeksInYear, addDays, iso } from "./dates.js";
import { reviewedDates, starsOf, yearOf as filmYear } from "./films.js";

const yearNum = p => Number(filmYear(p)) || null;

// rows: watchRows() output. Adds `d` (Date); drops invalid dates.
export const withDates = rows => rows.map(x => ({ ...x, d: parse(x.date) })).filter(x => x.d);
export const yearsOf = rows => [...new Set(rows.map(x => x.d.getFullYear()))].sort((a, b) => a - b);

export function groupBy(rows, keyOf) {
	const m = new Map();
	for (const x of rows) {
		const k = keyOf(x);
		if (k == null) continue;
		if (!m.has(k)) m.set(k, []);
		m.get(k).push(x.p.file.path);
	}
	return m;
}

// `bodies`: Map path -> note text, used only for the review count.
export function computeStats(allRows, year, now, bodies = new Map()) {
	const rows = allRows.filter(x => x.d.getFullYear() === year).sort((a, b) => a.d - b.d);
	const isCurrent = year === now.getFullYear();
	const asOf = isCurrent ? now : new Date(year, 11, 31);
	if (!rows.length) return { year, isCurrent, rows, empty: true };

	const reviewed = rows.filter(x => reviewedDates(bodies.get(x.p.file.path)).has(x.date));
	const rated = rows.map(starsOf).filter(v => v != null);
	const avgRating = rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : 0;
	const newReleases = rows.filter(x => yearNum(x.p) === year);

	const byDate = groupBy(rows, x => iso(x.d));
	const dayKeys = [...byDate.keys()].sort();
	let run = [], bestRun = [];
	for (const k of dayKeys) {
		run = run.length && iso(addDays(parse(run.at(-1)), 1)) === k ? [...run, k] : [k];
		if (run.length > bestRun.length) bestRun = run;
	}
	const [busiestDay, busiestPaths] = [...byDate.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))[0];

	const monthsElapsed = isCurrent ? now.getMonth() + now.getDate() / daysInMonth(now) : 12;
	const weeks = weeksInYear(year);
	// Early-January days of the previous ISO year count toward week 1, late-December days of the next toward the last.
	const byWeek = groupBy(rows, x => { const w = isoWeek(x.d); return w.year === year ? w.week : (x.d.getMonth() === 0 ? 1 : weeks); });
	const thisWeek = isCurrent ? (isoWeek(now).year === year ? isoWeek(now).week : weeks) : weeks;
	const byDow = groupBy(rows, x => weekday(x.d));
	const byHalf = groupBy(rows, x => starsOf(x));
	const byDecade = groupBy(rows, x => (yearNum(x.p) ? Math.floor(yearNum(x.p) / 10) * 10 : null));

	return {
		year, isCurrent, rows, empty: false, reviewed, avgRating, newReleases, byDate, dayKeys, bestRun,
		busiestDay, busiestPaths, weeks, byWeek, thisWeek, byDow, byHalf, byDecade,
		perMonth: rows.length / Math.max(1, Math.ceil(monthsElapsed)),
		perWeek: rows.length / Math.max(1, dayOfYear(asOf) / 7),
		streakPaths: bestRun.flatMap(k => byDate.get(k)),
	};
}
