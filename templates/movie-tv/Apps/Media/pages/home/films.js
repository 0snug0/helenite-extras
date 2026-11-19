// Film-note helpers shared by the dashboard sections: the layout written by film_store.py
// (one note per film, history as parallel frontmatter lists). Ported from 99_Internal/Views/films-lib.js
// without Dataview: a "page" here is { file: { path, name }, ...frontmatter } built from api.notes.query results.
export const FILMS = "50_Personal/Letterboxd/Films";

export function toPage(n) {
	return { ...n.frontmatter, file: { path: n.path, name: n.basename, mtime: n.mtime } };
}

// A Date, an ISO string or anything else -> "YYYY-MM-DD", else "".
export function iso(v) {
	if (!v) return "";
	if (v instanceof Date) return Number.isNaN(v.getTime()) ? "" : v.toISOString().slice(0, 10);
	const m = String(v).match(/^\d{4}-\d{2}-\d{2}/);
	return m ? m[0] : "";
}

export const list = v => (v == null ? [] : Array.isArray(v) ? v : [v]);

// One row per viewing, so a rewatch counts separately. `n` is the watch's position on its film.
export function watchRows(pages) {
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

export const nameOf = p => typeof p.title === "string" ? p.title : typeof p.title === "number" ? String(p.title)
	: String(p.file?.name ?? "").replace(/ \(\d{4}\)( \(tmdb-\d+\))?$/, "");
export const yearOf = p => p.year ?? (String(p.file?.name ?? "").match(/ \((\d{4})\)/) || [])[1] ?? "";
// Sortable key that keeps a day's watches in logged order (Letterboxd entry ids grow with log time).
export const order = x => `${x.date} ${(x.guid || "").padStart(14, "0")} ${String(x.n).padStart(3, "0")} ${nameOf(x.p)}`;

// Dates of the watch sections ("### 2026-10-04 ...") in a note body that carry a review ("> ..." line).
export function reviewedDates(body) {
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

export const slugOf = url => (String(url ?? "").match(/letterboxd\.com\/film\/([^/]+)\//) || [])[1] ?? "";
export function filmIndex(pages) {
	const byId = new Map(), bySlug = new Map();
	for (const p of pages) {
		if (p.tmdb_id && (!p.tmdb_type || p.tmdb_type === "movie")) byId.set(Number(p.tmdb_id), p);
		if (p.letterboxd_slug) bySlug.set(String(p.letterboxd_slug), p);
	}
	return card => byId.get(Number(card.tmdb_id)) ?? bySlug.get(slugOf(card.letterboxd_url)) ?? null;
}

const yamlScalar = v => v === null || v === undefined ? "" : typeof v === "string" && !/^\d{4}-\d{2}-\d{2}$/.test(v) ? JSON.stringify(v) : String(v);
export const safeName = s => String(s).replace(/[\\/:*?"<>|#^\[\]]/g, "").trim().replace(/^\.+|\.+$/g, "");
export const fileStem = card => safeName(card.year ? `${card.title} (${card.year})` : card.title);

// A film note for a card that has none yet, in the shape film_store.py writes (it fills in the rest later).
export function newFilmNote(card, today, flags = {}) {
	const slug = slugOf(card.letterboxd_url);
	const fm = [
		["Type", "Film"], ["Alias", card.title], ["title", card.title], ["year", card.year ?? null],
		["tmdb_id", card.tmdb_id ?? null], ["tmdb_type", card.tmdb_id ? "movie" : null],
		...(slug ? [["letterboxd_slug", slug]] : []),
		["letterboxd_url", card.letterboxd_url ?? null], ["poster", card.poster ?? null],
	].map(([k, v]) => `${k}: ${yamlScalar(v)}`.trimEnd());
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

// `rating` is Letterboxd's 0-5 x 2: 7 -> 3.5 stars.
export const starsOf = x => (Number.isFinite(Number(x.rating)) && x.rating ? Math.round(Number(x.rating)) / 2 : null);
