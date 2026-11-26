import { setProgress } from "../../core/progress.js";
import lib from "./lib.js";
import { isPaused as sabIsPaused, percentFor as sabPercentFor } from "../../core/sabnzbd.js";

// Part of the TV page: SABnzbd state and the once-a-second poll. `c` is the context shared by every part (see index.js).
// Sonarr's own calls are in actions.js; SABnzbd goes through the shared core client (c.sab).
export function install(c) {
const { state, root } = c;
c.sortFocused = () => root.querySelector(".dl-sort") === document.activeElement;   // draw() would close an open dropdown
// SABnzbd knows the real percentage second by second; Sonarr only syncs from it about once a minute.
async function refreshSab() {
	const q = await c.sab.queue();   // null: no key, HTTP error or unreachable; keep the last values, Sonarr's numbers still apply
	if (!q) return;
	c.sabSlots = q.slots;
	c.sabQueuePaused = q.paused;
	c.sabStates = q.states;
}
const isPaused = q => sabIsPaused(c.sabSlots, q);
async function togglePause(q) {
	if (state.pausing || !c.sabSet) return;
	state.pausing = q.downloadId;
	c.draw();
	try {
		await c.sab.setPaused(q.downloadId, isPaused(q) ? "resume" : "pause");
		await c.refreshSab();
	} catch (e) { state.error = `Could not reach SABnzbd: ${e.message}`; }
	finally { state.pausing = null; }
	c.draw();
}
const percentFor = q => sabPercentFor(c.sabSlots, q, lib.percentOf);
function patchProgress() {
	for (const g of lib.groupQueue(state.queue)) {
		const row = [...root.querySelectorAll("[data-dl-queue]")].find(r => r.dataset.dlQueue === g.key);
		if (!row) continue;
		const pct = percentFor(g.records[0]);
		setProgress(row, pct);
	}
}
// Poll the queue every second. Progress is patched into the existing bars (the CSS width transition makes it glide); the page
// is only redrawn when a download starts, finishes or changes state, so nothing flickers or loses focus. The timer is
// cleared when the page is disposed.
function startPolling(ms) {
	let polling = false, tick = 0, slotsSeen = "";
	const timer = setInterval(async () => {
		// A page the shell has hidden (another tab of the app is showing) keeps its state but stops polling.
		if (polling || !c.client || document.hidden || state.loading || root.closest("[hidden]")) return;
		polling = true;
		try {
			await refreshSab();
			// SABnzbd lists its slots in queue order: a change here is a job paused, resumed, started or moved (also from
			// SABnzbd's own UI). Only marked as seen once drawn, so a redraw skipped for an open dropdown still happens.
			const slotsNow = `${c.sabQueuePaused}|` + [...c.sabSlots.values()].map(sl => `${sl.nzo_id}:${sl.status === "Paused" ? "p" : ""}`).join();
			if (slotsNow !== slotsSeen && !c.sortFocused() && !state.pausing) { slotsSeen = slotsNow; c.draw(); }
			// Sonarr's queue (which shows are downloading) every third tick, or at once if SAB shows a job Sonarr has not listed.
			const unknown = [...c.sabSlots.keys()].some(id => !state.queue.some(q => q.downloadId === id));
			if (!c.sabSet || unknown || tick++ % 3 === 0) {
				const queue = await c.client.getQueue();
				const ids = q => q.map(x => `${x.id}:${x.status}:${x.trackedDownloadState}:${x.trackedDownloadStatus}`).sort().join();
				const changed = ids(queue) !== ids(state.queue) || queue.some(q => !state.series.some(s => s.id === q.seriesId));
				state.queue = queue;
				if (changed) { await c.refreshSonarr(); if (!c.sortFocused()) c.draw(); return; }   // download started or finished: files changed too
			}
			patchProgress();
		} catch (e) { /* Sonarr briefly unreachable: try again next tick */ }
		finally { polling = false; }
	}, ms);
	c.component.register(() => clearInterval(timer));
}

Object.assign(c, { startPolling, refreshSab, isPaused, togglePause, percentFor, patchProgress });
}
