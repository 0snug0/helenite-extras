// The TV half of the home page, drawn from 99_Internal/Data/tv-home.json (Templates/Scripts/tv_home.py, hourly after the Serializd sync).
// Usage: await dv.view("99_Internal/Views/tv-home", { part: "upnext" })   // next episode of each show being watched + the week ahead
//        await dv.view("99_Internal/Views/tv-home", { part: "recs" })     // recommended shows, with an x to never suggest one again
//        await dv.view("99_Internal/Views/tv-home", { part: "new" })      // followed shows returning, new and coming premieres
const DATA = "99_Internal/Data/tv-home.json";
const BLOCKED = "99_Internal/Data/tv-recs-blocked.json";   // read by tv_home.py; "x" appends here
const { DateTime } = dv.luxon;
const part = input?.part ?? "upnext";
const root = dv.container.createDiv({ cls: "tv-home" });

let data = null;
try { data = JSON.parse(await app.vault.adapter.read(DATA)); } catch (e) { /* not generated yet */ }
if (!data) { root.createDiv({ cls: "tv-empty", text: "Nothing yet: this fills in after the hourly Serializd sync." }); return; }

const today = DateTime.now().toISODate();
const openUrl = url => e => { e.preventDefault(); e.stopPropagation(); window.open(url); };
const openNote = path => e => { e.preventDefault(); app.workspace.openLinkText(path, dv.currentFilePath, e.metaKey || e.ctrlKey); };
// A show with a note in the vault opens it; anything else opens on Serializd.
const notePath = tid => dv.pages(`"50_Personal/Serializd/Shows"`).where(p => Number(p.tmdb_id) === Number(tid)).first()?.file.path;
const link = (el, tid, url) => {
	const path = notePath(tid);
	el.addEventListener("click", path ? openNote(path) : openUrl(url));
	el.setAttr("href", path ?? url);
};
// Streaming services as small chips; the ones paid for get a check and a stronger colour.
function streams(parent, list, mine) {
	if (!list?.length) return;
	const box = parent.createDiv({ cls: "tv-streams" });
	const names = [...new Set(list.map(s => s.replace(/ (Standard with Ads|with Ads|Amazon Channel|Premium Plus|Premium)$/, "")))];
	for (const s of names.slice(0, 2)) box.createSpan({ cls: `tv-stream${mine ? " tv-stream-mine" : ""}`, text: s, attr: { title: mine ? "Streams on a service you pay for" : "Streams here" } });
}
const fmtDay = d => { const x = DateTime.fromISO(d); return x.hasSame(DateTime.now(), "year") ? x.toFormat("LLL d") : x.toFormat("LLL d, yyyy"); };

// ── Up next ─────────────────────────────────────────────────────────────────
if (part === "upnext") {
	const shows = data.upnext ?? [];
	if (!shows.length) root.createDiv({ cls: "tv-empty", text: "Nothing on your Serializd currently-watching list." });
	const grid = root.createDiv({ cls: "tv-upnext" });
	for (const s of shows) {
		const n = s.next;
		// Recompute against today: the file is hourly, the day can turn in between.
		let status = s.status, label = s.label;
		if (n?.air_date) {
			const days = Math.round(DateTime.fromISO(n.air_date).diff(DateTime.fromISO(today), "days").days);
			[status, label] = days < 0 ? ["out", "Out now"] : days === 0 ? ["today", "Airs today"] : days === 1 ? ["soon", "Tomorrow"]
				: days < 7 ? ["soon", DateTime.fromISO(n.air_date).toFormat("cccc")] : ["later", `${fmtDay(n.air_date)} · in ${days} days`];
		}
		const card = grid.createEl("a", { cls: `tv-next tv-next-${status}` });
		link(card, s.tmdb_id, s.serializd_url);
		const art = card.createDiv({ cls: "tv-next-art" });
		const img = n?.still || s.backdrop || s.poster;
		if (img) art.style.backgroundImage = `url("${img}")`;
		art.createDiv({ cls: `tv-badge tv-badge-${status}`, text: label });
		if (n?.type === "finale") art.createDiv({ cls: "tv-badge tv-badge-finale", text: "Season finale" });
		else if (n?.code?.endsWith("E01") && s.last) art.createDiv({ cls: "tv-badge tv-badge-finale", text: "Season premiere" });

		const body = card.createDiv({ cls: "tv-next-body" });
		body.createDiv({ cls: "tv-next-show", text: s.title });
		if (n) {
			body.createDiv({ cls: "tv-next-ep", text: `${n.code}${n.name ? ` · ${n.name}` : ""}`, attr: { title: n.overview || n.name } });
			const meta = [];
			if (status === "out" && s.behind > 1) meta.push(`${s.behind} episodes waiting`);
			else if (status === "out") meta.push("Ready to watch");
			if (n.runtime) meta.push(`${n.runtime} min`);
			if (s.last) meta.push(`last: ${s.last}`);
			body.createDiv({ cls: "tv-next-meta", text: meta.join(" · ") });
			if (n.season_total) {
				const prog = body.createDiv({ cls: "tv-prog", attr: { title: `${n.season_done} of ${n.season_total} episodes this season` } });
				prog.createDiv({ cls: "tv-prog-fill" }).style.width = `${Math.round(100 * n.season_done / n.season_total)}%`;
			}
		} else body.createDiv({ cls: "tv-next-meta", text: s.show_status === "Ended" || s.show_status === "Canceled" ? "The show has ended" : "Waiting for the next episode to be announced" });
		const foot = body.createDiv({ cls: "tv-next-foot" });
		if (n?.in_plex) foot.createSpan({ cls: "tv-plex", text: "▶ In Plex", attr: { title: "Sonarr has this episode on disk" } });
		streams(foot, s.streams, s.mine);
	}

	// The week ahead: seven day columns, today first.
	const week = data.week ?? [];
	root.createDiv({ cls: "tv-sub", text: "This week on TV" });
	const box = root.createDiv({ cls: "tv-week" });
	for (let i = 0; i < 7; i++) {
		const d = DateTime.fromISO(today).plus({ days: i }), iso = d.toISODate();
		const col = box.createDiv({ cls: `tv-day${i === 0 ? " tv-day-today" : ""}` });
		col.createDiv({ cls: "tv-day-name", text: i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toFormat("ccc") });
		col.createDiv({ cls: "tv-day-date", text: d.toFormat("LLL d") });
		const eps = week.filter(w => w.date === iso);
		if (!eps.length) col.addClass("tv-day-empty");
		for (const w of eps) {
			const item = col.createEl("a", { cls: `tv-day-ep${w.watching ? " tv-day-watching" : ""}`, attr: { title: `${w.title} ${w.code}${w.name ? ` · ${w.name}` : ""}` } });
			link(item, w.tmdb_id, w.serializd_url);
			const thumb = item.createDiv({ cls: "tv-day-thumb" });
			if (w.poster) thumb.style.backgroundImage = `url("${w.poster}")`;
			const t = item.createDiv({ cls: "tv-day-text" });
			t.createDiv({ cls: "tv-day-show", text: w.title });
			t.createDiv({ cls: "tv-day-code", text: w.type === "finale" ? `${w.code} · finale` : w.code.endsWith("E01") ? `${w.code} · premiere` : w.code });
		}
	}
}

