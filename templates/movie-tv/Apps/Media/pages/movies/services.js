import lib from "./lib.js";
import { POLL_MS } from "./consts.js";
import { isPaused as sabIsPaused, percentFor as sabPercentFor } from "../../core/sabnzbd.js";

// Part of the Movies page; `c` is the context shared by every part (see index.js).
// Radarr's own calls live here; SABnzbd goes through the shared core client (c.sab).
export function install(c) {
async function refreshRadarr() {
	if (!c.client) return;
	try {
		const [movies, queue, free] = await Promise.all([c.client.getMovies(), c.client.getQueue(), c.client.getFreeSpace().catch(() => null)]);
		c.state.movies = movies;
		c.state.free = free;
		c.state.queue = queue;
		c.state.error = null;
		c.ctx.setStatus?.("radarr", "ok");
	} catch (e) {
		c.state.error = e.message;
		c.ctx.setStatus?.("radarr", "down");
	}
}

// Poll the queue every second. Progress is patched into the existing bars (the CSS width transition makes it
// glide); the table is only redrawn when a download starts, finishes or changes c.state, so nothing flickers or
// loses focus. The timers are cleared when the page is disposed.
c.sortFocused = () => c.root.querySelector(".dl-sort") === document.activeElement;   // c.draw() would close an open dropdown
let polling = false, tick = 0, slotsSeen = "";
// SABnzbd knows the real percentage second by second; Radarr only syncs from it about once a minute.
async function refreshSab() {
	const q = await c.sab.queue();   // null: no key, HTTP error or unreachable; keep the last values, Radarr's numbers still apply
	if (!q) return;
	c.sabSlots = q.slots;
	c.sabQueuePaused = q.paused;
	c.sabStates = q.states;
}
const isPaused = q => sabIsPaused(c.sabSlots, q);
async function togglePause(q) {
	if (c.state.pausing || !c.sabSet) return;
	c.state.pausing = q.downloadId;
	c.draw();
	try {
		await c.sab.setPaused(q.downloadId, isPaused(q) ? "resume" : "pause");
		await c.refreshSab();
	} catch (e) { c.state.error = `Could not reach SABnzbd: ${e.message}`; }
	finally { c.state.pausing = null; }
	c.draw();
}
const percentFor = q => sabPercentFor(c.sabSlots, q, x => lib.movieStatus(null, x).percent);
function patchProgress() {
	for (const q of c.state.queue) {
		const row = c.root.querySelector(`[data-dl-queue="${q.id}"]`);
		if (!row) continue;
		const pct = c.percentFor(q);
		row.querySelector(".dl-bar-fill").style.width = `${pct}%`;
		row.querySelector(".dl-bar-label").setText(`${Math.floor(pct)}%`);
	}
}
const timer = setInterval(async () => {
	// A page the shell has hidden (another tab of the app is showing) keeps its state but stops polling.
	if (polling || !c.client || document.hidden || c.state.loading || c.root.closest("[hidden]")) return;
	polling = true;
	try {
		await c.refreshSab();
		// SABnzbd lists its slots in queue order: a change here is a job paused, resumed, started or moved (also from
		// SABnzbd's own UI). Only marked as seen once drawn, so a redraw skipped for an open dropdown still happens.
		const slotsNow = `${c.sabQueuePaused}|` + [...c.sabSlots.values()].map(sl => `${sl.nzo_id}:${sl.status === "Paused" ? "p" : ""}`).join();
		if (slotsNow !== slotsSeen && !c.sortFocused() && !c.state.pausing) { slotsSeen = slotsNow; c.draw(); }
		// Radarr's queue (which films are downloading) every third tick, or at once if SAB shows a job Radarr has not listed.
		const unknown = [...c.sabSlots.keys()].some(id => !c.state.queue.some(q => q.downloadId === id));
		if (!c.sabSet || unknown || tick++ % 3 === 0) {
			const queue = await c.client.getQueue();
			const ids = q => q.map(x => `${x.id}:${x.status}:${x.trackedDownloadState}:${x.trackedDownloadStatus}`).sort().join();   // a second download of a film is its own row
			const changed = ids(queue) !== ids(c.state.queue) || queue.some(q => !c.state.movies.some(m => m.id === q.movieId));
			c.state.queue = queue;
			if (changed) { await c.refreshRadarr(); if (!c.sortFocused()) c.draw(); return; }   // download started or finished: files changed too
		}
		patchProgress();
	} catch (e) { /* Radarr briefly unreachable: try again next tick */ }
	finally { polling = false; }
}, POLL_MS);
c.component.register(() => clearInterval(timer));
const plexTimer = setInterval(async () => {
	if (c.root.closest("[hidden]")) return;
	await c.refreshPlex();
	if (!c.sortFocused()) c.draw();
}, 15000);
c.component.register(() => clearInterval(plexTimer));

Object.assign(c, { refreshRadarr, refreshSab, togglePause, percentFor });
}
