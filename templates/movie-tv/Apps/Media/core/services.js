// The services every Media page talks to, built once from the host API: createServices(api).
//   { sab, plex, tmdb, status() }
//     sab   SABnzbd client (sabnzbd.js)     plex   Plex client (plex.js)     tmdb   TMDB client (tmdb.js)
//     status() -> { radarr, sonarr, sabnzbd, plex, tmdb }: each "ok" (answered), "down" (unreachable or an HTTP error, a bad
//              key included) or "unset" (its secret or URL is missing). It never throws; the shell shows it as the status strip.
// URLs come from api.settings (RADARR_URL, SONARR_URL, SABNZBD_URL, PLEX_URL, TMDB_URL), trailing slashes stripped. Keys come
// from the host as {{secret:NAME}} placeholders that it fills in on the way out; api.secrets.status() says which are set and
// is read on every call, so a key saved in Settings counts at once. Requests only ever go through api.net.fetch.
//
// Radarr and Sonarr clients are not here: their calls differ and stay in the Movies and TV pages. The service is only pinged
// for the status strip.
// A client whose secret is unset: SABnzbd's queue() answers null; the others throw "<Service> is not configured".
import { createSab } from "./sabnzbd.js";
import { createClient as createPlexClient } from "./plex.js";
import { createTmdb } from "./tmdb.js";

const trim = u => String(u ?? "").replace(/\/+$/, "");
const secret = name => `{{secret:${name}}}`;

// What each service answers to when it is asked how it is. `key` is the placeholder; the path is relative to the service URL.
const PROBES = {
	radarr: { name: "RADARR", secret: "RADARR_API_KEY", url: "RADARR_URL", request: key => ({ path: "/api/v3/system/status", headers: { "X-Api-Key": key } }) },
	sonarr: { name: "SONARR", secret: "SONARR_API_KEY", url: "SONARR_URL", request: key => ({ path: "/api/v3/system/status", headers: { "X-Api-Key": key } }) },
	sabnzbd: { name: "SABNZBD", secret: "SABNZBD_API_KEY", url: "SABNZBD_URL", request: key => ({ path: `/api?mode=version&output=json&apikey=${key}`, headers: {} }) },
	plex: { name: "PLEX", secret: "PLEX_TOKEN", url: "PLEX_URL", request: key => ({ path: `/library/sections?X-Plex-Token=${key}`, headers: { Accept: "application/json" } }) },
	tmdb: { name: "TMDB", secret: "TMDB_TOKEN", url: "TMDB_URL", request: key => ({ path: "/3/configuration", headers: { Authorization: `Bearer ${key}` } }) },
};

export function createServices(api) {
	const settings = () => api.settings ?? {};
	const have = async () => { try { return (await api.secrets.status()) ?? {}; } catch (e) { return {}; } };
	const isSet = name => async () => !!(await have())[name];
	const request = (...a) => api.net.fetch(...a);

	const sab = createSab({ url: settings().SABNZBD_URL, key: secret("SABNZBD_API_KEY"), request, enabled: isSet("SABNZBD_API_KEY") });
	const tmdb = createTmdb({ url: settings().TMDB_URL, token: secret("TMDB_TOKEN"), request, enabled: isSet("TMDB_TOKEN") });
	// Plex: every method of the client is guarded by the secret, so a page can call it without checking first.
	const plexClient = createPlexClient({ url: trim(settings().PLEX_URL), token: secret("PLEX_TOKEN"), request });
	const plexSet = isSet("PLEX_TOKEN");
	const plex = { isSet: plexSet };
	for (const [name, fn] of Object.entries(plexClient)) plex[name] = async (...a) => { if (!(await plexSet())) throw new Error("Plex is not configured"); return fn(...a); };

	async function probe(spec, secrets) {
		const url = trim(settings()[spec.url]);
		if (!secrets[spec.secret] || !url) return "unset";
		const { path, headers } = spec.request(secret(spec.secret));
		try {
			const res = await request({ url: `${url}${path}`, headers, throw: false });
			return res.status >= 200 && res.status < 300 ? "ok" : "down";
		} catch (e) { return "down"; }
	}
	async function status() {
		const secrets = await have();
		const entries = await Promise.all(Object.entries(PROBES).map(async ([id, spec]) => [id, await probe(spec, secrets)]));
		return Object.fromEntries(entries);
	}

	return { sab, plex, tmdb, status };
}