// ── Poster rows (recs / new) ────────────────────────────────────────────────
function posterRow(parent, items, { blockable = false, dateLabel = null } = {}) {
	const row = parent.createDiv({ cls: "tv-row" });
	for (const p of items) {
		const card = row.createDiv({ cls: "tv-card" });
		const a = card.createEl("a", { cls: "tv-card-poster-link", attr: { title: p.overview || p.title } });
		link(a, p.tmdb_id, p.serializd_url);
		const art = a.createDiv({ cls: "tv-card-poster" });
		if (p.poster) art.style.backgroundImage = `url("${p.poster}")`;
		else { art.addClass("tv-card-poster-missing"); art.setText(p.title); }
		if (dateLabel) art.createDiv({ cls: "tv-badge tv-badge-date", text: dateLabel(p) });
		card.createDiv({ cls: "tv-card-title", text: p.title, attr: { title: p.title } });
		const sub = [p.year, p.rating ? `★ ${p.rating}` : null].filter(Boolean).join(" · ");
		if (sub) card.createDiv({ cls: "tv-card-sub", text: sub });
		if (p.why || p.label) card.createDiv({ cls: "tv-card-why", text: p.why ?? p.label, attr: { title: p.why ?? p.label } });
		streams(card, p.streams, p.mine);
		if (blockable) {
			const x = card.createEl("button", { cls: "tv-card-x", text: "✕", attr: { "aria-label": `Never recommend ${p.title}` } });
			x.addEventListener("click", async () => {
				x.disabled = true;
				try {
					const cur = JSON.parse(await app.vault.adapter.read(BLOCKED).catch(() => "{}")).blocked ?? [];
					if (!cur.some(b => b.tmdb_id === p.tmdb_id)) cur.push({ tmdb_id: p.tmdb_id, title: p.title, date: today });
					await app.vault.adapter.write(BLOCKED, JSON.stringify({ blocked: cur }, null, 1));
					card.remove();
				} catch (e) { x.disabled = false; x.setText("!"); console.error(e); }
			});
		}
	}
	return row;
}

if (part === "recs") {
	let blocked = [];
	try { blocked = JSON.parse(await app.vault.adapter.read(BLOCKED)).blocked ?? []; } catch (e) { /* none yet */ }
	const recs = (data.recs ?? []).filter(r => !blocked.some(b => b.tmdb_id === r.tmdb_id));
	if (!recs.length) root.createDiv({ cls: "tv-empty", text: "No recommendations yet." });
	else posterRow(root, recs, { blockable: true });
	if (data.daily && data.daily !== today) root.createDiv({ cls: "tv-stale", text: `Last updated ${data.daily}` });
}

if (part === "new") {
	const sections = [
		["Your shows coming back", data.returning ?? [], p => `${p.label.replace(" premieres", "")} · ${fmtDay(p.date)}`],
		["New this month", data.released ?? [], p => `Since ${fmtDay(p.date)}`],
		["Coming soon", data.upcoming ?? [], p => fmtDay(p.date)],
	];
	for (const [title, items, label] of sections) {
		if (!items.length) continue;
		root.createDiv({ cls: "tv-sub", text: title });
		posterRow(root, items, { dateLabel: label });
	}
	if (!sections.some(([, items]) => items.length)) root.createDiv({ cls: "tv-empty", text: "Nothing new yet." });
}
