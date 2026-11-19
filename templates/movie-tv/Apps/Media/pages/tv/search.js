// Part of the TV page: the one-click season/episode search (Sonarr's pick). `c` is the context shared by every part (see index.js).
import lib from "./lib.js";

export function install(c) {
	const { state } = c;
	const draw = (...a) => c.draw(...a);
	const panelBusy = (...a) => c.panelBusy(...a);
	const today = (...a) => c.today(...a);
	const seasonName = (...a) => c.seasonName(...a);
	const epCode = (...a) => c.epCode(...a);
	const refreshSonarr = (...a) => c.refreshSonarr(...a);
	// Sonarr's pick, no table: for a season, its full-season pack when there is a usable one (and the season is still
	// empty), otherwise the best release of each missing aired episode, from the season's own results first and a search
	// per episode where those have none. Releases Sonarr rejects (the quality profile, say) are never taken.
	async function autoSearch(show, scope) {
		const p = state.panel;
		if (!p || panelBusy()) return;
		p.auto = scope.episode ? `${epCode(scope.episode)}` : seasonName(scope.season);
		p.error = null; p.notice = null;
		const step = text => { p.notice = text; if (state.panel === p) draw(); };
		const grabbed = new Set();
		const send = async r => { await c.client.grab({ guid: r.guid, indexerId: r.indexerId }); grabbed.add(r.guid); };
		try {
			if (scope.episode) {
				const e = scope.episode;
				step(`Searching ${seasonName(e.seasonNumber)} ${epCode(e)}…`);
				const pick = lib.pickBest((await c.client.getEpisodeReleases(e.id)).map(r => lib.normalizeRelease(r)).filter(r => !r.fullSeason && r.episodes.includes(e.episodeNumber)));
				if (pick) { await send(pick); p.notice = `${epCode(e)}: sent ${pick.title}`; }
				else p.notice = `${epCode(e)}: no release Sonarr would accept.`;
			} else {
				const n = scope.season;
				const season = lib.groupEpisodes(p.episodes, state.queue, today()).find(s => s.seasonNumber === n);
				const plan = lib.planSeason(season);
				if (!plan.missing.length) p.notice = `${seasonName(n)}: nothing missing.`;
				else {
					step(`Searching ${seasonName(n)}…`);
					const releases = (await c.client.getReleases(p.seriesId, n)).map(r => lib.normalizeRelease(r));
					const pack = plan.packFirst ? lib.pickBest(releases.filter(r => r.fullSeason)) : null;
					if (pack) { await send(pack); p.notice = `${seasonName(n)}: sent the full season, ${pack.title}`; }
					else {
						const covered = new Set(), missed = [];
						for (const e of plan.missing) {
							if (covered.has(e.episodeNumber)) continue;
							let pick = lib.pickBest(releases.filter(r => !r.fullSeason && r.episodes.length === 1 && r.episodes[0] === e.episodeNumber));
							if (!pick) {
								step(`Searching ${seasonName(n)} ${epCode(e)}…`);
								pick = lib.pickBest((await c.client.getEpisodeReleases(e.id)).map(r => lib.normalizeRelease(r)).filter(r => !r.fullSeason && r.episodes.includes(e.episodeNumber)));
							}
							if (pick) { await send(pick); for (const x of pick.episodes) covered.add(x); }
							else missed.push(epCode(e));
						}
						const sent = grabbed.size;
						p.notice = sent ? `${seasonName(n)}: ${plan.packFirst ? "no full-season release, so " : ""}sent ${sent} download${sent === 1 ? "" : "s"}${missed.length ? `; no release Sonarr would accept for ${missed.join(", ")}` : ""}` : `${seasonName(n)}: no release Sonarr would accept.`;
					}
				}
			}
		} catch (e) {
			p.error = grabbed.size ? `${e.message} (${grabbed.size} already sent)` : e.message;
			p.notice = null;
		}
		p.auto = null;
		if (grabbed.size) { state.pollUntil = Date.now() + 60000; c.later(async () => { await refreshSonarr(); draw(); }, 1500); }   // let Sonarr put them in its queue first
		if (state.panel === p) draw();
	}

	Object.assign(c, { autoSearch });
}
