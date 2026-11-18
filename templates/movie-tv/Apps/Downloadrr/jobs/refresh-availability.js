// Refreshes where every watchlist/pending film streams in the US (TMDB watch providers) into the app store's
// "availability" key, which the view reads. Was refresh-availability.js under launchd: it walked Films/ with fs and
// regexes, read the TMDB token from the vault's .env, and wrote 99_Internal/Data/downloadrr-availability.json.
// Runs in the jobs utility process (scheduler) or in `helenite job run downloadrr refresh-availability`.
import lib from "../lib.js";
import { FILMS, num } from "../films.js";
import { AVAIL_VERSION } from "../availability-version.js";

export default async function run(api, { log }) {
	const settings = api.settings;
	const tmdbUrl = String(settings.TMDB_URL).replace(/\/+$/, "");
	if (!(await api.secrets.status()).TMDB_TOKEN) throw new Error("the TMDB token is not set");

	const ids = new Set();
	for (const { frontmatter: n } of await api.notes.query({ from: `${FILMS}/**/*.md` })) {
		if (!(n.on_watchlist || n.pending)) continue;
		const id = num(n.tmdb_id);
		if (id && (!n.tmdb_type || n.tmdb_type === "movie")) ids.add(id);
	}

	const today = new Date().toLocaleDateString("en-CA");
	const avail = (await api.store.get("availability")) ?? {};
	const queue = [...ids];
	let ok = 0, bad = 0;
	const worker = async () => {
		for (let id; (id = queue.shift());) {
			try {
				const r = await api.net.fetch({ url: `${tmdbUrl}/3/movie/${id}?append_to_response=watch/providers,release_dates`, headers: { Authorization: "Bearer {{secret:TMDB_TOKEN}}" } });
				if (r.status === 401) { log("TMDB rejected the token"); queue.length = 0; bad++; return; }
				if (r.status < 300) { avail[id] = { ...lib.availability(r.json, today), checked: today, v: AVAIL_VERSION }; ok++; } else bad++;
			} catch (e) { bad++; log(`${id}: ${e.message}`); }
		}
	};
	await Promise.all([worker(), worker(), worker(), worker()]);
	if (ok) await api.store.set("availability", avail);
	return { refreshed: ok, of: ids.size, failed: bad };
}
