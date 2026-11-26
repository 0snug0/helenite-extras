// Part of the TV page: the "On disk & downloading" table with its on-disk season/episode tree and the two-click delete button.
// `c` is the context shared by every part (see index.js).
import lib from "./lib.js";
import { KEYS, LOGOS, ACTIVE_COLS } from "./consts.js";
import { button, emptyState, loadingState, statusText, table } from "../../core/ui-kit.js";
import { activeColumns, activeSection } from "../../core/active-table.js";
import { progressBar } from "../../core/progress.js";
import { STATUS_TONES } from "../../core/tones.js";
import { formatSize } from "../../core/releases.js";
import { rowStatus } from "../../core/rows.js";
import { epKey } from "../../core/plex.js";

export function install(c) {
	const { state, notes } = c;
	const draw = (...a) => c.draw(...a);
	const openUrl = (...a) => c.openUrl(...a);
	const seasonName = (...a) => c.seasonName(...a);
	const epCode = (...a) => c.epCode(...a);
	const plexEpisodes = (...a) => c.plexEpisodes(...a);
	const watchMark = (...a) => c.watchMark(...a);
	const toggleSeries = (...a) => c.toggleSeries(...a);
	const removeEpisodeFiles = (...a) => c.removeEpisodeFiles(...a);
	const removeSeries = (...a) => c.removeSeries(...a);
	const togglePause = (...a) => c.togglePause(...a);
	const percentFor = (...a) => c.percentFor(...a);
	const scoresOf = series => state.scores[series.tvdbId];
	let armTimer, armedAt = 0;
	const queuePosition = g => c.sabSlots.get(g.downloadId)?.index ?? null;
	function drawActive(parent) {
		const items = lib.activeShows(state.series, state.queue, queuePosition);
		if (!items.length) return;
		const sort = state.activeSort;
		const total = items.reduce((n, i) => n + (i.queue ? 0 : i.size), 0);   // what is on disk; a download's size is not there yet
		const sec = activeSection(parent, { count: items.length, total, free: state.free, service: "Sonarr" });
		const slotOf = i => i.queue && c.sabSlots.get(i.queue.downloadId);
		// A download's percent is SABnzbd's live one, so sorting by Status or Progress agrees with the bar.
		const status = new Map(items.map(i => {
			const st = rowStatus(i, { slot: i.queue ? c.sabStates.get(i.queue.downloadId) : undefined });
			return [i.key, i.queue ? { ...st, percent: Math.floor(percentFor(i.queue)) } : st];
		}));
		// The # column: a download's place among the shows still in the queue, whatever the table is sorted by.
		const place = new Map();
		for (const i of items) if (i.queue && ["downloading", "paused", "queued"].includes(status.get(i.key).kind)) place.set(i.key, place.size + 1);
		const score = (key, fmt) => (i, td) => { const sc = i.series.tvdbId && scoresOf(i.series), v = sc?.[key]; td.textContent = !sc ? "…" : v == null ? "–" : fmt(v); };

		// The actions stay in the first column (fixed slots), so they are a column, not the table's trailing `actions`.
		const cells = {
			act: (item, td) => {
				const { series, queue: qi, group } = item;
				const slot = slotOf(item), st = status.get(item.key);
				// Always in the same order and the same slots: delete file(s), delete from Sonarr, pause/resume (downloads only).
				const act = td.createDiv({ cls: "hel-table-buttons" });
				const hasFiles = (series.statistics?.episodeFileCount ?? 0) > 0;
				const tips = qi
					? [["file", "Cancel this download"], ["all", `Cancel the download${hasFiles ? ", delete the files" : ""} and remove from Sonarr and the watchlist`]]
					: [["file", "Delete the files, keep in Sonarr (unmonitored)"], ["all", "Delete the files and remove from Sonarr and the watchlist"]];
				for (const [mode, tip] of tips) xButton(act, `${mode}:${item.key}`, tip, () => removeSeries(series, mode, group), mode === "file" ? "file" : "sonarr");
				if (place.has(item.key) && slot && c.sabSet && !c.sabQueuePaused) {   // with the whole queue paused, resuming one job would do nothing
					const paused = st.kind === "paused";
					button(act, { icon: paused ? "play" : "pause", label: paused ? "Resume this download" : "Pause this download", variant: "icon", disabled: !!state.pausing, onClick: () => { togglePause(qi); } });
				}
			},
			pos: item => (place.has(item.key) ? String(place.get(item.key)) : ""),
			title: (item, td) => {
				const { series, queue: qi } = item;
				// The watchlist note's own link when there is one; otherwise just the title.
				const note = notes.find(n => lib.matchSeries(n, [series], state.ids));
				// Only what is on disk expands; a download is just its row until it has imported.
				if (qi) td.createSpan({ cls: "hel-table-spacer" });
				else chevron(td, state.open.has(series.id), "Show the seasons on disk", () => toggleSeries(series));
				if (note?.url) button(td, { text: series.title, variant: "link", onClick: openUrl(note.url) }).el.title = `${series.title} on Serializd`;
				else td.createSpan({ text: series.title });
			},
			episodes: item => item.detail,
			date: item => item.date || "–",
			status: (item, td) => {
				const qi = item.queue, st = status.get(item.key);
				const why = qi
					? (qi.statusMessages ?? []).flatMap(m => m.messages ?? []).concat(qi.errorMessage ?? [], c.sabQueuePaused && place.has(item.key) ? "SABnzbd's whole queue is paused" : []).join("\n")
					: "";
				td.classList.add("dl-st", `dl-st-${st.kind}`);
				if (why) td.title = why;
				statusText(td, st.label, STATUS_TONES[st.kind]);
			},
			size: item => item.size ? formatSize(item.size) : "–",
			progress: (item, td) => { const { percent, kind } = status.get(item.key); progressBar(td, percent, kind); },
			sz: score("sz", x => x.toFixed(2)),
			rt: score("rt", x => `${x}%`),
			aud: score("aud", x => `${x}%`),
		};
		// An on-disk tree row draws only its own cells; the rest stay empty.
		const cellsOf = Object.fromEntries(Object.entries(cells).map(([key, cell]) => [key, (row, td) => (row.tree ? row.tree[key]?.(td) : cell(row, td))]));
		table(sec, {
			className: "dl-table dl-active-table", fixed: true, minWidth: "1100px",
			columns: activeColumns({ cols: ACTIVE_COLS, logos: LOGOS, cells: cellsOf }),
			// Under an open series row: its seasons on disk, and under an open season its episodes.
			rows: lib.sortActive(items, sort.key, sort.dir, i => status.get(i.key), i => scoresOf(i.series))
				.flatMap(item => (!item.queue && state.open.has(item.series.id) ? [item, ...treeRows(item.series)] : [item])),
			rowData: row => (row.queue ? { dlQueue: row.group.key } : {}),
			rowLevel: row => row.level ?? 0,
			sort,
			onSort: key => {
				state.activeSort = { key, dir: sort.key === key && sort.dir === "asc" ? "desc" : "asc" };
				c.save(KEYS.activeSort, state.activeSort);
				draw();
			},
		});
	}
	function chevron(parent, open, tip, run) {
		button(parent, { icon: open ? "chevron-down" : "chevron-right", label: open ? "Hide" : tip, variant: "icon", onClick: e => { e.stopPropagation(); run(); } }).el.classList.add("dl-chev");
	}
	// The rows under a series: its seasons that have files, each expandable to its episodes on disk, each with a delete button
	// (files only; the episodes stay in Sonarr, unmonitored so they are not fetched again).
	function treeRows(series) {
		const tree = state.trees[series.id];
		const note = draw => [{ level: 1, tree: { title: draw } }];
		if (!tree) return note(td => loadingState(td));
		if (!tree.seasons.length) return note(td => emptyState(td, "No episode files on disk.", { variant: "inline" }));
		const count = n => `${n} episode${n === 1 ? "" : "s"}`;
		const pmap = plexEpisodes({ series });
		const del = (key, tip, episodes) => td => xButton(td.createDiv({ cls: "hel-table-buttons" }), key, tip, () => removeEpisodeFiles(series, episodes), "file");
		return tree.seasons.flatMap(s => {
			const key = `${series.id}:${s.seasonNumber}`, open = state.openSeason.has(key);
			const watched = pmap ? s.episodes.filter(e => pmap.get(epKey(e))?.watched).length : 0;
			const season = { level: 1, tree: {
				act: del(`season:${key}`, `Delete the files of ${seasonName(s.seasonNumber)} (${count(s.episodes.length)}), keep the show in Sonarr`, s.episodes),
				title: td => { chevron(td, open, "Show the episodes on disk", () => { open ? state.openSeason.delete(key) : state.openSeason.add(key); draw(); }); td.createSpan({ text: seasonName(s.seasonNumber) }); },
				episodes: td => td.setText(count(s.episodes.length)),
				progress: watched ? td => {
					const all = watched === s.episodes.length;
					const el = statusText(td, all ? "✓ Watched" : `${watched}/${s.episodes.length} watched`, all ? "success" : "warning");
					el.classList.add("dl-watch");
					el.title = "Watched in Plex";
				} : undefined,
				size: td => td.setText(formatSize(s.size)),
			} };
			if (!open) return [season];
			return [season, ...s.episodes.map(e => ({ level: 2, tree: {
				act: del(`ep:${e.id}`, `Delete the file of ${epCode(e)}, keep the show in Sonarr`, [e]),
				title: td => td.createSpan({ text: `${epCode(e)} ${e.title}`, attr: { title: e.title } }),
				progress: td => watchMark(td, pmap, e),
				size: td => td.setText(formatSize(e.size)),
			} }))];
		});
	}
	// A delete button that confirms with a second click: the first click turns the x (or its icon) into a check, same
	// size so nothing shifts, the second runs it, and it disarms by itself after ARM_MS.
	const ARM_MS = 3000, ARM_GUARD_MS = 500;   // the second half of a double-click must not count as the confirming click
	function xButton(parent, key, tip, run, iconName) {
		const armed = state.armed === key;
		// aria-label only: Obsidian shows it as the tooltip, and a title too would add the browser's own.
		button(parent, { icon: armed ? "check" : iconName ?? "x", label: armed ? "Click again to confirm" : tip, variant: "icon", armed, disabled: !c.client || !!state.removing, onClick: () => {
			if (armed && Date.now() - armedAt < ARM_GUARD_MS) return;
			clearTimeout(armTimer);
			if (armed) { state.armed = null; run(); return; }
			state.armed = key;
			armedAt = Date.now();
			armTimer = c.later(() => { if (state.armed === key) { state.armed = null; draw(); } }, ARM_MS);
			draw();
		} }).el.classList.add("dl-x");
	}

	Object.assign(c, { drawActive, chevron, treeRows, xButton, scoresOf });
}
