// The vanilla adapter: defineApp(fn) where fn(root, { api, notes, page }) returns a cleanup, and watchNotes for data.
import { createNotes, select } from "./core.js";

let current = null;

export function defineApp(fn) {
	return function mount(root, second) {
		const page = second && second.api ? second : null;
		const api = page ? page.api : second;
		current = { api, notes: createNotes(api), page };
		return fn(root, current);
	};
}

/** Calls `cb({ notes, loading, error })` now and on every change; returns the unsubscribe. */
export function watchNotes(spec, cb) {
	const store = current.notes.query({ from: spec.from, where: spec.where });
	const emit = (s) => cb({ notes: select(s.notes, spec), loading: s.status === "loading", error: s.error, refresh: store.refresh });
	emit(store.get());
	return store.subscribe(emit);
}
