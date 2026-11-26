// Part of the TV page: the show panel (the modal body): seasons and episodes with their monitor / search buttons, and the
// release table of one season or episode (core's renderReleaseTable). `c` is the context shared by every part (see index.js).
import lib from "./lib.js";
import { KEYS } from "./consts.js";
import { button, callout, card, disclosure, emptyState, errorState, loadingState, meter, sectionHeading, statusDot, statusText, table, toolbar } from "../../core/ui-kit.js";
import { renderReleaseTable } from "../../core/releases.js";
import { showState, nextUp, seasonTally } from "../../core/plex.js";

export function install(c) {
	const { state } = c;
	const draw = (...a) => c.draw(...a);
	const redrawModal = (...a) => c.redrawModal(...a);
	const busy = (...a) => c.busy(...a);
	const panelBusy = (...a) => c.panelBusy(...a);
	const today = (...a) => c.today(...a);
	const seasonName = (...a) => c.seasonName(...a);
	const epCode = (...a) => c.epCode(...a);
	const plexOf = (...a) => c.plexOf(...a);
	const plexEpisodes = (...a) => c.plexEpisodes(...a);
	const watchMark = (...a) => c.watchMark(...a);
	const toggleMonitor = (...a) => c.toggleMonitor(...a);
	const openReleases = (...a) => c.openReleases(...a);
	const autoSearch = (...a) => c.autoSearch(...a);
	const grabRelease = (...a) => c.grabRelease(...a);
	// The modal: a list of seasons (newest first, each expandable to its episodes). Every season and episode has two
	// buttons: search (Sonarr's pick, see autoSearch) and interactive search (the release table, to choose by hand).
	function releasePanel(show) {
		const p = state.panel;
		const el = createDiv({ cls: "dl-panel" });
		const head = sectionHeading(el, { title: p.view ? `${show.title}: ${p.view.label}` : `${show.title}${show.year ? ` (${show.year})` : ""}` });
		head.titleEl.classList.add("dl-panel-title");
		if (p.view) {
			button(head.actions, { text: "Back", disabled: !!state.grabbing, onClick: () => { p.view = null; p.confirm = null; p.notice = null; p.error = null; draw(); } });
			button(head.actions, { text: "Refresh", disabled: !!panelBusy(), onClick: () => { state.sent.clear(); openReleases(show, p.view.scope); } });
		}
		button(head.actions, { text: "Close", disabled: !!state.grabbing || !!p.auto, onClick: () => { state.panel = null; draw(); } });

		if (p.notice) callout(el, { tone: "success", text: p.notice }).el.classList.add("dl-notice");
		if (p.error) errorState(el, p.error);
		if (p.phase === "loading") { loadingState(el, "Loading the show from Sonarr…"); return el; }
		if (p.phase === "error") return el;
		if (p.view) return releaseTable(el, show);
		return seasonList(el, show);
	}
	function seasonList(el, show) {
		const p = state.panel;
		const series = state.series.find(s => s.id === p.seriesId);
		const sum = lib.monitorSummary(series, p.episodes, today());
		const mon = card(el, { compact: true });
		mon.el.classList.add("dl-mon");
		const top = toolbar(mon.body);
		const sb = button(top, {
			icon: sum.seriesMonitored ? "bookmarkOn" : "bookmark", text: sum.seriesMonitored ? "Monitored" : "Not monitored",
			label: sum.seriesMonitored ? "Stop monitoring this show" : "Monitor this show and all its seasons",
			pressed: sum.seriesMonitored, disabled: !!panelBusy(), onClick: () => { toggleMonitor(show, { to: !sum.seriesMonitored }); },
		}).el;
		sb.classList.add("dl-mon-btn");
		statusText(top, `${sum.monitoredEpisodes}/${sum.total} episodes monitored`);
		statusText(top, `New seasons: ${sum.newSeasons ? "monitored" : "not monitored"}`);
		statusText(top, series?.status === "ended" ? "Ended" : series?.status === "upcoming" ? "Upcoming" : "Continuing");
		const line = text => mon.body.createDiv({ cls: "dl-mon-next", text });
		line(sum.ended && !sum.next ? "Ended: no new episodes are coming."
			: sum.next ? `Next: ${sum.next.code}, ${sum.next.airDate}. ${sum.next.monitored && sum.seriesMonitored ? "Monitored: Sonarr downloads it when a release appears." : "Not monitored: Sonarr will not download it."}`
			: "No upcoming episode is announced yet.");
		const pmap = plexEpisodes(show), pst = showState(plexOf(show));
		if (pmap) {
			const nx = nextUp(pmap);
			const label = pst.kind === "watched" ? "Watched all of it in Plex." : pst.kind === "watching" ? `Watching in Plex: ${pst.watched}/${pst.total} watched.` : "Not started in Plex.";
			const [ns, ne] = nx ? nx.split(":").map(Number) : [];
			line(nx && pst.kind !== "watched" ? `${label} Up next: S${String(ns).padStart(2, "0")}E${String(ne).padStart(2, "0")}.` : label);
		}
		const tally = pmap ? seasonTally(pmap, p.episodes) : {};
		sectionHeading(el, { title: "Seasons", level: 3 });
		const seasons = lib.groupEpisodes(p.episodes, state.queue, today());
		if (!seasons.length) emptyState(el, "Sonarr has no episodes for this show yet.");
		const busy = !!panelBusy();
		const iconBtn = (parent, name, tip, run) => button(parent, { icon: name, label: tip, variant: "icon", disabled: busy, onClick: e => { e.stopPropagation(); run(); } }).el;
		for (const s of seasons) {
			const open = p.expanded.has(s.seasonNumber);
			const box = disclosure(el, { title: seasonName(s.seasonNumber), open, compact: true, onToggle: next => { next ? p.expanded.add(s.seasonNumber) : p.expanded.delete(s.seasonNumber); draw(); } });
			box.el.classList.add("dl-season");
			const info = toolbar(box.peek, { label: `${seasonName(s.seasonNumber)} actions` });
			meter(info, { label: "On disk", value: s.total ? Math.round(100 * s.files / s.total) : 0, text: `${s.files}/${s.total}`, tone: s.files === s.total ? "success" : "accent" });
			const tl = tally[s.seasonNumber];
			if (tl?.watched) {
				const el = statusText(info, tl.watched === tl.total ? "✓ Watched" : `▶ ${tl.watched}/${tl.total} watched`, tl.watched === tl.total ? "success" : "warning");
				el.classList.add("dl-watch");
				el.title = "Watched in Plex";
			}
			const acts = info.createDiv({ cls: "hel-table-buttons hel-toolbar-end" });
			const sm = !!series?.seasons?.find(x => x.seasonNumber === s.seasonNumber)?.monitored;
			iconBtn(acts, sm ? "bookmarkOn" : "bookmark", sm ? `Monitored (${s.monitoredCount}/${s.total} episodes): Sonarr downloads new episodes of this season. Click to stop.` : "Not monitored. Click to monitor this season.", () => toggleMonitor(show, { season: s.seasonNumber, to: !sm }));
			iconBtn(acts, "search", "Search the season: a full-season download if there is one, otherwise the best release of each missing episode", () => autoSearch(show, { season: s.seasonNumber }));
			iconBtn(acts, "grid", "Interactive search: pick a release yourself", () => openReleases(show, { season: s.seasonNumber }));
			if (!open) continue;
			table(box.body, {
				columns: [
					{ key: "state", title: "", fit: true, cell: (e, td) => { const label = e.hasFile ? "On disk" : e.queued ? "Downloading" : e.aired ? "Missing" : "Not aired yet"; statusDot(td, e.hasFile ? "success" : e.queued ? "accent" : "default", label).title = label; } },
					{ key: "num", title: "Episode", fit: true, cell: e => epCode(e) },
					{ key: "title", title: "Title", truncate: true, cell: (e, td) => { td.title = e.title; return e.title; } },
					{ key: "date", title: "Aired", fit: true, cell: e => e.airDate || "" },
					{ key: "watch", title: "Plex", fit: true, cell: (e, td) => { watchMark(td, pmap, e); } },
				],
				rows: s.episodes,
				rowMuted: e => !e.aired,
				actions: (e, cell) => {
					iconBtn(cell, e.monitored ? "bookmarkOn" : "bookmark", e.monitored ? "Monitored. Click to stop." : "Not monitored. Click to monitor this episode.", () => toggleMonitor(show, { episode: e, to: !e.monitored }));
					iconBtn(cell, "search", `Search ${epCode(e)}: the best release`, () => autoSearch(show, { episode: e }));
					iconBtn(cell, "grid", `Interactive search for ${epCode(e)}`, () => openReleases(show, { episode: e }));
				},
			});
		}
		return el;
	}
	function releaseTable(el, show) {
		const p = state.panel;
		if (p.vphase === "loading") { loadingState(el, "Searching indexers… this can take a few seconds."); return el; }
		if (p.vphase === "error") return el;
		if (!p.releases.length) { emptyState(el, "No releases found."); return el; }
		renderReleaseTable(el, {
			p, releases: p.releases, state, service: "Sonarr",
			extraColumn: { key: "type", label: "Episodes", cell: r => r.label }, sortExtra: lib.RELEASE_SORT,
			onGrab: r => grabRelease(show, r),
			draw: () => draw(), redrawModal: () => redrawModal(),
			saveSort: v => c.save(KEYS.releaseSort, v),
		});
		return el;
	}

	Object.assign(c, { releasePanel, seasonList, releaseTable });
}
