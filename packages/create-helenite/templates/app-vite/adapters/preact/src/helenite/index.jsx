// The Preact adapter: mounts a component tree and turns core.js into hooks. Everything a component imports from
// Helenite comes from here, so changing framework means changing this file and vite.adapter.mjs, not the app.
import { createContext, render } from "preact";
import { useCallback, useContext, useEffect, useMemo, useState } from "preact/hooks";
import { createNotes, select } from "./core.js";

const Ctx = createContext(null);

/**
 * Turns a root component into what Helenite imports. Works as an app's view (called with root, api) and as a page of a
 * multi-page app (called with host, ctx, where ctx.api is the api); the second argument says which.
 */
export function defineApp(Component) {
	return function mount(root, second) {
		const page = second && second.api ? second : null;
		const api = page ? page.api : second;
		const value = { api, notes: createNotes(api), page };
		render(<Ctx.Provider value={value}><Component /></Ctx.Provider>, root);
		return () => render(null, root);
	};
}

export const useApi = () => useContext(Ctx).api;
/** The multi-page shell's ctx (go, back, params, onParams, onHide, setStatus, store), or null when mounted as an app. */
export const usePage = () => useContext(Ctx).page;

/** `useNotes({ from, where, filter, sort, limit })` -> { notes, loading, error, refresh }. `from` and `where` go to the host. */
export function useNotes(spec) {
	const { notes } = useContext(Ctx);
	const key = JSON.stringify([spec.from, spec.where]);
	const store = useMemo(() => notes.query({ from: spec.from, where: spec.where }), [notes, key]); // eslint-disable-line
	const [state, setState] = useState(store.get());
	useEffect(() => { setState(store.get()); return store.subscribe(setState); }, [store]);
	const list = useMemo(() => select(state.notes, spec), [state.notes, spec.filter, spec.sort, spec.limit]); // eslint-disable-line
	return { notes: list, loading: state.status === "loading", error: state.error, refresh: store.refresh };
}

/** `useNote(path)` -> { note, body, loading, error, update(patch) }. */
export function useNote(path) {
	const { notes } = useContext(Ctx);
	const { notes: found, loading, error } = useNotes({ from: path });
	const [body, setBody] = useState(null);
	const note = found[0] ?? null;
	useEffect(() => { let on = true; notes.read(path).then((t) => on && setBody(t), () => on && setBody(null)); return () => { on = false; }; }, [notes, path, note?.mtime]);
	const update = useCallback((patch) => notes.update(path, patch), [notes, path]);
	return { note, body, loading, error, update };
}
