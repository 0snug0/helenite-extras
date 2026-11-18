// Shared by the movie views: reads the one-note-per-film layout written by Templates/Scripts/film_store.py.
// Ends in `return lib` so a view loads it as a function body:
//   const fl = new Function("module", await app.vault.adapter.read("99_Internal/Views/films-lib.js"))(undefined);
// and it is CommonJS under `node --test`.
const FILMS = "50_Personal/Letterboxd/Films";
const SHOWS = "50_Personal/Serializd/Shows";   // TV shows from Serializd (serializd_sync.py), same note format, Type "Show"

// A Dataview date (luxon DateTime), a JS Date or a string -> "YYYY-MM-DD", else "".
function iso(v) {
	if (!v) return "";
	if (typeof v.toISODate === "function") return v.toISODate() ?? "";
	if (v instanceof Date) return v.toISOString().slice(0, 10);
	const m = String(v).match(/^\d{4}-\d{2}-\d{2}/);
	return m ? m[0] : "";
}

const list = v => v == null ? [] : Array.isArray(v) ? v : typeof v.array === "function" ? v.array() : [v];

// One row per viewing: a film watched twice gives two rows, so counts, charts and calendars
// still treat a rewatch as its own entry. `n` is the watch's position on its film.
function watchRows(pages) {
	const rows = [];
	for (const p of pages) {
		const ratings = list(p.ratings), guids = list(p.letterboxd_guids);
		list(p.watches).forEach((w, n) => {
			const date = iso(w);
			if (date) rows.push({ p, date, rating: ratings[n] ?? null, n, guid: String(guids[n] ?? "") });
		});
	}
	return rows;
}

// Dataview turns some titles into other things ("127 Hours" into a Duration, a date-like one into a DateTime): those fall back to the file name.
const nameOf = p => typeof p.title === "string" ? p.title : typeof p.title === "number" ? String(p.title)
	: String(p.file?.name ?? "").replace(/ \(\d{4}\)( \(tmdb-\d+\))?$/, "");
const yearOf = p => p.year ?? (String(p.file?.name ?? "").match(/ \((\d{4})\)/) || [])[1] ?? "";
// Sortable key putting a day's watches in the order they were logged: Letterboxd entry ids grow with log time.
// Entries without one (imported from a CSV) are the older ones, so they come first.
const order = x => `${x.date} ${(x.guid || "").padStart(14, "0")} ${String(x.n).padStart(3, "0")} ${nameOf(x.p)}`;

