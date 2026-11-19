// TMDB client, "where can I watch it" logic and the availability cache fill shared by the Movies and TV pages.
// availability()/availabilityLabel() are lifted unchanged from Downloadrr/lib.js (DownloadrrTV/base.js is a byte copy of it).
// fillAvailability() is the worker loop of Downloadrr/fill.js and DownloadrrTV/services.js, which differ only in the TMDB path,
// the number of workers, how often they redraw, the cache version and where the cache is saved: those are parameters here.
// `token` is the host placeholder {{secret:TMDB_TOKEN}}; `request` is api.net.fetch.

const fix = u => String(u ?? "").replace(/\/+$/, "");

export function createTmdb({ url, token, request, enabled = async () => true }) {
	const base = fix(url);
	return {
		url: base,
		isSet: enabled,
		// GET {base}{path} with the bearer token; resolves to the host's response ({ status, json, text }), never throws on HTTP errors.
		async get(path) {
			if (!(await enabled())) throw new Error("TMDB is not configured");
			return request({ url: `${base}${path}`, headers: { Authorization: `Bearer ${token}` }, throw: false });
		},
	};
}

// Where a film can be watched in the US right now, from one TMDB /movie/{id} response with
// append_to_response=watch/providers,release_dates. Providers are JustWatch data and say nothing about
// cinemas, so "theaters" means: no provider, and a US theatrical release in the last THEATER_DAYS days.
export const THEATER_DAYS = 120;
// The only streamers worth naming; anything else just reads "Available". Amazon Channel add-ons
// ("HBO Max Amazon Channel") count as the service they carry. "Apple TV Store" is rent/buy, not streaming.
export const MAJORS = [["Netflix", /^Netflix\b/], ["Apple", /^Apple TV(?! Store)\b/], ["HBO", /^(HBO )?Max\b/], ["Prime", /^Amazon Prime Video\b/]];
const dayDiff = (a, b) => (Date.parse(b) - Date.parse(a)) / 86400000;
export function availability(movie, today, region = "US") {
	const prov = movie?.["watch/providers"]?.results?.[region] ?? {};
	// Fandango At Home (ex-Vudu) lists preorders as rent/buy, so it never proves the film is out.
	const has = (...keys) => keys.some(k => (prov[k] ?? []).some(p => !/fandango/i.test(p.provider_name)));
	if (has("flatrate", "free", "ads")) {
		const names = ["flatrate", "free", "ads"].flatMap(k => (prov[k] ?? []).map(p => p.provider_name));
		return { kind: "stream", on: MAJORS.filter(([, re]) => names.some(n => re.test(n))).map(([short]) => short) };
	}
	if (has("rent", "buy")) return { kind: "rent" };

	const dates = (movie?.release_dates?.results ?? []).find(r => r.iso_3166_1 === region)?.release_dates ?? [];
	const day = d => String(d?.release_date ?? "").slice(0, 10);
	const theatrical = dates.filter(d => d.type === 2 || d.type === 3).map(day).filter(Boolean).sort();
	const past = theatrical.filter(d => d <= today);
	if (past.length && dayDiff(past[past.length - 1], today) <= THEATER_DAYS) return { kind: "theaters", date: past[past.length - 1] };
	// US dates decide; TMDB's top-level release_date is the earliest anywhere, so it is only a fallback.
	const us = dates.map(day).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
	const known = us.length ? us : [String(movie?.release_date ?? "")].filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
	const upcoming = known.filter(d => d > today).sort();
	const anyPast = known.some(d => d <= today);
	if (upcoming.length && !anyPast) return { kind: "soon", date: upcoming[0] };
	return { kind: "none" };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function availabilityLabel(a, today = "") {
	if (!a) return "";
	switch (a.kind) {
		case "stream": return a.on?.length ? a.on.join(" · ") : "Available";
		case "rent": return "Available";
		case "theaters": return "Theaters";
		case "soon": {
			const [y, m, d] = a.date.split("-");
			return `Out ${MONTHS[m - 1]} ${Number(d)}${y !== today.slice(0, 4) ? ` ${y}` : ""}`;
		}
		default: return "";
	}
}


// Fills `cache` (id -> { ...availability, checked, v }) for every id whose entry is missing, from an older version or older
// than `days`, then saves it. kind "movie": /movie/{id} with watch/providers and release_dates. kind "tv": /tv/{id}, where a
// show's first air date stands in for a film's release date. A 401 stops the run (bad token); any other failure stops it too.
//   { tmdb, kind, ids, cache, today, version, days, concurrency = 4, progressEvery = 10, label, save(cache), onProgress(done) }
// Resolves to { done, failed }. The caller redraws afterwards.
export async function fillAvailability({ tmdb, kind = "movie", ids, cache, today, version, days = 1, concurrency = 4, progressEvery = 10, label = "Downloadrr", save, onProgress }) {
	const stale = c => !c || c.v !== version || !c.checked || (Date.parse(today) - Date.parse(c.checked)) / 86400000 >= days;
	const need = [...new Set(ids.filter(Boolean))].filter(id => stale(cache[id]));
	if (!need.length) return { done: 0, failed: false };
	const path = id => kind === "tv" ? `/3/tv/${id}?append_to_response=watch/providers` : `/3/movie/${id}?append_to_response=watch/providers,release_dates`;
	let done = 0, failed = false;
	const worker = async () => {
		while (need.length && !failed) {
			const id = need.shift();
			try {
				const res = await tmdb.get(path(id));
				if (res.status === 401) { failed = true; console.error(`${label}: TMDB rejected the token`); break; }
				if (res.status >= 200 && res.status < 300) cache[id] = { ...availability(kind === "tv" ? { ...res.json, release_date: res.json.first_air_date } : res.json, today), checked: today, v: version };
			} catch (e) { failed = true; console.error(`${label}: TMDB lookup failed`, e); }
			if (++done % progressEvery === 0) onProgress?.(done);
		}
	};
	await Promise.all(Array.from({ length: concurrency }, worker));
	if (done && save) await Promise.resolve(save(cache)).catch(e => console.error(e));
	return { done, failed };
}
