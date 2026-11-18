// Scores, cast & crew of a film note: Letterboxd / Rotten Tomatoes scores linking out, crew as text lines, then the cast IMDb-style, one person per line: round photo, with name and character beside it.
// Usage: await dv.view("99_Internal/Views/film-credits")
// Reads the note's own directors, writers + writer_jobs, cast + cast_roles. Photos come from people-index.json,
// which also covers people who have no note yet (films that were only ever suggested).
const INDEX = "99_Internal/Data/people-index.json", PHOTO = "https://image.tmdb.org/t/p/w185";
const cur = dv.current(), me = cur.file.path;
const list = v => v == null ? [] : Array.isArray(v) ? v : typeof v.array === "function" ? v.array() : [v];
const stemOf = l => String(l?.path ?? l ?? "").split("/").pop().replace(/\.md$/, "");

const photos = {};
try {
	for (const p of Object.values(JSON.parse(await app.vault.adapter.read(INDEX)))) if (p.photo) photos[p.stem.toLowerCase()] = p.photo;
} catch (e) { /* no index: every card falls back to initials */ }

// A person with a note is a real internal link (hover preview, cmd-click); one without is plain text,
// since clicking an unresolved link would create the note in 10_Inbox and fire its template.
function person(parent, l, cls) {
	const stem = stemOf(l), name = l?.display || stem;
	const dest = app.metadataCache.getFirstLinkpathDest(String(l?.path ?? stem), me);
	const el = dest
		? parent.createEl("a", { cls: ["internal-link", cls], href: dest.path, attr: { "data-href": dest.path } })
		: parent.createEl("span", { cls });
	return { el, stem, name };
}

// Films I have watched (not merely watchlisted) with each person in the cast, keyed by note name. This film counts too
// when watched, but a badge only shows for someone seen in at least one other film, so a first-timer gets none.
const fl = new Function("module", await app.vault.adapter.read("99_Internal/Views/films-lib.js"))(undefined);
const seen = {};
// Films and TV shows both count: an actor seen in a series is someone seen.
for (const p of dv.pages(`"${fl.FILMS}" or "${fl.SHOWS}"`)) {
	if (!(Number(p.watch_count) > 0)) continue;
	for (const key of new Set(list(p.cast).map(l => stemOf(l).toLowerCase()))) (seen[key] ??= []).push(p);
}
const EYE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';

const root = dv.container.createDiv({ cls: "film-credits" });

// Scores are refreshed weekly on the film's score_day, so a film may not have them yet: that shows as a dash.
function score(parent, label, value, url, title) {
	const el = url
		? parent.createEl("a", { cls: ["external-link", "film-score"], href: url, attr: { target: "_blank", rel: "noopener", title } })
		: parent.createSpan({ cls: "film-score", attr: { title } });
	el.createSpan({ cls: "film-score-value", text: value ?? "–" });
	el.createSpan({ cls: "film-score-label", text: label });
}
const scores = root.createDiv({ cls: "film-scores" });
score(scores, "Letterboxd", cur.lb_rating != null ? `★ ${Number(cur.lb_rating).toFixed(1)}` : null, cur.letterboxd_url, "Letterboxd average, out of 5");
score(scores, "Tomatometer", cur.rt_score != null ? `🍅 ${cur.rt_score}%` : null, cur.rt_url, "Rotten Tomatoes critics score");
score(scores, "Audience", cur.rt_audience != null ? `🍿 ${cur.rt_audience}%` : null, cur.rt_url, "Rotten Tomatoes audience score");

function crew(label, links, jobs) {
	if (!links.length) return;
	const line = root.createDiv({ cls: "film-crew" });
	line.createSpan({ cls: "film-crew-label", text: links.length > 1 ? `${label}s` : label });
	links.forEach((l, i) => {
		if (i) line.appendText(" · ");
		const { el, name } = person(line, l, "film-crew-name");
		el.setText(name);
		if (jobs?.[i]) line.createSpan({ cls: "film-crew-job", text: ` (${jobs[i]})` });
	});
}
crew("Director", list(cur.directors));
crew("Writer", list(cur.writers), list(cur.writer_jobs));

const cast = list(cur.cast), roles = list(cur.cast_roles);
if (cast.length) {
	const row = root.createDiv({ cls: "film-cast" });
	cast.forEach((l, i) => {
		const { el, stem, name } = person(row, l, "film-cast-card");
		const photo = photos[stem.toLowerCase()];
		// A background-image div, not <img>: Minimal zooms any img:active.
		const pic = el.createDiv({ cls: "film-cast-photo" });
		if (photo) pic.style.backgroundImage = `url("${PHOTO}${photo}")`;
		else pic.setText(name.split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase());
		const text = el.createDiv({ cls: "film-cast-text" });
		text.createDiv({ cls: "film-cast-name", text: name });
		if (roles[i]) text.createDiv({ cls: "film-cast-role", text: String(roles[i]) });
		const films = seen[stem.toLowerCase()];
		if (films?.some(p => p.file.path !== me)) {
			const titles = films.sort((x, y) => (y.year ?? 0) - (x.year ?? 0)).map(p => `${p.title ?? p.file.name}${p.year ? ` (${p.year})` : ""}`);
			const n = el.createDiv({ cls: "film-cast-seen", attr: { "aria-label": titles.join("\n") } });
			n.createDiv({ cls: "film-cast-seen-eye" }).innerHTML = EYE;
			const nShows = films.filter(p => p.Type === "Show" || p.tmdb_type === "tv").length, nFilms = films.length - nShows;
			n.createDiv({ text: [nFilms ? `${nFilms} ${nFilms === 1 ? "film" : "films"}` : "", nShows ? `${nShows} ${nShows === 1 ? "show" : "shows"}` : ""].filter(Boolean).join(" · ") });
		}
	});
}
