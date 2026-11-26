// Score badges and the scraping plumbing shared by the Movies and TV pages.
// The badges are ui-kit figures. scoreRow is Downloadrr/films.js scoreRow with DownloadrrTV's extra lbTip/lbDigits options (their defaults are the Movies
// page's behaviour). The scrapers themselves differ per page (Letterboxd + Wikidata via TMDB for films, Serializd + Wikidata
// via TheTVDB + OMDb for shows) and stay in the pages; what they share is below. Needs createDiv/createEl (host element helpers).

import { figures } from "./ui-kit.js";

// One line of score badges under a card. open(url) opens a link (in Helenite, through workspace.openUrl).
// lbTip / lbDigits relabel the first badge (the TV page shows the Serializd average there, to two places).
export function scoreRow(parent, { lb, rt, aud, lbUrl, rtUrl, imdb, imdbUrl, lbTip = "Letterboxd average", lbDigits = 1 }, open) {
	const items = [];
	const add = (key, text, url, label) => { if (text != null) items.push({ key, text, label, onClick: url ? () => open(url) : undefined }); };
	add("lb", lb != null ? `★ ${Number(lb).toFixed(lbDigits)}` : null, lbUrl, lbTip);
	add("rt", rt != null ? `🍅 ${rt}%` : null, rtUrl, "Rotten Tomatoes critics");
	add("aud", aud != null ? `🍿 ${aud}%` : null, rtUrl, "Rotten Tomatoes audience");
	add("imdb", imdb != null ? `IMDb ${imdb}` : null, imdbUrl, "IMDb rating");
	return figures(parent, items);
}

// A scraped page's text, or "" on any failure (HTTP error, offline, blocked). Both pages define this inline.
export function createScraper(request) {
	const get = async (url, headers = {}) => { try { const r = await request({ url, headers, throw: false }); return r.status < 300 ? r.text : ""; } catch (e) { return ""; } };
	const num = (text, re) => { const m = text.match(re); return m ? Number(m[1]) : null; };
	return { get, num };
}

// True when a cached score entry should be fetched again: none, never checked, or older than `days`.
// `extra(entry)` can add a page's own rule (the TV page refetches entries that predate its Serializd field).
export function isStale(entry, today, days, extra) {
	return !entry || !entry.checked || (extra ? extra(entry) : false) || (Date.parse(today) - Date.parse(entry.checked)) / 86400000 >= days;
}

// Runs fn(item) over `items` with `workers` parallel workers, taking from the front of the (mutated) list.
// onStep(done) is called after every `every` items.
export async function runPool(items, workers, fn, { every = 3, onStep } = {}) {
	let done = 0;
	const worker = async () => { while (items.length) { await fn(items.shift()); if (++done % every === 0) onStep?.(done); } };
	await Promise.all(Array.from({ length: workers }, worker));
	return done;
}
