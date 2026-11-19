// Media shell router: which page is current, where "back" goes. Pure state; view.js owns the DOM.
// Page loaders are `() => Promise<{ default: PageMount }>`; an unknown page id falls back to "home".

export function createRouter({ pages, initial, onChange }) {
	const known = id => (typeof id === "string" && Object.prototype.hasOwnProperty.call(pages, id) ? id : "home");
	let state = { page: known(initial && initial.page), params: { ...((initial && initial.params) || {}) } };
	const history = [];
	const emit = () => { if (onChange) onChange({ page: state.page, params: state.params }); };
	return {
		go(page, params) {
			const next = { page: known(page), params: { ...(params || {}) } };
			const same = next.page === state.page && JSON.stringify(next.params) === JSON.stringify(state.params);
			if (!same) { history.push(state); if (history.length > 50) history.shift(); }
			state = next;
			emit();
		},
		back() {
			const prev = history.pop();
			if (!prev) return;
			state = prev;
			emit();
		},
		current: () => ({ page: state.page, params: state.params }),
	};
}
