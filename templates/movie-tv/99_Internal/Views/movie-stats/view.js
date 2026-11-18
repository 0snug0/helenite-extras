// Letterboxd-style year in review, built from the film notes (one row per viewing).
// Usage: await dv.view("99_Internal/Views/movie-stats", { part: "numbers" | "charts" })
//        await dv.view("99_Internal/Views/movie-stats", { tv: true, part: ... })   // the same for TV, from the Serializd show notes:
//        one row per diary entry (an episode, or a whole-season log); "Top shows" replaces "Release decades".
// `part` splits the year nav + headline tiles from the bar charts so they can sit
// in different places on a page; omit it to render both. Every instance shares
// the selected year, so stepping the year in one re-renders the others.
// Review text lives in the note body (under its watch's "### date" heading), so this
// reads each film note of the selected year; everything else is frontmatter.
// Hovering a bar shows its count; clicking one (or a stat tile) rewrites the
// "Movie Selection" base to that set of films and opens it.
const { DateTime } = dv.luxon;

const fl = new Function("module", await app.vault.adapter.read("99_Internal/Views/films-lib.js"))(undefined);
const tv = !!input?.tv;
const UNIT = tv ? "episode" : "film";
const yearOf = p => Number(fl.yearOf(p)) || null;
const starsOf = x => Number.isFinite(Number(x.rating)) && x.rating ? Math.round(Number(x.rating)) / 2 : null;

// One row per viewing: { p: film page, d, date, rating, n }.
const all = fl.watchRows(dv.pages(`"${tv ? fl.SHOWS : fl.FILMS}"`))
	.map(x => ({ ...x, d: DateTime.fromISO(x.date) }))
	.filter(x => x.d.isValid);
const years = [...new Set(all.map(x => x.d.year))].sort((a, b) => a - b);
const now = DateTime.now();

// Survive Dataview's re-render on note changes.
// Movies and TV step their years separately.
const state = tv ? (window.tvStatsState ??= { year: now.year }) : (window.movieStatsState ??= { year: now.year });
const part = input?.part ?? "all";
const showNumbers = part !== "charts", showCharts = part !== "numbers";
if (!years.includes(state.year)) state.year = years.at(-1) ?? now.year;

const BASE = tv ? "50_Personal/Serializd/Show Selection.base" : "50_Personal/Letterboxd/Movie Selection.base";
const FOLDER = tv ? fl.SHOWS : fl.FILMS;
const root = dv.container.createDiv({ cls: `movie-stats ms-part-${part}${tv ? " ms-tv" : ""}` });
const bodyCache = new Map();
async function body(path) {
	if (!bodyCache.has(path)) bodyCache.set(path, (await dv.io.load(path)) ?? "");
	return bodyCache.get(path);
}

// Letterboxd's green -> teal -> blue, interpolated across a series.
const RAMP = [[0, 224, 84], [32, 200, 180], [64, 188, 244]];
function ramp(t) {
	const seg = t <= 0.5 ? 0 : 1, u = (t - seg * 0.5) * 2;
	const [a, b] = [RAMP[seg], RAMP[seg + 1]];
	return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * u)).join(",")})`;
}
const fmt1 = n => (Math.round(n * 10) / 10).toLocaleString(undefined, { minimumFractionDigits: n % 1 ? 1 : 0, maximumFractionDigits: 1 });

function section(parent, title, extra) {
	const head = parent.createDiv({ cls: "ms-section" });
	head.createSpan({ cls: "ms-section-title", text: title });
	head.createDiv({ cls: "ms-rule" });
	if (extra) head.createSpan({ cls: "ms-section-extra", text: extra });
}

const plural = n => `${n} ${UNIT}${n === 1 ? "" : "s"}`;
const ySingle = s => `'${String(s).replace(/'/g, "''")}'`;   // YAML single-quoted scalar

// One base, rewritten per click. The selection is an explicit list of note paths,
// so the base always shows exactly the films the bar counted (week edges, day of
// week and release decade have no clean Bases expression).
function baseYaml(title, paths) {
	const expr = `${JSON.stringify([...new Set(paths)])}.contains(file.path)`;   // a film watched twice in the set is one card
	const view = (type, name, extra = []) => [
		`  - type: ${type}`,
		`    name: ${JSON.stringify(name)}`,
		`    filters:`,
		`      and:`,
		`        - ${ySingle(expr)}`,
		`    order:`,
		`      - file.name`,
		`      - note.last_watched`,
		`      - formula.stars`,
		`    sort:`,
		`      - property: note.last_watched`,
		`        direction: DESC`,
		...extra,
	];
	return [
		`# Rewritten by 99_Internal/Views/movie-stats whenever a stat is clicked.`,
		`filters:`,
		`  and:`,
		`    - file.inFolder(${JSON.stringify(FOLDER)})`,
		`formulas:`,
		`  stars: ${ySingle('if(rating, (rating / 2).toFixed(1) + " ★", "")')}`,
		`properties:`,
		`  note.last_watched:`,
		`    displayName: Last watched`,
		`  formula.stars:`,
		`    displayName: Rating`,
		`views:`,
		...view("cards", title, [`    image: note.poster`, `    imageAspectRatio: 1.5`, `    cardSize: 160`]),
		...view("table", `${title} (table)`),
		"",
	].join("\n");
}

