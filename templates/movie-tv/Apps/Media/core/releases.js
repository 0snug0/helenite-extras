// Release picker pieces shared by the Movies and TV pages: the pure helpers and the sortable release table.
// Helpers are lifted from Downloadrr/lib.js (DownloadrrTV/base.js is a byte copy of it). renderReleaseTable is the table of
// Downloadrr/releases.js and DownloadrrTV/panels.js releaseTable, which differ only in an extra "Episodes" column on TV, the
// service's name in two tooltips, and what Select/Confirm do: those are options. Needs createDiv/createEl (host helpers).
import { button, emptyState, statusText, table, textInput, toolbar } from "./ui-kit.js";

export function formatSize(bytes) {
	if (!(bytes > 0)) return "–";
	return bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.round(bytes / 1e6)} MB`;
}

export function formatAge(hours) {
	if (!(hours >= 0)) return "–";
	if (hours < 48) return `${Math.max(1, Math.round(hours))}h`;
	const days = hours / 24;
	if (days < 60) return `${Math.round(days)}d`;
	if (days < 730) return `${Math.round(days / 30.44)}mo`;
	return `${Math.round(days / 365.25)}y`;
}

export const resolutionLabel = res => (res > 0 ? `${res}p` : "?");

// Full-disc Blu-ray releases (an .iso or a BDMV folder) don't play in Plex, so they are never grabbable.
export const DISC_TITLE = /\b(complete[ ._-]?(uhd[ ._-]?)?blu-?ray|bdmv|bd25|bd50|bd66|bd100|iso)\b/i;

export function isDiscImage(r) {
	return r.quality?.quality?.name === "BR-DISK" || DISC_TITLE.test(r.title ?? "");
}

export function normalizeRelease(r) {
	const q = r.quality?.quality ?? {};
	const disc = isDiscImage(r);
	const reasons = (r.rejections ?? []).map(x => (typeof x === "string" ? x : x?.reason)).filter(Boolean);
	if (disc) reasons.unshift("Disc image (ISO/BR-DISK): Plex can't play it");
	return {
		guid: r.guid,
		indexerId: r.indexerId,
		title: r.title ?? "",
		resolution: q.resolution ?? 0,
		qualityName: q.name ?? "",
		size: r.size ?? 0,
		ageHours: r.ageHours ?? (r.age ?? 0) * 24,
		rejected: disc || !!r.rejected,
		reasons,
		allowed: !disc && r.downloadAllowed !== false,
		indexer: r.indexer ?? "",
	};
}

// `extra` adds sort keys of a page's own: { type: r => ... } (the TV page sorts by season/episode range).
export function sortReleases(list, key = "resolution", dir = "desc", extra = {}) {
	const value = {
		title: r => r.title.toLowerCase(),
		resolution: r => r.resolution,
		size: r => r.size,
		age: r => r.ageHours,
		...extra,
	}[key] ?? (r => r.resolution);
	const sign = dir === "asc" ? 1 : -1;
	return [...list].sort((a, b) => {
		const x = value(a), y = value(b);
		if (x !== y) return (x < y ? -1 : 1) * sign;
		if (a.ageHours !== b.ageHours) return a.ageHours - b.ageHours;
		return a.title.localeCompare(b.title);
	});
}

// Ctrl+F in the release picker: every word must appear in the release name or its quality label.
export function filterReleases(list, query) {
	const words = String(query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
	if (!words.length) return list;
	return list.filter(r => { const hay = `${r.title} ${r.qualityName}`.toLowerCase(); return words.every(w => hay.includes(w)); });
}


// The release table of a picker panel: the find bar, the empty states and the sortable table. Appends to `el`.
//   p                the panel state: { releases, sortKey, sortDir, confirm, notice, findOpen, find }
//   releases         the normalized releases to show (p.releases, or the ones of the open scope)
//   state            { grabbing, sent: Set } of the page
//   service          "Radarr" | "Sonarr": named in the tooltip of a release the service will not download
//   extraColumn      optional { key, label, cell(r) } shown after the title (TV: the episodes a release covers)
//   sortExtra        extra sort keys for sortReleases (TV: { type })
//   onGrab(r)        Confirm was clicked      onSelect(r)  Select was clicked (the page sets p.confirm and redraws)
//   draw / redrawModal   redraw the page / just the modal      saveSort({ key, dir })  persist the chosen sort
export function renderReleaseTable(el, { p, releases, state, service, extraColumn, sortExtra, onGrab, draw, redrawModal, saveSort }) {
	const sorted = filterReleases(sortReleases(releases, p.sortKey, p.sortDir, sortExtra), p.findOpen ? p.find : "");
	if (p.findOpen) {
		const bar = toolbar(el);
		const input = textInput(bar, { placeholder: "Search releases…", label: "Search releases", value: p.find ?? "", onInput: v => { p.find = v; redrawModal(); } });
		input.classList.add("dl-find-input");
		input.spellcheck = false;
		statusText(bar, `${sorted.length} of ${releases.length}`).classList.add("dl-find-count");
	}
	if (!sorted.length) emptyState(el, "No releases match.");

	const why = r => (r.rejected ? (r.reasons[0] ?? `Rejected by ${service}`) : null);
	const sortable = col => ({ ...col, sortable: true, className: [col.className, "dl-th"].filter(Boolean).join(" ") });
	const t = table(el, {
		className: "dl-table",
		sort: { key: p.sortKey, dir: p.sortDir },
		onSort: key => {
			p.sortDir = p.sortKey === key && p.sortDir === "desc" ? "asc" : "desc";
			p.sortKey = key;
			saveSort({ key: p.sortKey, dir: p.sortDir });
			draw();
		},
		rowMuted: r => !!why(r),
		columns: [
			sortable({ key: "title", title: "Release", truncate: true, cell: (r, td) => {
				const w = why(r);
				if (w) td.parentElement.title = w;
				td.title = w ? `${r.title}\n${w}` : r.title;
				return r.title;
			} }),
			...(extraColumn ? [sortable({ key: extraColumn.key, title: extraColumn.label, cell: extraColumn.cell })] : []),
			sortable({ key: "resolution", title: "Resolution", cell: (r, td) => { td.title = why(r) ? `${r.qualityName}\n${why(r)}` : r.qualityName; return resolutionLabel(r.resolution); } }),
			sortable({ key: "size", title: "Size", cell: r => formatSize(r.size) }),
			sortable({ key: "age", title: "Age", cell: r => formatAge(r.ageHours) }),
		],
		rows: sorted,
		actions: (r, cell) => {
			if (p.confirm === r.guid) button(cell, { text: state.grabbing === r.guid ? "Sending…" : "Confirm", variant: "primary", disabled: !!state.grabbing, onClick: () => onGrab(r) });
			else if (state.sent.has(r.guid)) statusText(cell, "Sent", "success").classList.add("dl-sent");
			else {
				const pick = button(cell, { text: "Select", disabled: !r.allowed || !!state.grabbing, onClick: () => { p.confirm = r.guid; p.notice = null; draw(); } });
				if (!r.allowed) pick.el.title = `${service} will not download this release`;
			}
		},
	});
	return t;
}
