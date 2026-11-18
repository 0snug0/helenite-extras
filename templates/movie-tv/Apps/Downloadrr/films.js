// Stand-in for the vault's shared 99_Internal/Views/films-lib.js (not part of the Downloadrr folder, so not copied):
// just the pieces view.js uses. In Helenite this would be a shared module or a "films" connector that several apps import.
export const FILMS = "50_Personal/Letterboxd/Films";

// film_store.py writes "" for unknown values; treat it as missing.
const val = v => (v === "" || v == null ? null : v);

export const nameOf = n => String(val(n.frontmatter?.title) ?? n.basename.replace(/\s*\(\d{4}\)$/, ""));
export const iso = v => { const m = /^\d{4}-\d{2}-\d{2}/.exec(String(val(v) ?? "")); return m ? m[0] : null; };
export const num = v => (val(v) == null ? null : Number(v));

// One line of score badges under a card. open(url) opens a link (in Helenite, through workspace.openUrl).
export function scoreRow(parent, { lb, rt, aud, lbUrl, rtUrl, imdb, imdbUrl }, open) {
	const row = parent.createDiv({ cls: "fl-scores" });
	const badge = (cls, text, url, title) => {
		if (text == null) return;
		const el = row.createEl(url ? "a" : "span", { cls: `fl-score ${cls}`, text, attr: { title, ...(url ? { href: url } : {}) } });
		if (url) el.addEventListener("click", e => { e.preventDefault(); open(url); });
	};
	badge("fl-lb", lb != null ? `★ ${Number(lb).toFixed(1)}` : null, lbUrl, "Letterboxd average");
	badge("fl-rt", rt != null ? `🍅 ${rt}%` : null, rtUrl, "Rotten Tomatoes critics");
	badge("fl-aud", aud != null ? `🍿 ${aud}%` : null, rtUrl, "Rotten Tomatoes audience");
	badge("fl-imdb", imdb != null ? `IMDb ${imdb}` : null, imdbUrl, "IMDb rating");
	return row;
}
