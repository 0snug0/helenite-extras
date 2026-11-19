// Part of the TV page: the show panel (the modal body): seasons and episodes with their monitor / search buttons, and the
// release table of one season or episode (core's renderReleaseTable). `c` is the context shared by every part (see index.js).
import lib from "./lib.js";
import { KEYS } from "./consts.js";
import { button, emptyState, errorState, loadingState, statusDot } from "../../core/ui-kit.js";
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
		const head = el.createDiv({ cls: "dl-panel-head" });
		head.createSpan({ cls: "dl-panel-title", text: p.view ? `${show.title}: ${p.view.label}` : `${show.title}${show.year ? ` (${show.year})` : ""}` });
		if (p.view) {
			button(head, { text: "Back", disabled: !!state.grabbing, onClick: () => { p.view = null; p.confirm = null; p.notice = null; p.error = null; draw(); } });
			button(head, { text: "Refresh", disabled: !!panelBusy(), onClick: () => { state.sent.clear(); openReleases(show, p.view.scope); } });
		}
		button(head, { text: "Close", disabled: !!state.grabbing || !!p.auto, onClick: () => { state.panel = null; draw(); } });

		if (p.notice) el.createDiv({ cls: "dl-notice", text: p.notice });
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
		const mon = el.createDiv({ cls: "dl-mon" });
		const top = mon.createDiv({ cls: "dl-mon-row" });
		const sb = button(top, {
			icon: sum.seriesMonitored ? "bookmarkOn" : "bookmark", text: sum.seriesMonitored ? "Monitored" : "Not monitored",
			label: sum.seriesMonitored ? "Stop monitoring this show" : "Monitor this show and all its seasons",
			disabled: !!panelBusy(), onClick: () => { toggleMonitor(show, { to: !sum.seriesMonitored }); },
		}).el;
		sb.classList.add("dl-mon-btn");
		sb.classList.toggle("dl-mon-on", sum.seriesMonitored);
		top.createSpan({ cls: "dl-mon-fact", text: `${sum.monitoredEpisodes}/${sum.total} episodes monitored` });
		top.createSpan({ cls: "dl-mon-fact", text: `New seasons: ${sum.newSeasons ? "monitored" : "not monitored"}` });
		top.createSpan({ cls: "dl-mon-fact", text: series?.status === "ended" ? "Ended" : series?.status === "upcoming" ? "Upcoming" : "Continuing" });
		mon.createDiv({ cls: "dl-mon-next", text: sum.ended && !sum.next ? "Ended: no new episodes are coming."
			: sum.next ? `Next: ${sum.next.code}, ${sum.next.airDate}. ${sum.next.monitored && sum.seriesMonitored ? "Monitored: Sonarr downloads it when a release appears." : "Not monitored: Sonarr will not download it."}`
			: "No upcoming episode is announced yet." });
		const pmap = plexEpisodes(show), pst = showState(plexOf(show));
		if (pmap) {
			const nx = nextUp(pmap);
			const label = pst.kind === "watched" ? "Watched all of it in Plex." : pst.kind === "watching" ? `Watching in Plex: ${pst.watched}/${pst.total} watched.` : "Not started in Plex.";
			const [ns, ne] = nx ? nx.split(":").map(Number) : [];
			mon.createDiv({ cls: "dl-mon-next", text: nx && pst.kind !== "watched" ? `${label} Up next: S${String(ns).padStart(2, "0")}E${String(ne).padStart(2, "0")}.` : label });
		}
		const tally = pmap ? seasonTally(pmap, p.episodes) : {};
		el.createEl("h3", { cls: "dl-active-title", text: "Seasons" });
		const seasons = lib.groupEpisodes(p.episodes, state.queue, today());
		if (!seasons.length) emptyState(el, "Sonarr has no episodes for this show yet.");
		const busy = !!panelBusy();
		const iconBtn = (parent, name, tip, run) => {
			const b = button(parent, { icon: name, label: tip, variant: "icon", disabled: busy, onClick: e => { e.stopPropagation(); run(); } }).el;
			b.classList.add("dl-ib");
			return b;
		};
		for (const s of seasons) {
			const open = p.expanded.has(s.seasonNumber);
			const box = el.createDiv({ cls: "dl-season" });
			const row = box.createDiv({ cls: "dl-season-head" });
			button(row, { icon: open ? "chevron-down" : "chevron-right", label: open ? "Collapse" : "Expand to the episodes", variant: "icon", onClick: () => { open ? p.expanded.delete(s.seasonNumber) : p.expanded.add(s.seasonNumber); draw(); } }).el.classList.add("dl-ib", "dl-chev");
			row.createSpan({ cls: "dl-season-name", text: seasonName(s.seasonNumber) });
			const prog = row.createDiv({ cls: "dl-season-prog" });
			prog.createDiv({ cls: `dl-bar${s.files === s.total ? " dl-bar-importing" : " dl-bar-started"}` }).createDiv({ cls: "dl-bar-fill" }).style.width = `${s.total ? Math.round(100 * s.files / s.total) : 0}%`;
			prog.createSpan({ cls: "dl-bar-label", text: `${s.files}/${s.total}` });
			const tl = tally[s.seasonNumber];
			if (tl?.watched) row.createSpan({ cls: `dl-watch ${tl.watched === tl.total ? "dl-watch-done" : "dl-watch-part"}`, text: tl.watched === tl.total ? "✓ Watched" : `▶ ${tl.watched}/${tl.total} watched`, attr: { title: "Watched in Plex" } });
			const acts = row.createDiv({ cls: "dl-season-acts" });
			const sm = !!series?.seasons?.find(x => x.seasonNumber === s.seasonNumber)?.monitored;
			iconBtn(acts, sm ? "bookmarkOn" : "bookmark", sm ? `Monitored (${s.monitoredCount}/${s.total} episodes): Sonarr downloads new episodes of this season. Click to stop.` : "Not monitored. Click to monitor this season.", () => toggleMonitor(show, { season: s.seasonNumber, to: !sm })).classList.toggle("dl-mon-on", sm);
			iconBtn(acts, "search", "Search the season: a full-season download if there is one, otherwise the best release of each missing episode", () => autoSearch(show, { season: s.seasonNumber }));
			iconBtn(acts, "grid", "Interactive search: pick a release yourself", () => openReleases(show, { season: s.seasonNumber }));
			if (!open) continue;
			for (const e of s.episodes) {
				const er = box.createDiv({ cls: `dl-ep${e.aired ? "" : " dl-ep-unaired"}` });
				const dotLabel = e.hasFile ? "On disk" : e.queued ? "Downloading" : e.aired ? "Missing" : "Not aired yet";
				statusDot(er, e.hasFile ? "success" : e.queued ? "accent" : "default", dotLabel).title = dotLabel;
				er.createSpan({ cls: "dl-ep-num", text: epCode(e) });
				er.createSpan({ cls: "dl-ep-title", text: e.title, attr: { title: e.title } });
				er.createSpan({ cls: "dl-ep-date", text: e.airDate || "" });
				watchMark(er, pmap, e);
				const ea = er.createDiv({ cls: "dl-season-acts" });
				iconBtn(ea, e.monitored ? "bookmarkOn" : "bookmark", e.monitored ? "Monitored. Click to stop." : "Not monitored. Click to monitor this episode.", () => toggleMonitor(show, { episode: e, to: !e.monitored })).classList.toggle("dl-mon-on", e.monitored);
				iconBtn(ea, "search", `Search ${epCode(e)}: the best release`, () => autoSearch(show, { episode: e }));
				iconBtn(ea, "grid", `Interactive search for ${epCode(e)}`, () => openReleases(show, { episode: e }));
			}
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
