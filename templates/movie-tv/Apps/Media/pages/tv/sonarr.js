// Sonarr API v3 client for the Downloadrr TV view. `request` is injected (Obsidian's requestUrl in the vault, a
// fake in tests). view.js loads this with new Function(source)(), which returns the object below.

class SonarrError extends Error {
	constructor(message, status) {
		super(message);
		this.name = "SonarrError";
		this.status = status;
	}
}

function describe(json, status) {
	if (status === 401) return "Sonarr rejected the API key (401)";
	const msgs = Array.isArray(json)
		? json.map(e => e?.errorMessage ?? e?.message)
		: [json?.message ?? json?.error];
	const text = msgs.filter(Boolean).join("; ");
	return text || `Sonarr returned HTTP ${status}`;
}

// Existing series show which quality profile this setup actually uses, so added shows get the same one.
function chooseDefaults(roots, profiles, series) {
	if (!roots.length) throw new SonarrError("Sonarr has no root folder configured", 0);
	const known = new Set(profiles.map(p => p.id));
	const counts = new Map();
	for (const s of series) if (known.has(s.qualityProfileId)) counts.set(s.qualityProfileId, (counts.get(s.qualityProfileId) ?? 0) + 1);
	const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
	const qualityProfileId = top ? top[0] : profiles[0]?.id;
	if (qualityProfileId == null) throw new SonarrError("Sonarr has no quality profile configured", 0);
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
			throw new SonarrError(`Can't reach Sonarr at ${url}`, 0);
		}
		let json;
		try { json = res.json; } catch (e) { json = undefined; }
		if (res.status < 200 || res.status >= 300) throw new SonarrError(describe(json, res.status), res.status);
		return json;
	}

	return {
		getSeries: () => call("GET", "/series"),
		// Free bytes on the volume holding the first root folder (where new shows are added); null if Sonarr doesn't say.
		async getFreeSpace() {
			const roots = await call("GET", "/rootfolder");
			return roots[0]?.freeSpace ?? null;
		},
		// One record per episode; a season pack is several records sharing one downloadId.
		getQueue: async () => (await call("GET", "/queue?pageSize=500&includeEpisode=true")).records ?? [],
		// Slow: Sonarr queries the indexers while this request is open. Returns season packs and single episodes.
		getReleases: (seriesId, seasonNumber) => call("GET", `/release?seriesId=${encodeURIComponent(seriesId)}&seasonNumber=${encodeURIComponent(seasonNumber)}`),
		getEpisodes: seriesId => call("GET", `/episode?seriesId=${encodeURIComponent(seriesId)}`),
		async setEpisodesMonitored(ids, monitored) { if (ids.length) await call("PUT", "/episode/monitor", { episodeIds: ids, monitored }); },
		// A season's flag sits on the series record; Sonarr applies it to the season's episodes when the series is saved.
		async setSeasonMonitored(seriesId, seasonNumber, monitored) {
			const s = await call("GET", `/series/${encodeURIComponent(seriesId)}`);
			await call("PUT", `/series/${s.id}`, { ...s, seasons: s.seasons.map(x => x.seasonNumber === seasonNumber ? { ...x, monitored } : x) });
		},
		// On: the show and all its seasons (not specials); off: just the show, so nothing is fetched for it.
		async setSeriesMonitored(seriesId, monitored) {
			const s = await call("GET", `/series/${encodeURIComponent(seriesId)}`);
			await call("PUT", `/series/${s.id}`, { ...s, monitored, seasons: monitored ? s.seasons.map(x => ({ ...x, monitored: x.seasonNumber > 0 ? true : x.monitored })) : s.seasons });
		},
		getEpisodeFiles: seriesId => call("GET", `/episodefile?seriesId=${encodeURIComponent(seriesId)}`),
		// Deletes the files from disk; the episodes stay in Sonarr.
		async deleteEpisodeFiles(ids) { if (ids.length) await call("DELETE", "/episodefile/bulk", { episodeFileIds: ids }); },
		// Unmonitored, Sonarr does not fetch them again.
		async unmonitorEpisodes(ids) { if (ids.length) await call("PUT", "/episode/monitor", { episodeIds: ids, monitored: false }); },
		// Slow, like getReleases: one episode's releases.
		getEpisodeReleases: episodeId => call("GET", `/release?episodeId=${encodeURIComponent(episodeId)}`),
		// Read-only: nothing is added. term is free text, or "tvdb:<id>" / "tmdb:<id>".
		lookup: term => call("GET", `/series/lookup?term=${encodeURIComponent(term)}`),
		// Removes the Sonarr record and its folder on disk.
		deleteSeries: id => call("DELETE", `/series/${encodeURIComponent(id)}?deleteFiles=true&addImportListExclusion=false`),
		// Deletes only the episode files, then unmonitors so Sonarr does not fetch them again; the record stays.
		async deleteFiles(series) {
			const files = await call("GET", `/episodefile?seriesId=${encodeURIComponent(series.id)}`);
			if (files.length) await call("DELETE", "/episodefile/bulk", { episodeFileIds: files.map(f => f.id) });
			if (series.monitored) await call("PUT", `/series/${series.id}`, { ...series, monitored: false });
		},
		// Cancels downloads: removes them from Sonarr's queue and from SABnzbd, without blocklisting the release.
		removeQueueItems: ids => call("DELETE", "/queue/bulk?removeFromClient=true&blocklist=false", { ids }),
		async unmonitor(series) {
			if (series.monitored) await call("PUT", `/series/${series.id}`, { ...series, monitored: false });
		},
		grab: ({ guid, indexerId }) => call("POST", "/release", { guid, indexerId }),

		// Puts a show on the monitor list: every episode monitored, nothing searched, so nothing downloads until a release is picked.
		async addMonitored(found, list) {
			const same = s => s.tvdbId === found.tvdbId;
			const monitor = s => s.monitored ? s : call("PUT", `/series/${s.id}`, { ...s, monitored: true, seasons: (s.seasons ?? []).map(x => ({ ...x, monitored: x.seasonNumber > 0 })) });
			if (!list.length) list = await call("GET", "/series");
			const have = list.find(same);
			if (have) return monitor(have);
			const [roots, profiles] = await Promise.all([call("GET", "/rootfolder"), call("GET", "/qualityprofile")]);
			const defaults = chooseDefaults(roots, profiles, list);
			try {
				return await call("POST", "/series", { ...found, ...defaults, monitored: true, seasonFolder: true, addOptions: { monitor: "all", searchForMissingEpisodes: false, searchForCutoffUnmetEpisodes: false } });
			} catch (e) {
				if (e.status === 400) {
					const existing = (await call("GET", "/series")).find(same);
					if (existing) return monitor(existing);
				}
				throw e;
			}
		},

		// Returns the show's Sonarr record, adding it unmonitored (nothing searched) when it is not there yet.
		// entry: { tvdbId } or { tmdbId }.
		async ensureSeries(entry, list) {
			const same = s => (entry.tvdbId && s.tvdbId === entry.tvdbId) || (!entry.tvdbId && entry.tmdbId && s.tmdbId === entry.tmdbId);
			// An empty list may just mean it was not fetched yet; the defaults must come from the real library.
			if (!list.length) list = await call("GET", "/series");
			const have = list.find(same);
			if (have) return have;
			const [roots, profiles] = await Promise.all([call("GET", "/rootfolder"), call("GET", "/qualityprofile")]);
			const defaults = chooseDefaults(roots, profiles, list);
			const found = (await call("GET", `/series/lookup?term=${encodeURIComponent(entry.tvdbId ? `tvdb:${entry.tvdbId}` : `tmdb:${entry.tmdbId}`)}`))[0];
			if (!found) throw new SonarrError("Sonarr's lookup does not know this show", 0);
			try {
				return await call("POST", "/series", { ...found, ...defaults, monitored: false, seasonFolder: true, addOptions: { monitor: "none", searchForMissingEpisodes: false, searchForCutoffUnmetEpisodes: false } });
			} catch (e) {
				// Added by something else since our list was fetched.
				if (e.status === 400) {
					const existing = (await call("GET", "/series")).find(same);
					if (existing) return existing;
				}
				throw e;
			}
		},
	};
}

const api = { createClient, chooseDefaults, SonarrError };
export default api;
export { createClient, chooseDefaults, SonarrError };
