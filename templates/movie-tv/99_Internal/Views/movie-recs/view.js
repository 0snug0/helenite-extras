// Ten daily picks, written by the scheduled recommender (Templates/Scripts/movie_recs.py)
// after the 09:00 Letterboxd sync. Same card look as movie-row.
// Usage: await dv.view("99_Internal/Views/movie-recs")
// Also draws the weekly rows from movie_releases.py:
//   await dv.view("99_Internal/Views/movie-recs", { data: "99_Internal/Data/movie-releases.json", keys: ["released", "upcoming"] })
// Films not out yet show their release date instead of scores.
const DATA = input?.data ?? "99_Internal/Data/movie-recs.json";
const KEYS = input?.keys ?? ["picks"];
const BLOCKED = "99_Internal/Data/movie-recs-blocked.json";   // read by movie_recs.py; "x" appends here
// One note per film; its `on_watchlist` and `pending` flags drive the green tag. "+ Obsidian" sets `pending`,
// an intake queue meant for an automatic downloader.
const fl = new Function("module", await app.vault.adapter.read("99_Internal/Views/films-lib.js"))(undefined);

// The download icon opens Downloadrr's release picker (Radarr search → Select → Download).
const DOWNLOAD_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>';
let picker = null;
try {
	const src = await app.vault.adapter.read("99_Internal/Views/downloadrr/picker.js");
	picker = await new Function("module", src)(undefined).createPicker(app);
} catch (e) { picker = { error: `Could not load the release picker: ${e.message}`, open: null }; }

