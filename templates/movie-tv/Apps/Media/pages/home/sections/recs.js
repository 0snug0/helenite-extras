// Recommended movies / New & Upcoming (movie-recs): cards from 99_Internal/Data/movie-recs.json or movie-releases.json,
// written by the vault's launchd/scheduled scripts. The app only reads them; "+ Obsidian" sets `pending` on the film
// note and ✕ appends to movie-recs-blocked.json (which movie_recs.py reads), exactly as the DataviewJS view did.
import { fmtLong, parse } from "../dates.js";
import { FILMS, fileStem, newFilmNote } from "../films.js";
import { clear, div, el, scoreRow } from "../ui.js";
import { button, disclosure, emptyState, mediaCard, mediaGrid, statusText, threadText, toolbar } from "../../../core/ui-kit.js";

const BLOCKED = "99_Internal/Data/movie-recs-blocked.json";
async function readJson(api, path, fallback = null) {
	try { return JSON.parse(await api.vault.read(path)); } catch { return fallback; }
}

// opts: { data, keys } like the original `input`. Returns a promise for the first draw.
export function renderRecs(root, ctx, opts = {}) {
	const data0 = opts.data ?? "99_Internal/Data/movie-recs.json";
	const keys = opts.keys ?? ["picks"];
	const releases = !!opts.data;
	const snapsDir = `99_Internal/Data/history/${releases ? "releases" : "recs"}`;
	const box = div(root, "movie-recs-box");
	let back = 0;

	async function render() {
		clear(box);
		let data = await readJson(ctx.api, data0);
		let snaps = [];
		try { snaps = (await ctx.api.vault.list(`${snapsDir}/*.json`)).sort(); } catch { /* none yet */ }
		back = Math.max(0, Math.min(back, snaps.length - 1));
		if (back > 0) data = (await readJson(ctx.api, snaps[snaps.length - 1 - back])) ?? data;

		const nav = toolbar(box);
		nav.classList.add("movie-recs-nav");
		button(nav, { icon: "chevron-left", label: "Previous", variant: "icon", disabled: back >= snaps.length - 1, onClick: () => { back++; render(); } });
		const label = releases ? (data?.week ?? "") : (data?.generated ?? "");
		statusText(nav, back === 0 ? `${label} (latest)` : label).classList.add("movie-recs-nav-label");
		button(nav, { icon: "chevron-right", label: "Next", variant: "icon", disabled: back === 0, onClick: () => { back--; render(); } });

		const blocked = (await readJson(ctx.api, BLOCKED, {}))?.blocked ?? [];
		const isBlocked = p => blocked.some(b => (b.tmdb_id && b.tmdb_id === p.tmdb_id) || (b.title === p.title && b.year === p.year));
		const picks = data ? keys.flatMap(k => data[k] ?? []).filter(p => !isBlocked(p)) : [];
		if (!picks.length) {
			return emptyState(box, releases
				? "Nothing here yet. This row fills in after the weekly refresh."
				: "No recommendations yet. They appear after the daily recommender runs.");
		}
		const today = ctx.todayIso;
		if (!releases && back === 0 && data.generated && data.generated !== today) statusText(box, `Last updated ${data.generated}`, "warning").classList.add("movie-recs-stale");

		const row = mediaGrid(box, { layout: "strip", minWidth: 190 });
		row.classList.add("movie-recs");
		for (const p of picks) drawCard(row, p, today);
		if (data.prompt) {
			const how = disclosure(box, { title: "How these were picked", compact: true });
			how.el.classList.add("movie-recs-how");
			if (data.angle) threadText(how.body, data.angle);
			threadText(how.body, data.prompt);
		}
	}

	function drawCard(row, p, today) {
		const upcoming = !!p.release_date && p.release_date > today;
		const media = mediaCard(row, { art: { title: p.title, src: p.poster, tooltip: `${p.title} on Letterboxd`, onClick: () => p.letterboxd_url && ctx.openUrl(p.letterboxd_url) } });
		const { el: card, body } = media;
		card.classList.add("movie-rec");
		statusText(body, upcoming && p.release_date ? `Opens ${fmtLong(parse(p.release_date))}` : String(p.year ?? ""));
		if (!upcoming) scoreRow(body, { lb: p.lb_rating, rt: p.rt_score, aud: p.rt_audience, lbUrl: p.letterboxd_url, rtUrl: p.rt_url, imdb: p.imdb_rating, imdbUrl: p.imdb_url }, ctx.openUrl);
		if (p.availability) statusText(body, [p.availability.kind, ...(p.availability.on ?? [])].join(" · ")).title = "Available in the US";
		if (p.why) {
			const why = div(body, "hel-media-detail", p.why);
			why.title = p.why;
		}

		const tag = div(body, "movie-rec-source");
		const note = ctx.find(p);
		const renderTag = state => {
			clear(tag);
			if (!state || !(state.listed || state.pending)) return;
			button(tag, { text: state.listed ? "In watchlist" : "Pending", variant: "link", onClick: e => ctx.openNote(state.path, e) }).el.title = state.path;
		};
		renderTag(note && { path: note.file.path, listed: !!note.on_watchlist, pending: !!note.pending });

		const btns = media.footer;
		const obs = button(btns, { text: "+ Obsidian", onClick: note?.pending ? undefined : addToObsidian });
		obs.el.title = "Mark as pending on its film note";
		const done = path => { obs.setText("✓ In Obsidian"); obs.setDisabled(true); obs.el.title = path; };
		if (note?.pending) done(note.file.path);
		async function addToObsidian() {
			obs.setDisabled(true);
			try {
				let path = note?.file.path;
				if (path) await ctx.api.notes.update(path, { pending: true, pending_added: today });
				else {
					// Not suggested through the scripts yet (they create the note): make it, in film_store.py's shape.
					path = `${FILMS}/${fileStem(p)}.md`;
					if (ctx.pathExists(path)) path = `${FILMS}/${fileStem(p)} (tmdb-${p.tmdb_id}).md`;
					await ctx.api.vault.write(path, newFilmNote(p, today, { pending: true }));
				}
				done(path);
				renderTag({ path, listed: !!note?.on_watchlist, pending: true });
			} catch (e) { obs.setText("Failed"); obs.setDisabled(false); ctx.api.log(e); }
		}

		// Open this title on its page (Movies, or TV for a show): the router focuses it by tmdb id. Read-only.
		const dl = button(btns, { icon: "download", label: `Open ${p.title}`, variant: "icon", onClick: e => ctx.openTitle(p, e, note) });
		dl.el.title = p.tmdb_type === "tv" ? "Open in TV" : "Open in Movies";

		const nope = button(btns, { icon: "x", label: `Never recommend ${p.title}`, variant: "icon", onClick: async () => {
			try {
				const cur = (await readJson(ctx.api, BLOCKED, {}))?.blocked ?? [];
				if (!cur.some(b => b.tmdb_id === p.tmdb_id)) cur.push({ tmdb_id: p.tmdb_id, title: p.title, year: p.year, date: today });
				await ctx.api.vault.write(BLOCKED, JSON.stringify({ blocked: cur }, null, 1));
				card.remove();
			} catch (e) { nope.el.title = `Failed: ${e?.message ?? e}`; ctx.api.log(e); }
		} });
		nope.el.title = "Never recommend this again";
	}

	return render();
}
