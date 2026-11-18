// Stand-in for the vault's shared 99_Internal/Views/films-lib.js (not part of the Downloadrr folder, so not copied):
// just the pieces view.js uses. In Helenite this would be a shared module or a "films" connector that several apps import.
// One note per TV show, written by serializd_sync.py: the same shape as a film note, with Type "Show", tmdb_type "tv",
// serializd_url, and watching / watching_added beside on_watchlist / watchlist_added.
export const SHOWS = "50_Personal/Serializd/Shows";
export const serializdUrl = tmdbId => `https://www.serializd.com/show/${tmdbId}`;

// film_store.py writes "" for unknown values; treat it as missing.
const val = v => (v === "" || v == null ? null : v);

export const nameOf = n => String(val(n.frontmatter?.title) ?? n.basename.replace(/\s*\(\d{4}\)$/, ""));
export const iso = v => { const m = /^\d{4}-\d{2}-\d{2}/.exec(String(val(v) ?? "")); return m ? m[0] : null; };
export const num = v => (val(v) == null ? null : Number(v));

// One line of score badges under a card. open(url) opens a link (in Helenite, through workspace.openUrl).
// lbTip / lbDigits relabel the first badge (the TV page shows the Serializd average there, to two places).
export function scoreRow(parent, { lb, rt, aud, lbUrl, rtUrl, imdb, imdbUrl, lbTip = "Letterboxd average", lbDigits = 1 }, open) {
	const row = parent.createDiv({ cls: "fl-scores" });
	const badge = (cls, text, url, title) => {
		if (text == null) return;
		const el = row.createEl(url ? "a" : "span", { cls: `fl-score ${cls}`, text, attr: { title, ...(url ? { href: url } : {}) } });
		if (url) el.addEventListener("click", e => { e.preventDefault(); open(url); });
	};
	badge("fl-lb", lb != null ? `★ ${Number(lb).toFixed(lbDigits)}` : null, lbUrl, lbTip);
	badge("fl-rt", rt != null ? `🍅 ${rt}%` : null, rtUrl, "Rotten Tomatoes critics");
	badge("fl-aud", aud != null ? `🍿 ${aud}%` : null, rtUrl, "Rotten Tomatoes audience");
	badge("fl-imdb", imdb != null ? `IMDb ${imdb}` : null, imdbUrl, "IMDb rating");
	return row;
}
