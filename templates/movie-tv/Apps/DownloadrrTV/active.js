// Downloadrr TV: active. Ported from the vault's downloadrr_tv/view.js; `ctx` is the shared view context built in view.js.
import { KEYS, LOGOS, ACTIVE_COLS } from "./constants.js";
import { button, emptyState, loadingState, table } from "./ui-kit.js";

export function install(ctx) {
	const { state, base, lib, plex, notes, root } = ctx;
	const draw = (...a) => ctx.draw(...a);
	const openUrl = (...a) => ctx.openUrl(...a);
	const seasonName = (...a) => ctx.seasonName(...a);
	const epCode = (...a) => ctx.epCode(...a);
	const plexEpisodes = (...a) => ctx.plexEpisodes(...a);
	const watchMark = (...a) => ctx.watchMark(...a);
	const toggleSeries = (...a) => ctx.toggleSeries(...a);
	const removeEpisodeFiles = (...a) => ctx.removeEpisodeFiles(...a);
	const removeSeries = (...a) => ctx.removeSeries(...a);
	const togglePause = (...a) => ctx.togglePause(...a);
	const percentFor = (...a) => ctx.percentFor(...a);
	const scoresOf = series => state.scores[series.tvdbId];
	let armTimer, armedAt = 0;
	const queuePosition = g => ctx.sab.slots.get(g.downloadId)?.index ?? null;
	function drawActive(parent) {
		const items = lib.activeShows(state.series, state.queue, queuePosition);
		if (!items.length) return;
		const sort = state.activeSort;
		const total = items.reduce((n, i) => n + (i.queue ? 0 : i.size), 0);   // what is on disk; a download's size is not there yet
		const sec = parent.createDiv({ cls: "dl-active" });
		const head = sec.createDiv({ cls: "dl-active-head" });
		head.createEl("h3", { cls: "dl-active-title", text: `On disk & downloading (${items.length}) · ${base.formatSize(total)}` });
		if (state.free != null) {
			const free = state.free >= 1e12 ? `${(state.free / 1e12).toFixed(2)} TB` : base.formatSize(state.free);
			head.createSpan({ cls: "dl-free", text: `${free} free`, attr: { title: "Free space on Sonarr's root folder" } });
		}
		const slotOf = i => i.queue && ctx.sab.slots.get(i.queue.downloadId);
		// A download's percent is SABnzbd's live one, so sorting by Status or Progress agrees with the bar.
		const status = new Map(items.map(i => {
			const st = base.rowStatus(i, { slot: i.queue ? ctx.sab.states.get(i.queue.downloadId) : undefined });
			return [i.key, i.queue ? { ...st, percent: Math.floor(percentFor(i.queue)) } : st];
		}));
		// The # column: a download's place among the shows still in the queue, whatever the table is sorted by.
		const place = new Map();
		for (const i of items) if (i.queue && ["downloading", "paused", "queued"].includes(status.get(i.key).kind)) place.set(i.key, place.size + 1);
		const score = (key, fmt) => (i, td) => { const sc = i.series.tvdbId && scoresOf(i.series), v = sc?.[key]; td.textContent = !sc ? "…" : v == null ? "–" : fmt(v); };

		// ui-kit's table; the actions stay in the first column (fixed slots), so they are a column, not the kit's trailing `actions`.
		const cells = {
			title: (item, td) => {
				const { series, queue: qi } = item;
				// The watchlist note's own link when there is one; otherwise just the title.
				const note = notes.find(n => lib.matchSeries(n, [series], state.ids));
				// Only what is on disk expands; a download is just its row until it has imported.
				if (qi) td.createSpan({ cls: "dl-chev" });
				else chevron(td, state.open.has(series.id), "Show the seasons on disk", () => toggleSeries(series));
				if (note?.url) td.createEl("a", { text: series.title, attr: { href: note.url, title: `${series.title} on Letterboxd` } }).addEventListener("click", openUrl(note.url));
				else td.createSpan({ text: series.title });
			},
			episodes: item => item.detail,
			date: item => item.date || "–",
			status: (item, td) => {
				const qi = item.queue, st = status.get(item.key);
				const why = qi
					? (qi.statusMessages ?? []).flatMap(m => m.messages ?? []).concat(qi.errorMessage ?? [], ctx.sab.paused && place.has(item.key) ? "SABnzbd's whole queue is paused" : []).join("\n")
					: "";
				td.classList.add("dl-st", `dl-st-${st.kind}`);
				if (why) td.title = why;
				td.textContent = st.label;
			},
			size: item => item.size ? base.formatSize(item.size) : "–",
			progress: (item, td) => {
				const { percent: pct, kind } = status.get(item.key);
				const prog = td.createDiv({ cls: "dl-prog" });
				if (pct == null) { prog.createDiv(); prog.createSpan({ cls: "dl-bar-label dl-bar-none", text: "–" }); return; }
				prog.createDiv({ cls: `dl-bar dl-bar-${kind}` }).createDiv({ cls: "dl-bar-fill" }).style.width = `${pct}%`;
				prog.createSpan({ cls: "dl-bar-label", text: `${pct}%` });
			},
			lb: score("lb", x => x.toFixed(2)),
			rt: score("rt", x => `${x}%`),
			// Last cell of the row: the kit has appended this row to the body already, so the on-disk tree rows go right after it.
			aud: (item, td) => { score("aud", x => `${x}%`)(item, td); if (!item.queue && state.open.has(item.series.id)) drawTree(td.parentElement.parentElement, item.series); },
		};
		const columns = [
			{ key: "act", title: "", cell: (item, td) => {
				const { series, queue: qi, group } = item;
				const slot = slotOf(item), st = status.get(item.key);
				// Always in the same order and the same slots: delete file(s), delete from Sonarr, pause/resume (downloads only).
				const act = td.createDiv({ cls: "dl-act" });
				const hasFiles = (series.statistics?.episodeFileCount ?? 0) > 0;
				const tips = qi
					? [["file", "Cancel this download"], ["all", `Cancel the download${hasFiles ? ", delete the files" : ""} and remove from Sonarr and the watchlist`]]
					: [["file", "Delete the files, keep in Sonarr (unmonitored)"], ["all", "Delete the files and remove from Sonarr and the watchlist"]];
				for (const [mode, tip] of tips) xButton(act, `${mode}:${item.key}`, tip, () => removeSeries(series, mode, group), mode === "file" ? "file" : "sonarr");
				if (place.has(item.key) && slot && ctx.sab.key && !ctx.sab.paused) {   // with the whole queue paused, resuming one job would do nothing
					const paused = st.kind === "paused";
					button(act, { icon: paused ? "play" : "pause", label: paused ? "Resume this download" : "Pause this download", variant: "icon", disabled: !!state.pausing, onClick: () => { togglePause(qi); } }).el.classList.add("dl-ib");
				}
			} },
			{ key: "pos", title: "#", className: "dl-num", cell: item => (place.has(item.key) ? String(place.get(item.key)) : "") },
			...ACTIVE_COLS.map(([key, label, num]) => ({ key, title: LOGOS[key] ? "" : label, className: [key === "title" ? "dl-cell-title" : "", num ? "dl-num" : ""].join(" ").trim(), cell: cells[key] })),
		];
		const t = table(sec, {
			className: "dl-table dl-active-table", columns,
			rows: lib.sortActive(items, sort.key, sort.dir, i => status.get(i.key), i => scoresOf(i.series)),
			rowData: item => (item.queue ? { dlQueue: item.group.key } : {}),
		});
		const cols = createEl("colgroup");
		for (const { key } of columns) cols.createEl("col", { cls: `dl-col-${key}` });
		t.el.prepend(cols);
		// Header cells: the kit writes the titles; the sort arrows, logos and click-to-sort are this table's own.
		const ths = t.el.tHead.rows[0].cells;
		ths[0].setAttribute("aria-label", "Actions");
		ths[1].title = "Place in the download queue";
		ACTIVE_COLS.forEach(([key, label, num, sortable], i) => {
			const th = ths[i + 2];
			if (sortable !== false) th.classList.add("dl-th");
			th.empty();
			if (LOGOS[key]) th.setAttribute("aria-label", label);
			const arrow = createSpan({ cls: "dl-arrow", text: sort.key === key ? (sort.dir === "asc" ? "▲" : "▼") : "" });
			const name = createSpan({ cls: "dl-th-label", text: label });
			if (LOGOS[key]) name.innerHTML = LOGOS[key];
			th.append(...(num ? [arrow, name] : [name, arrow]));   // the arrow sits away from the edge the column aligns to
			if (sortable === false) return;
			th.addEventListener("click", () => {
				state.activeSort = { key, dir: sort.key === key && sort.dir === "asc" ? "desc" : "asc" };
				ctx.save(KEYS.activeSort, state.activeSort);
				draw();
			});
		});
	}
	function chevron(parent, open, tip, run) {
		button(parent, { icon: open ? "chevron-down" : "chevron-right", label: open ? "Hide" : tip, variant: "icon", onClick: e => { e.stopPropagation(); run(); } }).el.classList.add("dl-chev");
	}
	// Under a series row: its seasons that have files, each expandable to its episodes on disk, each with a delete button
	// (files only; the episodes stay in Sonarr, unmonitored so they are not fetched again).
	function drawTree(body, series) {
		const tree = state.trees[series.id];
		const mk = cls => body.createEl("tr", { cls: `dl-row dl-tree ${cls}` });
		const cells = (row, { act, title, detail = "", size = "", watch }) => {
			const a = row.createEl("td").createDiv({ cls: "dl-act" });
			act?.(a);
			row.createEl("td", { cls: "dl-num" });
			const t = row.createEl("td", { cls: "dl-cell-title" });
			title(t);
			row.createEl("td", { text: detail });
			row.createEl("td"); row.createEl("td");
			row.createEl("td", { cls: "dl-num", text: size });
			const pw = row.createEl("td");
			watch?.(pw);
			for (let i = 0; i < 3; i++) row.createEl("td");
		};
		if (!tree) { cells(mk("dl-tree-note"), { title: t => loadingState(t) }); return; }
		if (!tree.seasons.length) { cells(mk("dl-tree-note"), { title: t => emptyState(t, "No episode files on disk.") }); return; }
		const count = n => `${n} episode${n === 1 ? "" : "s"}`;
		const pmap = plexEpisodes({ series });
		for (const s of tree.seasons) {
			const key = `${series.id}:${s.seasonNumber}`, open = state.openSeason.has(key);
			cells(mk("dl-tree-season"), {
				act: a => xButton(a, `season:${key}`, `Delete the files of ${seasonName(s.seasonNumber)} (${count(s.episodes.length)}), keep the show in Sonarr`, () => removeEpisodeFiles(series, s.episodes), "file"),
				title: t => { chevron(t, open, "Show the episodes on disk", () => { open ? state.openSeason.delete(key) : state.openSeason.add(key); draw(); }); t.createSpan({ text: seasonName(s.seasonNumber) }); },
				detail: count(s.episodes.length),
				watch: pmap ? w => { const n = s.episodes.filter(e => pmap.get(plex.epKey(e))?.watched).length; if (n) w.createSpan({ cls: `dl-watch ${n === s.episodes.length ? "dl-watch-done" : "dl-watch-part"}`, text: n === s.episodes.length ? "✓ Watched" : `${n}/${s.episodes.length} watched`, attr: { title: "Watched in Plex" } }); } : undefined,
				size: base.formatSize(s.size),
			});
			if (!open) continue;
			for (const e of s.episodes) {
				cells(mk("dl-tree-episode"), {
					act: a => xButton(a, `ep:${e.id}`, `Delete the file of ${epCode(e)}, keep the show in Sonarr`, () => removeEpisodeFiles(series, [e]), "file"),
					title: t => t.createSpan({ text: `${epCode(e)}  ${e.title}`, attr: { title: e.title } }),
					watch: w => watchMark(w, pmap, e),
					size: base.formatSize(e.size),
				});
			}
		}
	}
	// A delete button that confirms with a second click: the first click turns the x (or its icon) into a check, same
	// size so nothing shifts, the second runs it, and it disarms by itself after ARM_MS.
	const ARM_MS = 3000, ARM_GUARD_MS = 500;   // the second half of a double-click must not count as the confirming click
	function xButton(parent, key, tip, run, iconName) {
		const armed = state.armed === key;
		// aria-label only: Obsidian shows it as the tooltip, and a title too would add the browser's own.
		const b = button(parent, { icon: armed ? "check" : iconName ?? "x", label: armed ? "Click again to confirm" : tip, variant: "icon", disabled: !ctx.client || !!state.removing, onClick: () => {
			if (armed && Date.now() - armedAt < ARM_GUARD_MS) return;
			clearTimeout(armTimer);
			if (armed) { state.armed = null; run(); return; }
			state.armed = key;
			armedAt = Date.now();
			armTimer = setTimeout(() => { if (state.armed === key) { state.armed = null; draw(); } }, ARM_MS);
			draw();
		} }).el;
		b.classList.add("dl-x", "dl-ib");
		if (armed) b.classList.add("dl-x-armed");
	}

	Object.assign(ctx, { drawActive, chevron, drawTree, xButton, scoresOf });
}
