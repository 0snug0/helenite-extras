import lib from "./lib.js";
import { LOGOS, ACTIVE_SORT_KEY } from "./consts.js";
import { formatSize } from "../../core/releases.js";
import { activeColumns, activeSection } from "../../core/active-table.js";
import { progressBar } from "../../core/progress.js";
import { STATUS_TONES } from "../../core/tones.js";
import { button, statusText, table } from "../../core/ui-kit.js";

// Part of the Movies page; `c` is the context shared by every part (see index.js).
export function install(c) {
// Top section: every download in the queue (numbered in SABnzbd's order) and every file on disk, in one table
// sortable by column. Nothing in it may move when a row changes c.state: the columns have fixed widths, every button
// is the same square in a fixed slot, and each sortable header keeps room for its arrow.
// [sort key, label, right-aligned number column]
const ACTIVE_COLS = [["title", "Movie"], ["year", "Year"], ["date", "DL date"], ["status", "Status"], ["size", "Size", true], ["progress", "Progress"], ["lb", "Letterboxd rating", true], ["rt", "Rotten Tomatoes critics", true], ["aud", "Rotten Tomatoes audience", true]];
const queuePosition = q => c.sabSlots.get(q.downloadId)?.index ?? null;
function drawActive(parent) {
	const items = lib.activeMovies(c.state.movies, c.state.queue, queuePosition);
	if (!items.length) return;
	const sort = c.state.activeSort;
	const total = items.reduce((n, i) => n + (i.queue ? 0 : i.size), 0);   // what is on disk; a download's size is not there yet
	const sec = activeSection(parent, { count: items.length, total, free: c.state.free, service: "Radarr" });

	const slotOf = i => i.queue && c.sabSlots.get(i.queue.downloadId);
	const watchOf = i => i.movie.tmdbId && c.state.plex[i.movie.tmdbId] || undefined;
	// A download's percent is SABnzbd's live one, so sorting by Status or Progress agrees with the bar.
	const status = new Map(items.map(i => {
		const st = lib.rowStatus(i, { slot: i.queue ? c.sabStates.get(i.queue.downloadId) : undefined, watch: watchOf(i) });
		return [i.key, i.queue ? { ...st, percent: Math.floor(c.percentFor(i.queue)) } : st];
	}));
	// The # column: a download's place among the films still in the queue, whatever the table is sorted by.
	const place = new Map();
	for (const i of items) if (i.queue && ["downloading", "paused", "queued"].includes(status.get(i.key).kind)) place.set(i.key, place.size + 1);
	const scoresOf = i => i.movie.tmdbId && c.scoresFor(i.movie.tmdbId);
	const score = f => (i, td) => { const sc = scoresOf(i), v = sc?.[f.key]; td.textContent = !sc ? "…" : v == null ? "–" : f.fmt(v); };

	// ui-kit's table; the actions stay in the first column (fixed slots), so they are a column, not the kit's trailing `actions`.
	const cells = {
		title: (item, td) => {
			const { movie } = item;
			// The watchlist note's own link when there is one; otherwise Letterboxd's TMDB redirect.
			const lb = c.notes.find(n => n.tmdbId === movie.tmdbId && n.url)?.url ?? (movie.tmdbId ? `https://letterboxd.com/tmdb/${movie.tmdbId}/` : null);
			if (lb) button(td, { text: movie.title, variant: "link", onClick: c.openUrl(lb) }).el.title = `${movie.title} on Letterboxd`;
			else td.setText(movie.title);
		},
		year: item => String(item.movie.year ?? ""),
		date: item => item.date || "–",
		status: (item, td) => {
			const qi = item.queue, st = status.get(item.key), pw = watchOf(item), inQueue = place.has(item.key);
			const why = qi
				? (qi.statusMessages ?? []).flatMap(m => m.messages ?? []).concat(qi.errorMessage ?? [], c.sabQueuePaused && inQueue ? "SABnzbd's whole queue is paused" : []).join("\n")
				: pw ? (pw.paused ? "Paused in Plex" : "From Plex") : c.plexSet ? "Not in Plex yet" : "Set the Plex token in Settings";
			td.classList.add("dl-st", `dl-st-${st.kind}`);
			if (why) td.title = why;
			statusText(td, st.label, STATUS_TONES[st.kind]);
		},
		size: item => item.size ? formatSize(item.size) : "–",
		progress: (item, td) => { const st = status.get(item.key); progressBar(td, st.percent, st.kind); },
		lb: score({ key: "lb", fmt: x => x.toFixed(2) }),
		rt: score({ key: "rt", fmt: x => `${x}%` }),
		aud: score({ key: "aud", fmt: x => `${x}%` }),
	};
	cells.act = (item, td) => {
		const { movie, queue: qi } = item;
		const slot = slotOf(item), st = status.get(item.key);
		// Always in the same order and the same slots: delete file, delete from Radarr, pause/resume (downloads only).
		const act = td.createDiv({ cls: "hel-table-buttons" });
		const tips = qi
			? [["file", "Cancel this download"], ["all", `Cancel the download${movie.hasFile ? ", delete the file" : ""} and remove from Radarr and the watchlist`]]
			: [["file", "Delete the file, keep in Radarr (unmonitored)"], ["all", "Delete the file and remove from Radarr and the watchlist"]];
		for (const [mode, tip] of tips) c.xButton(act, `${mode}:${item.key}`, tip, () => c.removeMovie(movie, mode, qi), mode === "file" ? "file" : "radarr");
		if (place.has(item.key) && slot && c.sabSet && !c.sabQueuePaused) {   // with the whole queue paused, resuming one job would do nothing
			const paused = st.kind === "paused";
			button(act, { icon: paused ? "play" : "pause", label: paused ? "Resume this download" : "Pause this download", variant: "icon", disabled: !!c.state.pausing, onClick: () => { c.togglePause(qi); } });
		}
	};
	cells.pos = item => (place.has(item.key) ? String(place.get(item.key)) : "");
	table(sec, {
		className: "dl-table dl-active-table", fixed: true, minWidth: "1100px",
		columns: activeColumns({ cols: ACTIVE_COLS, logos: LOGOS, cells }),
		rows: lib.sortActive(items, sort.key, sort.dir, c.mergedScores(), i => status.get(i.key)),
		rowData: item => (item.queue ? { dlQueue: String(item.queue.id) } : {}),
		sort,
		onSort: key => {
			c.state.activeSort = { key, dir: sort.key === key && sort.dir === "asc" ? "desc" : "asc" };
			c.save(ACTIVE_SORT_KEY, c.state.activeSort);
			c.draw();
		},
	});
}

// A delete button that confirms with a second click: the first click turns the x (or its icon) into a check, same
// size so nothing shifts, the second runs it, and it disarms by itself after ARM_MS.
const ARM_MS = 3000, ARM_GUARD_MS = 500;   // the second half of a double-click must not count as the confirming click
function xButton(parent, key, tip, run, iconName) {
	const armed = c.state.armed === key;
	// aria-label only: Obsidian shows it as the tooltip, and a title too would add the browser's own.
	button(parent, { icon: armed ? "check" : iconName ?? "x", label: armed ? "Click again to confirm" : tip, variant: "icon", armed, disabled: !c.client || !!c.state.removing, onClick: () => {
		if (armed && Date.now() - armedAt < ARM_GUARD_MS) return;
		clearTimeout(armTimer);
		if (armed) { c.state.armed = null; run(); return; }
		c.state.armed = key;
		armedAt = Date.now();
		armTimer = setTimeout(() => { if (c.state.armed === key) { c.state.armed = null; c.draw(); } }, ARM_MS);
		c.draw();
	} }).el.classList.add("dl-x");
}
let armTimer, armedAt = 0;
c.component.register(() => clearTimeout(armTimer));

Object.assign(c, { drawActive, xButton });
}
