import lib from "./lib.js";

// Part of the Downloadrr view; `c` is the context shared by every part (see view.js).
export function install(c) {
// Takes the film off both lists by clearing its note's flags. The note stays: it also holds the film's watches
// and history. The daily Letterboxd sync sets on_watchlist again for as long as Letterboxd still lists the film.
async function trashNotes(match) {
	for (let i = c.notes.length - 1; i >= 0; i--) {
		if (!match(c.notes[i])) continue;
		// Was c.app.vault.process + films-lib setKeys (a hand-written frontmatter editor mirroring film_store.py):
		// a typed frontmatter patch, checked against the manifest's vault.write globs.
		await c.api.notes.update(c.notes[i].path, { on_watchlist: false, pending: false });
		c.notes.splice(i, 1);
	}
}

// mode "all" (the table's Radarr button, a card's x) removes the movie from Radarr with its file and every
// download of it, and its watchlist c.notes. Otherwise only the row's own thing goes: that one download (when
// given), or the file on disk.
async function removeMovie(movie, mode, download = null) {
	if (c.state.removing) return;
	c.state.removing = movie.id;
	c.draw();
	let failed = null;
	try {
		// The queue as it is now, not as last polled: a download grabbed seconds ago has to be cancelled too, or it
		// would finish and re-import (Radarr's queue and SABnzbd both drop it).
		const queue = await c.client.getQueue();
		for (const step of lib.removalPlan(movie, mode, download, queue)) {
			if (step.op === "cancel") await c.client.removeQueueItem(step.id);
			else if (step.op === "deleteMovie") await c.client.deleteMovie(movie.id);
			else if (step.op === "deleteFile") await c.client.deleteFile(movie);
			else if (step.op === "unmonitor") await c.client.unmonitor(movie);
			else if (step.op === "trashNotes") await trashNotes(n => n.tmdbId === movie.tmdbId);
		}
		c.state.cache.clear();   // cached release lists and ids may point at the removed movie
		if (c.state.panel && !c.state.movies.some(m => m.id !== movie.id && m.tmdbId === c.state.panel.tmdbId)) c.state.panel = null;
	} catch (e) {
		failed = e.message;
	}
	await c.refreshRadarr();   // also after a failure part-way: the rows must show what is actually left
	if (failed) c.state.error = failed;
	c.state.removing = null;
	c.draw();
}

// A card's x for a film Radarr does not have: only its watchlist c.notes go.
async function unlistFilm(film) {
	if (c.state.removing) return;
	c.state.removing = film.key;
	c.draw();
	try {
		await trashNotes(n => film.tmdbId ? n.tmdbId === film.tmdbId : n.path === film.path);
		if (c.state.panel?.key === film.key) c.state.panel = null;
	} catch (e) {
		c.state.error = e.message;
	} finally {
		c.state.removing = null;
	}
	c.draw();
}

Object.assign(c, { removeMovie, unlistFilm });
}
