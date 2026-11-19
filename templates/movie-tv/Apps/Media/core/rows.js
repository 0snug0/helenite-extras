// Row status and streaming-service filter shared by the Movies and TV pages (identical in Downloadrr and Downloadrr TV).
// Lifted unchanged from Downloadrr/lib.js (DownloadrrTV/base.js is a byte copy of it). Pure: no DOM, no network.

// What the Status column says about a row. A download: its slotStates entry when SABnzbd has it (that knows a job
// is paused or waiting its turn), else Radarr's; a finished download Radarr will not import stays listed as blocked.
// A file: its Plex watch state. percent is the download's, or how far into the film Plex is.
export function rowStatus(item, { slot, watch } = {}) {
	const q = item.queue;
	if (!q) {
		if (!watch) return { kind: "downloaded", label: "Downloaded", percent: null };
		const kind = watch.kind === "watching" && watch.paused ? "started" : watch.kind;   // paused in Plex: begun, not being watched
		const label = { unwatched: "Not started", started: "Started", watching: "Watching", watched: "Watched" }[kind];
		return { kind, label, percent: kind === "started" || kind === "watching" ? watch.percent : null };
	}
	const percent = item.status.percent, tracked = q.trackedDownloadState;
	if (q.status === "failed" || tracked === "failed" || tracked === "failedPending") return { kind: "failed", label: "Failed", percent };
	if (q.status === "completed" || ["importBlocked", "importPending", "importing", "imported"].includes(tracked)) {
		return tracked === "importBlocked" || q.trackedDownloadStatus === "warning" ? { kind: "blocked", label: "Import blocked", percent } : { kind: "importing", label: "Importing", percent };
	}
	const s = String(slot ?? q.status ?? "").toLowerCase();
	if (s === "paused") return { kind: "paused", label: "Paused", percent };
	if (s === "queued") return { kind: "queued", label: "Queued", percent };
	return { kind: "downloading", label: "Downloading", percent };
}

// Streaming services the user subscribes to; ids are the short names availability() puts in `on`.
export const SERVICES = [["Netflix", "Netflix"], ["HBO", "HBO"], ["Apple", "Apple TV"], ["Prime", "Amazon"]];
// True when the film streams on at least one of the selected services (none selected = no filter).
export function matchesServices(avail, selected) {
	if (!selected?.length) return true;
	return avail?.kind === "stream" && (avail.on ?? []).some(s => selected.includes(s));
}
