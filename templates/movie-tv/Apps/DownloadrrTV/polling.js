// Downloadrr TV: polling. Ported from the vault's downloadrr_tv/view.js; `ctx` is the shared view context built in view.js.

export function install(ctx) {
	const { state, api, base, lib, root } = ctx;
	const requestUrl = api.net.fetch;
	const draw = (...a) => ctx.draw(...a);
	const refreshSonarr = (...a) => ctx.refreshSonarr(...a);
	const sortFocused = () => root.querySelector(".dl-sort") === document.activeElement;   // draw() would close an open dropdown
	// SABnzbd knows the real percentage second by second; Sonarr only syncs from it about once a minute.
	async function refreshSab() {
		if (!ctx.sab.key || !requestUrl) return;
		try {
			const r = await requestUrl({ url: `${ctx.sab.url}/api?mode=queue&output=json&apikey=${ctx.sab.key}`, throw: false });
			if (r.status >= 300) return;
			ctx.sab.slots = new Map((r.json?.queue?.slots ?? []).map(sl => [sl.nzo_id, sl]));
			ctx.sab.paused = !!r.json?.queue?.paused;
			ctx.sab.states = base.slotStates(r.json?.queue?.slots, ctx.sab.paused);
		} catch (e) { /* keep the last values; Sonarr's numbers still apply */ }
	}
	function isPaused(q) { return !!q && ctx.sab.slots.get(q.downloadId)?.status === "Paused"; }
	async function togglePause(q) {
		if (state.pausing || !ctx.sab.key) return;
		state.pausing = q.downloadId;
		draw();
		try {
			const mode = isPaused(q) ? "resume" : "pause";
			await requestUrl({ url: `${ctx.sab.url}/api?mode=queue&name=${mode}&value=${encodeURIComponent(q.downloadId)}&output=json&apikey=${ctx.sab.key}`, throw: false });
			await refreshSab();
		} catch (e) { state.error = `Could not reach SABnzbd: ${e.message}`; }
		finally { state.pausing = null; }
		draw();
	}
	function percentFor(q) {
		const sl = ctx.sab.slots.get(q.downloadId);
		const mb = sl && parseFloat(sl.mb), left = sl && parseFloat(sl.mbleft);
		if (mb > 0 && left >= 0) return Math.min(100, Math.max(0, (1 - left / mb) * 100));
		return lib.percentOf(q);
	}
	function patchProgress() {
		for (const g of lib.groupQueue(state.queue)) {
			const row = [...root.querySelectorAll("[data-dl-queue]")].find(r => r.dataset.dlQueue === g.key);
			if (!row) continue;
			const pct = percentFor(g.records[0]);
			row.querySelector(".dl-bar-fill").style.width = `${pct}%`;
			row.querySelector(".dl-bar-label").setText(`${Math.floor(pct)}%`);
		}
	}
	function startPolling(ms) {
	const timer = setInterval(async () => {
		if (!root.isConnected) { clearInterval(timer); return; }
		if (polling || !ctx.client || document.hidden || state.loading) return;
		polling = true;
		try {
			await refreshSab();
			// SABnzbd lists its slots in queue order: a change here is a job paused, resumed, started or moved (also from
			// SABnzbd's own UI). Only marked as seen once drawn, so a redraw skipped for an open dropdown still happens.
			const slotsNow = `${ctx.sab.paused}|` + [...ctx.sab.slots.values()].map(sl => `${sl.nzo_id}:${sl.status === "Paused" ? "p" : ""}`).join();
			if (slotsNow !== slotsSeen && !sortFocused() && !state.pausing) { slotsSeen = slotsNow; draw(); }
			// Sonarr's queue (which shows are downloading) every third tick, or at once if SAB shows a job Sonarr has not listed.
			const unknown = [...ctx.sab.slots.keys()].some(id => !state.queue.some(q => q.downloadId === id));
			if (!ctx.sab.key || unknown || tick++ % 3 === 0) {
				const queue = await ctx.client.getQueue();
				const ids = q => q.map(x => `${x.id}:${x.status}:${x.trackedDownloadState}:${x.trackedDownloadStatus}`).sort().join();
				const changed = ids(queue) !== ids(state.queue) || queue.some(q => !state.series.some(s => s.id === q.seriesId));
				state.queue = queue;
				if (changed) { await refreshSonarr(); if (!sortFocused()) draw(); return; }   // download started or finished: files changed too
			}
			patchProgress();
		} catch (e) { /* Sonarr briefly unreachable: try again next tick */ }
		finally { polling = false; }
	}, ms);
	ctx.register(() => clearInterval(timer));
	}

	Object.assign(ctx, { startPolling, sortFocused, refreshSab, isPaused, togglePause, percentFor, patchProgress });
}
