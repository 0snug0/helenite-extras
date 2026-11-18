import lib from "./lib.js";
import { POLL_MS } from "./consts.js";

// Part of the Downloadrr view; `c` is the context shared by every part (see view.js).
export function install(c) {
async function refreshRadarr() {
	if (!c.client) return;
	try {
		const [movies, queue, free] = await Promise.all([c.client.getMovies(), c.client.getQueue(), c.client.getFreeSpace().catch(() => null)]);
		c.state.movies = movies;
		c.state.free = free;
		c.state.queue = queue;
		c.state.error = null;
	} catch (e) {
		c.state.error = e.message;
	}
}


// Poll the queue every second. Progress is patched into the existing bars (the CSS width transition makes it
// glide); the table is only redrawn when a download starts, finishes or changes c.state, so nothing flickers or
// loses focus. Dataview runs this script again whenever the vault's index changes, without stopping the last run:
// a run whose c.root has left the page stops its own timers.
c.sortFocused = () => c.root.querySelector(".dl-sort") === document.activeElement;   // c.draw() would close an open dropdown
let polling = false, tick = 0, slotsSeen = "";
// SABnzbd knows the real percentage second by second; Radarr only syncs from it about once a minute.
async function refreshSab() {
	if (!c.sabKey || !c.requestUrl) return;
	try {
		const r = await c.requestUrl({ url: `${c.sabUrl}/c.api?mode=queue&output=json&apikey=${c.sabKey}`, throw: false });   // the placeholder must reach the host unencoded
		if (r.status >= 300) return;
		c.sabSlots = new Map((r.json?.queue?.slots ?? []).map(sl => [sl.nzo_id, sl]));
		c.sabQueuePaused = !!r.json?.queue?.paused;
		c.sabStates = lib.slotStates(r.json?.queue?.slots, c.sabQueuePaused);
	} catch (e) { /* keep the last values; Radarr's numbers still apply */ }
}
function isPaused(q) { return !!q && c.sabSlots.get(q.downloadId)?.status === "Paused"; }
async function togglePause(q) {
	if (c.state.pausing || !c.sabKey) return;
	c.state.pausing = q.downloadId;
	c.draw();
	try {
		const mode = isPaused(q) ? "resume" : "pause";
		await c.requestUrl({ url: `${c.sabUrl}/c.api?mode=queue&name=${mode}&value=${encodeURIComponent(q.downloadId)}&output=json&apikey=${c.sabKey}`, throw: false });
		await c.refreshSab();
	} catch (e) { c.state.error = `Could not reach SABnzbd: ${e.message}`; }
	finally { c.state.pausing = null; }
	c.draw();
}
function percentFor(q) {
	const sl = c.sabSlots.get(q.downloadId);
	const mb = sl && parseFloat(sl.mb), left = sl && parseFloat(sl.mbleft);
	if (mb > 0 && left >= 0) return Math.min(100, Math.max(0, (1 - left / mb) * 100));
	return lib.movieStatus(null, q).percent;
}
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
	if (!c.root.isConnected) { clearInterval(timer); return; }
	if (polling || !c.client || document.hidden || c.state.loading) return;
	polling = true;
	try {
		await c.refreshSab();
		// SABnzbd lists its slots in queue order: a change here is a job paused, resumed, started or moved (also from
		// SABnzbd's own UI). Only marked as seen once drawn, so a redraw skipped for an open dropdown still happens.
		const slotsNow = `${c.sabQueuePaused}|` + [...sabSlots.values()].map(sl => `${sl.nzo_id}:${sl.status === "Paused" ? "p" : ""}`).join();
		if (slotsNow !== slotsSeen && !c.sortFocused() && !c.state.pausing) { slotsSeen = slotsNow; c.draw(); }
		// Radarr's queue (which films are downloading) every third tick, or at once if SAB shows a job Radarr has not listed.
		const unknown = [...sabSlots.keys()].some(id => !c.state.queue.some(q => q.downloadId === id));
		if (!c.sabKey || unknown || tick++ % 3 === 0) {
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
	if (!c.root.isConnected) { clearInterval(plexTimer); return; }
	await c.refreshPlex();
	if (!c.sortFocused()) c.draw();
}, 15000);
c.component.register(() => clearInterval(plexTimer));

Object.assign(c, { refreshRadarr, refreshSab, togglePause, percentFor });
}
