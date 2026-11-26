import { figures } from "../../core/ui-kit.js";
// DOM helpers for the sections: tiny and dependency free, so the same code runs in the sandbox frame
// (where the host installs Obsidian's createDiv/createEl on Node.prototype too) and under jsdom in tests.
export function el(parent, tag, opts = {}) {
	const doc = parent.ownerDocument ?? parent;
	const node = doc.createElement(tag);
	if (opts.cls) node.className = opts.cls;
	if (opts.text != null) node.textContent = String(opts.text);
	for (const [k, v] of Object.entries(opts.attr ?? {})) if (v != null && v !== false) node.setAttribute(k, v === true ? "" : String(v));
	if (opts.html != null) node.innerHTML = opts.html;
	if (opts.on) for (const [k, fn] of Object.entries(opts.on)) node.addEventListener(k, fn);
	parent.appendChild(node);
	return node;
}
export const div = (parent, cls, text) => el(parent, "div", { cls, text });
export const clear = node => { while (node.firstChild) node.removeChild(node.firstChild); };
export const plural = (n, word = "film") => `${n} ${word}${n === 1 ? "" : "s"}`;

const LB_ICON = '<svg class="film-score-icon" viewBox="0 0 30 16" width="19" height="10"><circle cx="7" cy="8" r="6.5" fill="#ff8000"/><circle cx="15" cy="8" r="6.5" fill="#00e054"/><circle cx="23" cy="8" r="6.5" fill="#40bcf4"/></svg>';
const IMDB_ICON = '<svg class="film-score-icon" viewBox="0 0 32 16" width="24" height="12"><rect width="32" height="16" rx="2.5" fill="#f5c518"/><text x="16" y="12" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="900" font-size="11" fill="#000">IMDb</text></svg>';

const svg = (doc, markup) => { const t = doc.createElement("template"); t.innerHTML = markup; return t.content.firstChild; };

// Four scores under a card on two lines: Letterboxd + IMDb, then Tomatometer + Popcornmeter. Each links out when it has a url.
export function scoreRow(parent, { lb, rt, aud, lbUrl, rtUrl, imdb, imdbUrl }, openUrl) {
	const doc = parent.ownerDocument;
	const n1 = v => (v != null ? Number(v).toFixed(1) : "–");
	const item = (key, text, label, url, icon) => ({ key, text, label, icon: icon && svg(doc, icon), onClick: url ? () => openUrl(url) : undefined });
	return figures(parent, [
		item("lb", n1(lb), "Letterboxd average, out of 5", lb != null ? lbUrl : null, LB_ICON),
		item("imdb", n1(imdb), "IMDb rating, out of 10", imdb != null ? imdbUrl : null, IMDB_ICON),
		item("rt", rt != null ? `🍅 ${rt}%` : "🍅 –", "Rotten Tomatoes critics score", rt != null ? rtUrl : null),
		item("aud", aud != null ? `🍿 ${aud}%` : "🍿 –", "Rotten Tomatoes audience score", aud != null ? rtUrl : null),
	], { columns: 2 });
}
