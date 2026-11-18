// Every film and TV show a person worked on, with their role. Rendered on each note in 50_Personal/Letterboxd/People/.
// Films are the Letterboxd notes, TV shows the Serializd ones (same keys).
// Usage: await dv.view("99_Internal/Views/person-films")
// Roles live on the film notes (directors, writers + writer_jobs, cast + cast_roles); a person note holds none.
const fl = new Function("module", await app.vault.adapter.read("99_Internal/Views/films-lib.js"))(undefined);
const me = dv.current().file.path;
const list = v => v == null ? [] : Array.isArray(v) ? v : typeof v.array === "function" ? v.array() : [v];
// A frontmatter link's path may be the resolved file path or the text as written; accept both.
const isMe = l => !!l?.path && (l.path === me || app.metadataCache.getFirstLinkpathDest(l.path, me)?.path === me);

const rows = [];
for (const p of dv.pages(`"${fl.FILMS}" or "${fl.SHOWS}"`)) {
	const isShow = p.Type === "Show" || p.tmdb_type === "tv";
	const roles = [];
	if (list(p.directors).some(isMe)) roles.push("Director");
	const jobs = list(p.writer_jobs), parts = list(p.cast_roles);
	list(p.writers).forEach((l, i) => { if (isMe(l)) roles.push(jobs[i] || "Writer"); });
	list(p.cast).forEach((l, i) => { if (isMe(l)) roles.push(parts[i] || "Cast"); });
	if (!roles.length) continue;
	const watched = fl.iso(p.last_watched);
	rows.push({
		sort: `${watched || "0000"} ${p.year ?? ""}`,
		cells: [
			p.poster ? `![poster|50](${p.poster})` : "",
			p.file.link,
			isShow ? "TV" : "Film",
			p.year ?? "",
			roles.join(", "),
			p.rating ? `${(Number(p.rating) / 2).toFixed(1)} ★` : "",
			p.watching ? `Watching${watched ? ` (last ${watched})` : ""}` : watched ? `Watched ${watched}` : p.pending ? "Pending" : p.on_watchlist ? "Watchlist" : "Suggested",
		],
	});
}
rows.sort((a, b) => b.sort.localeCompare(a.sort));
if (rows.length) dv.table(["", "Title", "Type", "Year", "Role", "Rating", "Status"], rows.map(r => r.cells));
else dv.paragraph("No films or shows link to this person yet.");