async function openSelection(title, paths, newTab) {
	if (!paths.length) return;
	const text = baseYaml(title, paths);
	const file = app.vault.getAbstractFileByPath(BASE);
	if (file) await app.vault.modify(file, text);
	else await app.vault.create(BASE, text);
	const open = app.workspace.getLeavesOfType("bases").find(l => l.view?.file?.path === BASE);
	if (open && !newTab) {
		app.workspace.revealLeaf(open);
		app.workspace.setActiveLeaf(open, { focus: true });
	} else {
		await app.workspace.openLinkText(BASE, dv.currentFilePath, newTab ? "tab" : false);
	}
}

// Instant tooltip shared by every chart (native `title` tooltips lag ~1s).
const tip = root.createDiv({ cls: "ms-tip" });
function showTip(target, text) {
	tip.setText(text);
	tip.addClass("is-visible");
	const r = target.getBoundingClientRect(), o = root.getBoundingClientRect();
	const x = Math.min(Math.max(r.left + r.width / 2 - o.left, tip.offsetWidth / 2), o.width - tip.offsetWidth / 2);
	tip.style.left = `${x}px`;
	tip.style.top = `${r.top - o.top - tip.offsetHeight - 6}px`;
}
const hideTip = () => tip.removeClass("is-visible");

function clickable(el, tipText, title, paths) {
	el.addEventListener("mouseenter", () => showTip(el, tipText));
	el.addEventListener("mouseleave", hideTip);
	if (paths?.length) {
		el.addClass("is-clickable");
		el.addEventListener("click", e => { hideTip(); openSelection(title, paths, e.metaKey || e.ctrlKey); });
	}
}

// items: { label, paths, tip, title, future }
function bars(parent, items, { cls = "", colored = true, labels = true } = {}) {
	const max = Math.max(1, ...items.map(i => i.paths.length));
	const wrap = parent.createDiv({ cls: `ms-bars ${cls}` });
	items.forEach((it, i) => {
		const n = it.paths.length;
		const col = wrap.createDiv({ cls: "ms-bar-col" });
		const bar = col.createDiv({ cls: "ms-bar-track" }).createDiv({ cls: "ms-bar" + (it.future ? " is-future" : "") + (n ? "" : " is-zero") });
		if (!it.future) {
			bar.style.height = n ? `${Math.max(4, (n / max) * 100)}%` : "2px";
			if (colored && n) bar.style.background = ramp(items.length > 1 ? i / (items.length - 1) : 0);
			clickable(col, `${it.tip} · ${plural(n)}`, it.title ?? it.tip, it.paths);
		}
		if (labels) col.createDiv({ cls: "ms-bar-label", text: it.label });
	});
	return wrap;
}

function groupBy(rows, keyOf) {
	const m = new Map();
	for (const x of rows) {
		const k = keyOf(x);
		if (k == null) continue;
		if (!m.has(k)) m.set(k, []);
		m.get(k).push(x.p.file.path);
	}
	return m;
}

