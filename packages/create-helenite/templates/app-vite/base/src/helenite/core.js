// The framework-free data layer every adapter wraps: reading notes through the capability api, with a cache, a
// subscription and a refresh. Adapters only turn `store.subscribe` into their framework's idiom (a hook, a Svelte
// store, a Vue ref); the query, the cache and `update` live here, once.

/** Ordered keys, so { a, b } and { b, a } hit the same cache entry. */
const keyOf = ({ from, where }) => JSON.stringify([from ?? null, Object.entries(where ?? {}).sort(([a], [b]) => (a < b ? -1 : 1))]);

/** A note as the app sees it: the frontmatter at `fm`, the rest beside it. */
const toNote = (n) => ({ path: n.path, basename: n.basename, mtime: n.mtime, fm: n.frontmatter ?? {} });

/** Applies the client-side options of useNotes: `filter(note)`, `sort(a, b)` and `limit`. */
export function select(notes, { filter, sort, limit } = {}) {
	let out = filter ? notes.filter(filter) : notes;
	if (sort) out = [...out].sort(sort);
	return limit != null ? out.slice(0, limit) : out;
}

export function createNotes(api) {
	const stores = new Map();

	function query(spec) {
		const key = keyOf(spec);
		let store = stores.get(key);
		if (store) return store;
		const listeners = new Set();
		let state = { status: "loading", notes: [], error: null };
		const set = (next) => { state = { ...state, ...next }; listeners.forEach((fn) => fn(state)); };
		const refresh = async () => {
			// `from` is one glob or a list of them (the host takes one glob per call, so a list is merged here).
			const globs = Array.isArray(spec.from) ? spec.from : [spec.from];
			try {
				const lists = await Promise.all(globs.map((from) => api.notes.query({ from, where: spec.where })));
				set({ status: "ready", notes: lists.flat().map(toNote), error: null });
			}
			catch (error) { set({ status: "error", error }); }
		};
		store = { get: () => state, subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); }, refresh };
		stores.set(key, store);
		refresh();
		return store;
	}

	return {
		query,
		/** The note's text, frontmatter included (api.vault.read). */
		read: (path) => api.vault.read(path),
		/** Patches a note's frontmatter (`null` deletes a key), then reloads every query so lists show the change. */
		async update(path, patch) {
			await api.notes.update(path, patch);
			await Promise.all([...stores.values()].map((s) => s.refresh()));
		},
		refreshAll: () => Promise.all([...stores.values()].map((s) => s.refresh())),
	};
}