// Dates of the watch sections ("### 2026-10-04 ...") in a film note's body that carry a review ("> ..." line).
function reviewedDates(body) {
	const out = new Set();
	let day = null;
	for (const line of String(body ?? "").split("\n")) {
		const h = line.match(/^### (\d{4}-\d{2}-\d{2})/);
		if (h) day = h[1];
		else if (/^#{1,3} /.test(line)) day = null;
		else if (day && /^> \S/.test(line)) out.add(day);
	}
	return out;
}

// Lookup of film pages by a card's TMDB movie id, then its Letterboxd slug.
const slugOf = url => (String(url ?? "").match(/letterboxd\.com\/film\/([^/]+)\//) || [])[1] ?? "";
function filmIndex(pages) {
	const byId = new Map(), bySlug = new Map();
	for (const p of pages) {
		if (p.tmdb_id && (!p.tmdb_type || p.tmdb_type === "movie")) byId.set(Number(p.tmdb_id), p);
		if (p.letterboxd_slug) bySlug.set(String(p.letterboxd_slug), p);
	}
	return card => byId.get(Number(card.tmdb_id)) ?? bySlug.get(slugOf(card.letterboxd_url)) ?? null;
}

const yaml = v => v === null || v === undefined ? "" : typeof v === "string" && !/^\d{4}-\d{2}-\d{2}$/.test(v) ? JSON.stringify(v) : String(v);

// Set top-level scalar keys in a note's frontmatter, leaving every other line as it is.
function setKeys(text, values) {
	const m = String(text).match(/^---\n([\s\S]*?)\n---[ \t]*(\n|$)/);
	if (!m) return text;
	const lines = m[1].split("\n");
	for (const [key, value] of Object.entries(values)) {
		const line = `${key}: ${yaml(value)}`.trimEnd();
		const i = lines.findIndex(l => l.startsWith(`${key}:`));
		if (i >= 0) lines[i] = line;
		else lines.push(line);
	}
	return `---\n${lines.join("\n")}\n---${m[2]}${text.slice(m[0].length)}`;
}

const safeName = s => String(s).replace(/[\\/:*?"<>|#^\[\]]/g, "").trim().replace(/^\.+|\.+$/g, "");
const fileStem = card => safeName(card.year ? `${card.title} (${card.year})` : card.title);

// A film note for a card that has none yet, in the shape film_store.py writes (it fills in the rest later).
function newFilmNote(card, today, flags = {}) {
	const slug = slugOf(card.letterboxd_url);
	const fm = [
		["Type", "Film"], ["Alias", card.title], ["title", card.title], ["year", card.year ?? null],
		["tmdb_id", card.tmdb_id ?? null], ["tmdb_type", card.tmdb_id ? "movie" : null],
		...(slug ? [["letterboxd_slug", slug]] : []),
		["letterboxd_url", card.letterboxd_url ?? null], ["poster", card.poster ?? null],
	].map(([k, v]) => `${k}: ${yaml(v)}`.trimEnd());
	const head = card.year ? `# ${card.title} (${card.year})` : `# ${card.title}`;
	return [
		"---", ...fm,
		"watches: []", "ratings: []", "letterboxd_guids: []", "watch_count: 0", "last_watched:", "rating:",
		`on_watchlist: ${!!flags.on_watchlist}`, "watchlist_added:",
		`pending: ${!!flags.pending}`, `pending_added: ${flags.pending ? today : ""}`.trimEnd(),
		"recommended: []", "upcoming: []", `added: ${today}`, `score_day: ${(new Date(`${today}T12:00:00`).getDay() + 6) % 7}`,
		"---", "", head, "",
		...(card.poster ? [`![Poster](${card.poster})`, ""] : []),
		"%% credits:start %%", "%% credits:end %%", "", "## Watches", "",
	].join("\n");
}

// The four scores under a card, always exactly two lines: Letterboxd average (out of 5) and IMDb (out of 10) on top,
// each behind its logo, then the Tomatometer and Popcornmeter. Each links to its page when there is a url (the two
// Rotten Tomatoes ones share the film's RT page). Needs .film-scores in the view's css.
const LB_ICON = '<svg class="film-score-icon" viewBox="0 0 30 16" width="19" height="10" aria-hidden="true"><circle cx="7" cy="8" r="6.5" fill="#ff8000"/><circle cx="15" cy="8" r="6.5" fill="#00e054"/><circle cx="23" cy="8" r="6.5" fill="#40bcf4"/></svg>';
const IMDB_ICON = '<svg class="film-score-icon" viewBox="0 0 32 16" width="24" height="12" aria-hidden="true"><rect width="32" height="16" rx="2.5" fill="#f5c518"/><text x="16" y="12" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="900" font-size="11" fill="#000">IMDb</text></svg>';
// lbIcon / lbTip / lbDigits let a page put another site's average (out of 5) in the first slot; Letterboxd by default.
function scoreRow(parent, { lb, rt, aud, lbUrl, rtUrl, imdb, imdbUrl, lbIcon = LB_ICON, lbTip = "Letterboxd average, out of 5", lbDigits = 1 }) {
	const box = parent.createDiv({ cls: "film-scores" });
	const item = (line, cls, icon, text, tip, url) => {
		const el = line.createEl(url ? "a" : "span", { cls: `film-score film-score-${cls}`, attr: { title: tip, ...(url ? { href: url } : {}) } });
		if (icon) el.insertAdjacentHTML("beforeend", icon);
		el.createSpan({ text });
		if (url) el.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); window.open(url); });
	};
	const top = box.createDiv({ cls: "film-scores-line" }), bottom = box.createDiv({ cls: "film-scores-line" });
	item(top, "lb", lbIcon, lb != null ? Number(lb).toFixed(lbDigits) : "–", lbTip, lb != null ? lbUrl : null);
	item(top, "imdb", IMDB_ICON, imdb != null ? Number(imdb).toFixed(1) : "–", "IMDb rating, out of 10", imdb != null ? imdbUrl : null);
	item(bottom, "rt", null, rt != null ? `🍅 ${rt}%` : "🍅 –", "Rotten Tomatoes critics score", rt != null ? rtUrl : null);
	item(bottom, "aud", null, aud != null ? `🍿 ${aud}%` : "🍿 –", "Rotten Tomatoes audience score", aud != null ? rtUrl : null);
	return box;
}

const lib = { FILMS, SHOWS, scoreRow, iso, watchRows, order, nameOf, yearOf, reviewedDates, slugOf, filmIndex, setKeys, safeName, fileStem, newFilmNote };
if (typeof module !== "undefined" && module.exports) module.exports = lib;
return lib;
