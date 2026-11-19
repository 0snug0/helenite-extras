// SABnzbd client and queue helpers shared by the Movies and TV pages.
// Lifted from Downloadrr/services.js (refreshSab, togglePause, percentFor, isPaused) and DownloadrrTV/polling.js (the same
// code, using ctx.sab) plus lib.slotStates (identical in both libs). The pages keep their own polling loop and drawing.
//
// `key` is the host placeholder {{secret:SABNZBD_API_KEY}}: it must reach the host unencoded (the host encodes the value).
// `enabled` is an async () => boolean (the secret is set); without a key every call that reads the queue answers null.
//
// Note: Downloadrr's copy built its URLs as `${sabUrl}/c.api?mode=...` (a search-and-replace of `api` by `c.api` hit the
// string). SABnzbd's endpoint is `/api`, as in the TV copy, so that is what this uses.

const fix = u => String(u ?? "").replace(/\/+$/, "");

// Which SABnzbd job is really downloading. SABnzbd calls every slot that is not paused "Downloading" while it runs
// (and "Queued" only when the whole queue is paused), so it has to be worked out: the first job in the queue that
// is not paused downloads, the rest wait. slots: SABnzbd's. -> Map nzo_id -> "Paused" | "Downloading" | "Queued".
export function slotStates(slots, queuePaused = false) {
	const out = new Map();
	let active = false;
	for (const sl of [...(slots ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0))) {
		if (queuePaused || sl.status === "Paused") out.set(sl.nzo_id, "Paused");
		else { out.set(sl.nzo_id, active ? "Queued" : "Downloading"); active = true; }
	}
	return out;
}

// slots: Map nzo_id -> slot, as queue() returns it. q: an *arr queue record (its downloadId is the nzo_id).
export function isPaused(slots, q) { return !!q && slots.get(q.downloadId)?.status === "Paused"; }

// SABnzbd knows the real percentage second by second; the *arr only syncs from it about once a minute.
// `fallback(q)` is the *arr's own percentage (it differs per page: a film's size, a show's grouped records).
export function percentFor(slots, q, fallback) {
	const sl = slots.get(q.downloadId);
	const mb = sl && parseFloat(sl.mb), left = sl && parseFloat(sl.mbleft);
	if (mb > 0 && left >= 0) return Math.min(100, Math.max(0, (1 - left / mb) * 100));
	return fallback(q);
}

export function createSab({ url, key, request, enabled = async () => true }) {
	const base = fix(url);
	return {
		url: base,
		isSet: enabled,
		// { slots: Map nzo_id -> slot, paused, states: slotStates } or null when there is nothing new to show (no key, HTTP
		// error, unreachable): callers keep the last values, the *arr's numbers still apply.
		async queue() {
			if (!(await enabled())) return null;
			try {
				const r = await request({ url: `${base}/api?mode=queue&output=json&apikey=${key}`, throw: false });
				if (r.status >= 300) return null;
				const slots = r.json?.queue?.slots ?? [], paused = !!r.json?.queue?.paused;
				return { slots: new Map(slots.map(sl => [sl.nzo_id, sl])), paused, states: slotStates(slots, paused) };
			} catch (e) { return null; }
		},
		// mode: "pause" | "resume". Network errors propagate (the page says "Could not reach SABnzbd").
		async setPaused(nzoId, mode) {
			if (!(await enabled())) throw new Error("SABnzbd is not configured");
			return request({ url: `${base}/api?mode=queue&name=${mode}&value=${encodeURIComponent(nzoId)}&output=json&apikey=${key}`, throw: false });
		},
	};
}