async function render() {
	root.empty();
	root.appendChild(tip);
	hideTip();
	const year = state.year;
	const rows = all.filter(x => x.d.year === year).sort((a, b) => a.d.toMillis() - b.d.toMillis());
	const isCurrent = year === now.year;
	const asOf = isCurrent ? now : DateTime.local(year, 12, 31);

	// ---- nav
	const nav = root.createDiv({ cls: "ms-nav" });
	const btn = (text, label, delta) => {
		const i = years.indexOf(year) + delta;
		const b = nav.createEl("button", { cls: "ms-btn", text, attr: { "aria-label": label } });
		if (i < 0 || i >= years.length) b.disabled = true;
		else b.addEventListener("click", () => { state.year = years[i]; renderAll(); });
	};
	btn("‹", "Previous year", -1);
	nav.createDiv({ cls: "ms-year", text: String(year) });
	btn("›", "Next year", 1);
	if (isCurrent) nav.createSpan({ cls: "ms-asof", text: `through ${now.toFormat("LLL d")}` });

	if (!rows.length) {
		root.createDiv({ cls: "ms-empty", text: tv ? "No episodes logged this year." : "No diary entries this year." });
		return;
	}

	const paths = xs => xs.map(x => x.p.file.path);
	const texts = await Promise.all(rows.map(x => body(x.p.file.path)));
	const reviewed = rows.filter((x, i) => fl.reviewedDates(texts[i]).has(x.date));
	const rated = rows.map(x => starsOf(x)).filter(v => v != null);
	const avgRating = rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : 0;
	const newReleases = rows.filter(x => yearOf(x.p) === year);

	const byDate = groupBy(rows, x => x.d.toISODate());
	const dayKeys = [...byDate.keys()].sort();
	let run = [], bestRun = [];
	for (const k of dayKeys) {
		const d = DateTime.fromISO(k);
		run = run.length && d.diff(DateTime.fromISO(run.at(-1)), "days").days === 1 ? [...run, k] : [k];
		if (run.length > bestRun.length) bestRun = run;
	}
	const [busiestDay, busiestPaths] = [...byDate.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))[0];

	// ---- headline numbers
	if (showNumbers) {
		const tiles = root.createDiv({ cls: "ms-tiles" });
		const tile = (value, label, tipText, title, ps) => {
			const t = tiles.createDiv({ cls: "ms-tile" });
			t.createDiv({ cls: "ms-tile-value", text: value });
			t.createDiv({ cls: "ms-tile-label", text: label });
			clickable(t, tipText, title, ps);
		};
		const months = isCurrent ? now.month - 1 + now.day / now.daysInMonth : 12;
		const streakFrom = bestRun.length ? DateTime.fromISO(bestRun[0]).toFormat("LLL d") : "";
		const streakTo = bestRun.length ? DateTime.fromISO(bestRun.at(-1)).toFormat("LLL d") : "";
		if (tv) {
			const shows = [...new Set(paths(rows))];
			// The biggest binge: most entries of one show on one day.
			const binges = groupBy(rows, x => `${x.date}|${x.p.file.path}`);
			const [bKey, bPaths] = [...binges.entries()].sort((a, b) => b[1].length - a[1].length || b[0].localeCompare(a[0]))[0];
			const [bDate, bPath] = bKey.split("|");
			const bName = fl.nameOf(rows.find(x => x.p.file.path === bPath).p);
			tile(rows.length.toLocaleString(), "Episodes", `All ${year} diary entries · ${plural(rows.length)}`, `${year} TV diary`, paths(rows));
			tile(String(shows.length), "Shows", `Shows you watched in ${year} · ${shows.length} show${shows.length === 1 ? "" : "s"}`, `Shows watched in ${year}`, shows);
			tile(fmt1(rows.length / Math.max(1, asOf.ordinal / 7)), "Per week", "Average episodes per week");
			tile(String(reviewed.length), "Reviews", `Episodes you reviewed · ${plural(reviewed.length)}`, `${year} TV reviews`, paths(reviewed));
			tile(String(bPaths.length), "Biggest binge", `${bName} · ${DateTime.fromISO(bDate).toFormat("ccc LLL d")} · ${plural(bPaths.length)}`, `${bName} · ${bDate}`, [bPath]);
		} else {
		tile(rows.length.toLocaleString(), "Diary entries", `All ${year} diary entries · ${plural(rows.length)}`, `${year} diary`, paths(rows));
		tile(fmt1(rows.length / Math.max(1, Math.ceil(months))), "Per month", "Average films per month");
		tile(fmt1(rows.length / Math.max(1, asOf.ordinal / 7)), "Per week", "Average films per week");
		tile(String(reviewed.length), "Reviews", `Films you reviewed · ${plural(reviewed.length)}`, `${year} reviews`, paths(reviewed));
		tile(String(newReleases.length), `${year} releases`, `Films released in ${year} · ${plural(newReleases.length)}`, `${year} releases`, paths(newReleases));
		}
		const streakPaths = bestRun.flatMap(k => byDate.get(k));
		tile(String(bestRun.length), "Day streak", `${streakFrom} – ${streakTo} · ${plural(streakPaths.length)} · watched on ${dayKeys.length} days`, `Longest streak · ${streakFrom} – ${streakTo}, ${year}`, streakPaths);
	}
	if (!showCharts) return;

	// ---- by week + by day of week, side by side
	const activity = root.createDiv({ cls: "ms-row ms-row-split ms-activity" });
	const weekPanel = activity.createDiv({ cls: "ms-panel ms-panel-week" });
	section(weekPanel, "By week", `busiest: ${DateTime.fromISO(busiestDay).toFormat("ccc LLL d")} · ${plural(busiestPaths.length)}`);
	const weeksInYear = DateTime.local(year, 12, 28).weekNumber;
	// Days in Jan that belong to the previous ISO year count toward week 1, late-Dec days of the next toward the last.
	const byWeek = groupBy(rows, x => x.d.weekYear === year ? x.d.weekNumber : (x.d.month === 1 ? 1 : weeksInYear));
	const thisWeek = isCurrent ? (now.weekYear === year ? now.weekNumber : weeksInYear) : weeksInYear;
	const weekChart = weekPanel.createDiv({ cls: "ms-week-chart" });
	bars(weekChart, Array.from({ length: weeksInYear }, (_, i) => {
		const start = DateTime.fromObject({ weekYear: year, weekNumber: i + 1, weekday: 1 });
		const range = `${start.toFormat("LLL d")} – ${start.plus({ days: 6 }).toFormat("LLL d")}`;
		return {
			paths: byWeek.get(i + 1) ?? [], future: i + 1 > thisWeek,
			tip: `W${String(i + 1).padStart(2, "0")} · ${range}`, title: `${year}-W${String(i + 1).padStart(2, "0")} · ${range}`,
		};
	}), { cls: "ms-bars-week", labels: false });
	const axis = weekChart.createDiv({ cls: "ms-axis" });
	axis.createSpan({ text: "Jan" });
	axis.createSpan({ text: "Dec" });

	const dowPanel = activity.createDiv({ cls: "ms-panel ms-panel-dow" });
	section(dowPanel, "By day");
	const dows = ["M", "T", "W", "T", "F", "S", "S"];
	const longDows = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
	const byDow = groupBy(rows, x => x.d.weekday);
	bars(dowPanel, dows.map((label, i) => ({
		label, paths: byDow.get(i + 1) ?? [], tip: longDows[i], title: `${longDows[i]}s in ${year}`,
	})), { cls: "ms-bars-dow", colored: false });

	// ---- ratings + release decades
	const lower = root.createDiv({ cls: "ms-row ms-row-split" });
	const left = lower.createDiv({ cls: "ms-panel" });
	section(left, "Ratings", `avg ${avgRating.toFixed(2)} ★`);
	const byHalf = groupBy(rows, x => starsOf(x));
	const ratingWrap = left.createDiv({ cls: "ms-ratings" });
	ratingWrap.createSpan({ cls: "ms-star-end", text: "★" });
	bars(ratingWrap, Array.from({ length: 10 }, (_, i) => {
		const v = (i + 1) / 2;
		const label = "★".repeat(Math.floor(v)) + (v % 1 ? "½" : "");
		return { paths: byHalf.get(v) ?? [], tip: label, title: `Rated ${label} in ${year}` };
	}), { cls: "ms-bars-rating", colored: false, labels: false });
	ratingWrap.createSpan({ cls: "ms-star-end", text: "★★★★★" });

	const right = lower.createDiv({ cls: "ms-panel" });
	if (tv) {
		// Top shows: episodes logged per show this year, longest first.
		section(right, "Top shows");
		const byShow = [...groupBy(rows, x => x.p.file.path).entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 8);
		const max = Math.max(1, ...byShow.map(([, ps]) => ps.length));
		const list = right.createDiv({ cls: "ms-top" });
		byShow.forEach(([path, ps], i) => {
			const p = rows.find(x => x.p.file.path === path).p, name = fl.nameOf(p);
			const row = list.createDiv({ cls: "ms-top-row" });
			row.createDiv({ cls: "ms-top-name", text: name });
			const track = row.createDiv({ cls: "ms-top-track" });
			const bar = track.createDiv({ cls: "ms-top-bar" });
			bar.style.width = `${Math.max(3, (ps.length / max) * 100)}%`;
			bar.style.background = ramp(byShow.length > 1 ? i / (byShow.length - 1) : 0);
			row.createDiv({ cls: "ms-top-n", text: String(ps.length) });
			clickable(row, `${name} · ${plural(ps.length)}`, `${name} in ${year}`, [path]);
		});
		return;
	}
	section(right, "Release decades");
	const byDecade = groupBy(rows, x => yearOf(x.p) ? Math.floor(yearOf(x.p) / 10) * 10 : null);
	const decades = [...byDecade.keys()].sort((a, b) => a - b);
	const span = decades.length ? Array.from({ length: (decades.at(-1) - decades[0]) / 10 + 1 }, (_, i) => decades[0] + i * 10) : [];
	bars(right, span.map(d => ({
		label: `'${String(d).slice(2)}s`, paths: byDecade.get(d) ?? [], tip: `${d}s releases`, title: `${d}s films watched in ${year}`,
	})), { cls: "ms-bars-decade" });
}

// Live instances on this page; detached ones (re-rendered or closed) drop out.
const instances = tv ? (window.tvStatsInstances ??= new Set()) : (window.movieStatsInstances ??= new Set());
instances.add({ root, render });
async function renderAll() {
	for (const inst of [...instances]) {
		if (inst.root.isConnected) await inst.render();
		else instances.delete(inst);
	}
}

await render();
