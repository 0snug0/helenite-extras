// Radarr API v3 client for the Downloadrr view. `request` is injected (the host's net.fetch in the app, Obsidian's requestUrl in the
// vault, a fake in tests). An ES module.

class RadarrError extends Error {
	constructor(message, status) {
		super(message);
		this.name = "RadarrError";
		this.status = status;
	}
}

function describe(json, status) {
	if (status === 401) return "Radarr rejected the API key (401)";
	const msgs = Array.isArray(json)
		? json.map(e => e?.errorMessage ?? e?.message)
		: [json?.message ?? json?.error];
	const text = msgs.filter(Boolean).join("; ");
	return text || `Radarr returned HTTP ${status}`;
}

// Existing movies show which quality profile this setup actually uses, so added films get the same one.
function chooseDefaults(roots, profiles, movies) {
	if (!roots.length) throw new RadarrError("Radarr has no root folder configured", 0);
	const known = new Set(profiles.map(p => p.id));
	const counts = new Map();
	for (const m of movies) if (known.has(m.qualityProfileId)) counts.set(m.qualityProfileId, (counts.get(m.qualityProfileId) ?? 0) + 1);
	const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
	const qualityProfileId = top ? top[0] : profiles[0]?.id;
	if (qualityProfileId == null) throw new RadarrError("Radarr has no quality profile configured", 0);
	return { rootFolderPath: roots[0].path, qualityProfileId };
}

function createClient({ url, key, request }) {
	const base = `${String(url).replace(/\/+$/, "")}/api/v3`;

	async function call(method, path, body) {
		let res;
		try {
			res = await request({
				url: base + path,
				method,
				headers: { "X-Api-Key": key, ...(body ? { "Content-Type": "application/json" } : {}) },
				body: body ? JSON.stringify(body) : undefined,
				throw: false,
			});
		} catch (e) {
			throw new RadarrError(`Can't reach Radarr at ${url}`, 0);
		}
		let json;
		try { json = res.json; } catch (e) { json = undefined; }
		if (res.status < 200 || res.status >= 300) throw new RadarrError(describe(json, res.status), res.status);
		return json;
	}

	return {
		getMovies: () => call("GET", "/movie"),
		// Read-only title search through Radarr (TMDB): nothing is added. Films already in the library carry their id.
		lookup: term => call("GET", `/movie/lookup?term=${encodeURIComponent(term)}`),
		// Puts a film on the monitor list: monitored, but no search, so nothing downloads until a release is picked.
		async addMonitored(found, movies) {
			const same = m => m.tmdbId === found.tmdbId;
			if (!movies.length) movies = await call("GET", "/movie");
			const have = movies.find(same);
			if (have) return have.monitored ? have : call("PUT", `/movie/${have.id}`, { ...have, monitored: true });
			const [roots, profiles] = await Promise.all([call("GET", "/rootfolder"), call("GET", "/qualityprofile")]);
			const defaults = chooseDefaults(roots, profiles, movies);
			try {
				return await call("POST", "/movie", { ...found, ...defaults, monitored: true, addOptions: { searchForMovie: false } });
			} catch (e) {
				if (e.status === 400) {
					const existing = (await call("GET", "/movie")).find(same);
					if (existing) return existing.monitored ? existing : call("PUT", `/movie/${existing.id}`, { ...existing, monitored: true });
				}
				throw e;
			}
		},
		// Free bytes on the volume holding the first root folder (where new films are added); null if Radarr doesn't say.
		async getFreeSpace() {
			const roots = await call("GET", "/rootfolder");
			return roots[0]?.freeSpace ?? null;
		},
		getQueue: async () => (await call("GET", "/queue?pageSize=500")).records ?? [],
		// Slow: Radarr queries the indexers while this request is open.
		getReleases: movieId => call("GET", `/release?movieId=${encodeURIComponent(movieId)}`),
		// Read-only TMDB lookup through Radarr: nothing is added.
		async getReleaseDates(tmdbId) {
			let f;
			try { f = await call("GET", `/movie/lookup/tmdb?tmdbId=${tmdbId}`); }
			catch (e) {
				// An id TMDB no longer has is that one film's problem, not Radarr's: callers keep going.
				if (/was not found/i.test(e.message)) return null;
				throw e;
			}
			if (!f) return null;
			return { inCinemas: f.inCinemas, digitalRelease: f.digitalRelease, physicalRelease: f.physicalRelease, releaseDate: f.releaseDate };
		},
		// Removes the Radarr record and its folder on disk.
		deleteMovie: id => call("DELETE", `/movie/${encodeURIComponent(id)}?deleteFiles=true&addImportExclusion=false`),
		// Deletes only the file, then unmonitors so Radarr does not fetch it again; the record stays.
		async deleteFile(movie) {
			if (movie.movieFile?.id == null) throw new RadarrError("Radarr has no file for this movie", 0);
			await call("DELETE", `/moviefile/${movie.movieFile.id}`);
			if (movie.monitored) await call("PUT", `/movie/${movie.id}`, { ...movie, monitored: false, hasFile: false, movieFile: undefined });
		},
		// Cancels a download: removes it from Radarr's queue and from SABnzbd, without blocklisting the release.
		removeQueueItem: id => call("DELETE", `/queue/${encodeURIComponent(id)}?removeFromClient=true&blocklist=false`),
		async unmonitor(movie) {
			if (movie.monitored) await call("PUT", `/movie/${movie.id}`, { ...movie, monitored: false });
		},
		grab: ({ guid, indexerId, movieId }) => call("POST", "/release", { guid, indexerId, movieId }),

		// Returns the film's Radarr record, adding it unmonitored (and without a search) when it is not there yet.
		async ensureMovie(tmdbId, movies) {
			// An empty list may just mean it was not fetched yet; the defaults must come from the real library.
			if (!movies.length) movies = await call("GET", "/movie");
			const have = movies.find(m => m.tmdbId === tmdbId);
			if (have) return have;
			const [roots, profiles] = await Promise.all([call("GET", "/rootfolder"), call("GET", "/qualityprofile")]);
			const defaults = chooseDefaults(roots, profiles, movies);
			const found = await call("GET", `/movie/lookup/tmdb?tmdbId=${tmdbId}`);
			try {
				return await call("POST", "/movie", { ...found, ...defaults, monitored: false, addOptions: { searchForMovie: false } });
			} catch (e) {
				// Added by something else since our list was fetched (e.g. lettarrboxd).
				if (e.status === 400) {
					const existing = (await call("GET", "/movie")).find(m => m.tmdbId === tmdbId);
					if (existing) return existing;
				}
				throw e;
			}
		},
	};
}

const api = { createClient, chooseDefaults, RadarrError };
export default api;
export { createClient, chooseDefaults, RadarrError };