// Drawn in a function so it can run again when the recommender rewrites the data file.
// Not dv.container itself: Dataview puts this view's <style> element in it, and emptying it drops the CSS.
const root = dv.container.createDiv();
const SNAPS = `99_Internal/Data/history/${input?.data ? "releases" : "recs"}`;   // dated copies written by the scripts
let back = 0;   // how many snapshots before the newest we are showing; 0 = live file
async function render() {
	root.empty();
	let data = null;
	try { data = JSON.parse(await app.vault.adapter.read(DATA)); } catch (e) { /* not generated yet */ }

	let snaps = [];
	try { snaps = (await app.vault.adapter.list(SNAPS)).files.filter(f => f.endsWith(".json")).sort(); } catch (e) { /* none yet */ }
	// Older rows are the snapshots; the newest one is the live file.
	back = Math.max(0, Math.min(back, snaps.length - 1));
	if (back > 0) {
		try { data = JSON.parse(await app.vault.adapter.read(snaps[snaps.length - 1 - back])); } catch (e) { /* keep live */ }
	}
	{
		const nav = root.createDiv({ cls: "movie-recs-nav" });
		const older = nav.createEl("button", { cls: "movie-rec-btn", text: "‹", attr: { title: "Previous", "aria-label": "Previous" } });
		older.disabled = back >= snaps.length - 1;
		if (older.disabled) older.setAttr("title", "No earlier lists yet");
		older.addEventListener("click", () => { back++; render(); });
		const label = input?.data ? (data?.week ?? "") : (data?.generated ?? "");
		nav.createSpan({ cls: "movie-recs-nav-label", text: back === 0 ? `${label} (latest)` : label });
		const newer = nav.createEl("button", { cls: "movie-rec-btn", text: "›", attr: { title: "Next", "aria-label": "Next" } });
		newer.disabled = back === 0;
		newer.addEventListener("click", () => { back--; render(); });
	}

	let blocked = [];
	try { blocked = JSON.parse(await app.vault.adapter.read(BLOCKED)).blocked ?? []; } catch (e) { /* none yet */ }
	const isBlocked = p => blocked.some(b => (b.tmdb_id && b.tmdb_id === p.tmdb_id) || (b.title === p.title && b.year === p.year));
	if (data) data.all = KEYS.flatMap(k => data[k] ?? []).filter(p => !isBlocked(p));   // hide at once, before the next daily run

	const openUrl = url => e => { e.preventDefault(); e.stopPropagation(); window.open(url); };

	if (!data?.all?.length) {
		root.createDiv({ cls: "movie-recs-empty", text: input?.data ? "Nothing here yet. This row fills in after the weekly refresh." : "No recommendations yet. They appear after the daily recommender runs." });
	} else {
		const today = dv.luxon.DateTime.now().toISODate();
		if (!input?.data && back === 0 && data.generated && data.generated !== today)
			root.createDiv({ cls: "movie-recs-stale", text: `Last updated ${data.generated}` });

		const find = fl.filmIndex(dv.pages(`"${fl.FILMS}"`));
		const openNote = path => e => {
			e.preventDefault();
			app.workspace.openLinkText(path, dv.currentFilePath, e.metaKey || e.ctrlKey);
		};

		const row = root.createDiv({ cls: "movie-recs" });
		for (const p of data.all) {
			const UPCOMING = !!p.release_date && p.release_date > today;
			const card = row.createDiv({ cls: "movie-rec" });
			const lb = `${p.title} on Letterboxd`;
			// A div with a background image, not an <img>: Minimal zooms any img:active on click.
			const poster = card.createEl("a", { cls: "movie-rec-poster-link", attr: { href: p.letterboxd_url, title: lb } });
			poster.addEventListener("click", openUrl(p.letterboxd_url));
			const art = poster.createDiv({ cls: "movie-rec-poster", attr: { role: "img", "aria-label": p.title } });
			if (p.poster) art.style.backgroundImage = `url("${p.poster}")`;
			else { art.addClass("movie-rec-poster-missing"); art.setText(p.title); }
			const fmtDate = d => dv.luxon.DateTime.fromISO(d).toFormat("LLL d, yyyy");
			card.createDiv({ cls: "movie-rec-year", text: UPCOMING && p.release_date ? `Opens ${fmtDate(p.release_date)}` : String(p.year ?? "") });
			if (!UPCOMING) fl.scoreRow(card, { lb: p.lb_rating, rt: p.rt_score, aud: p.rt_audience, lbUrl: p.letterboxd_url, rtUrl: p.rt_url, imdb: p.imdb_rating, imdbUrl: p.imdb_url });
			if (p.availability) card.createDiv({ cls: "movie-rec-avail", text: [p.availability.kind, ...(p.availability.on ?? [])].join(" · "), attr: { title: "Available in the US" } });
			card.createDiv({ cls: "movie-rec-why", text: p.why, attr: { title: p.why } });

			const tag = card.createDiv({ cls: "movie-rec-source" });
			// state: what the film note says, or what we just wrote to it (Dataview re-indexes a moment later).
			const renderTag = (state = find(p) && { path: find(p).file.path, listed: !!find(p).on_watchlist, pending: !!find(p).pending }) => {
				tag.empty();
				if (!state || !(state.listed || state.pending)) return;
				const link = tag.createEl("a", { cls: "movie-rec-source-link", text: state.listed ? "In watchlist" : "Pending", attr: { href: "#", title: state.path } });
				link.addEventListener("click", openNote(state.path));
			};
			renderTag();

			const btns = card.createDiv({ cls: "movie-rec-buttons" });
			const obs = btns.createEl("button", { cls: "movie-rec-btn", text: "+ Obsidian", attr: { title: "Mark as pending on its film note" } });
			const done = path => {
				obs.setText("✓ In Obsidian");
				obs.disabled = true;
				obs.setAttr("title", path);
			};
			const note = find(p);
			if (note?.pending) done(note.file.path);
			else obs.addEventListener("click", async () => {
				obs.disabled = true;
				try {
					let path = note?.file.path;
					if (path) {
						const flags = { pending: true, pending_added: today };
						await app.vault.process(app.vault.getAbstractFileByPath(path), text => fl.setKeys(text, flags));
					} else {
						// Not suggested through the scripts yet (they create the note): make it, in film_store.py's shape.
						if (!app.vault.getAbstractFileByPath(fl.FILMS)) await app.vault.createFolder(fl.FILMS);
						path = `${fl.FILMS}/${fl.fileStem(p)}.md`;
						if (app.vault.getAbstractFileByPath(path)) path = `${fl.FILMS}/${fl.fileStem(p)} (tmdb-${p.tmdb_id}).md`;
						await app.vault.create(path, fl.newFilmNote(p, today, { pending: true }));
					}
					done(path);
					renderTag({ path, listed: !!note?.on_watchlist, pending: true });
				} catch (e) { obs.setText("Failed"); obs.disabled = false; console.error(e); }
			});

			const dl = btns.createEl("button", { cls: "movie-rec-btn movie-rec-btn-dl", attr: {
				title: picker.error ?? (p.tmdb_id ? "Find releases" : "No TMDB id"),
				"aria-label": `Find releases for ${p.title}`,
			} });
			dl.innerHTML = DOWNLOAD_ICON;
			dl.disabled = !picker.open || !p.tmdb_id;
			dl.addEventListener("click", () => picker.open({ title: p.title, year: p.year, tmdbId: Number(p.tmdb_id) }));

			const nope = btns.createEl("button", { cls: "movie-rec-btn movie-rec-btn-x", text: "✕", attr: { title: "Never recommend this again", "aria-label": `Never recommend ${p.title}` } });
			nope.addEventListener("click", async () => {
				nope.disabled = true;
				try {
					const cur = JSON.parse(await app.vault.adapter.read(BLOCKED).catch(() => "{}")).blocked ?? [];
					if (!cur.some(b => b.tmdb_id === p.tmdb_id))
						cur.push({ tmdb_id: p.tmdb_id, title: p.title, year: p.year, date: today });
					await app.vault.adapter.write(BLOCKED, JSON.stringify({ blocked: cur }, null, 1));
					card.remove();
				} catch (e) { nope.disabled = false; nope.setText("!"); console.error(e); }
			});
		}
		// The prompt that chose these films, built fresh each run from the date, season and diary.
		if (data.prompt) {
			const how = root.createEl("details", { cls: "movie-recs-how" });
			how.createEl("summary", { text: "How these were picked" });
			if (data.angle) how.createDiv({ cls: "movie-recs-angle", text: data.angle });
			how.createEl("pre", { cls: "movie-recs-prompt", text: data.prompt });
		}
	}
}

await render();

// The 09:30 task writes the file (tmp + rename) while the page may already be open: redraw then.
// dv.component owns the listeners, so they go away when Dataview re-renders or closes this block.
let timer = null;
const onFile = f => {
	if (f?.path !== DATA && f?.path !== BLOCKED) return;
	clearTimeout(timer);
	timer = setTimeout(() => render().catch(console.error), 400);
};
dv.component.registerEvent(app.vault.on("modify", onFile));
dv.component.registerEvent(app.vault.on("create", onFile));
dv.component.register(() => clearTimeout(timer));
