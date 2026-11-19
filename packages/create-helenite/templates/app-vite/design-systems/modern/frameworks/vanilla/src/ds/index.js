// The "modern" design system, vanilla flavour: functions that return DOM elements with the .ds-* classes of modern.css.
const cx = (...parts) => parts.filter(Boolean).join(" ");

/** h("div", { class: "x", onClick }, child, "text"): a tiny element builder; children may be nodes or strings. */
export function h(tag, props = {}, ...children) {
	const el = document.createElement(tag);
	for (const [k, v] of Object.entries(props ?? {})) {
		if (v == null || v === false) continue;
		if (k === "class") el.className = v;
		else if (k.startsWith("on")) el.addEventListener(k.slice(2).toLowerCase(), v);
		else if (k in el) el[k] = v;
		else el.setAttribute(k, v === true ? "" : v);
	}
	el.append(...children.flat().filter((c) => c != null && c !== false));
	return el;
}

export const Stack = (children, c) => h("div", { class: cx("ds-stack", c) }, children);
export const Row = (children, { between, class: c } = {}) => h("div", { class: cx("ds-row", between && "is-between", c) }, children);
/** Responsive columns: as many as fit, each at least `min` wide (a CSS length, default 14rem). */
export const Grid = (children, { min } = {}) => h("div", { class: "ds-grid", style: min ? `--ds-min: ${min}` : null }, children);
export const Title = (text) => h("h1", { class: "ds-title" }, text);
export const Muted = (text) => h("p", { class: "ds-muted" }, text);
export const Card = (children, { title, class: c } = {}) => h("section", { class: cx("ds-card", c) }, title && h("div", { class: "ds-card-header" }, title), h("div", { class: "ds-card-body" }, children));
export const Button = (label, { variant = "default", size = "md", onClick, class: c, ...p } = {}) =>
	h("button", { type: "button", class: cx("ds-button", variant !== "default" && `is-${variant}`, size === "sm" && "is-sm", c), onClick, ...p }, label);
export const Input = (props = {}) => h("input", { ...props, class: cx("ds-input", props.class) });
export const Badge = (text, { tone = "default" } = {}) => h("span", { class: cx("ds-badge", tone !== "default" && `is-${tone}`) }, text);
export const Stat = (label, value) => h("div", { class: "ds-stat" }, h("span", { class: "ds-stat-value" }, value), h("span", { class: "ds-stat-label" }, label));
export const List = (items) => h("ul", { class: "ds-list" }, items);
export const ListItem = (children, { onClick } = {}) => h("li", { class: cx("ds-list-item", onClick && "is-clickable"), onClick }, children);
export const EmptyState = (title, text) => h("div", { class: "ds-empty" }, h("span", { class: "ds-empty-title" }, title), text);

/** tabs: [{ id, label }]. Returns the element; `onChange(id)` fires on a click and the chosen tab is re-marked. */
export function Tabs(tabs, value, onChange) {
	const el = h("div", { class: "ds-tabs", role: "tablist" });
	const paint = (v) => el.replaceChildren(...tabs.map((t) => h("button", { type: "button", role: "tab", class: "ds-tab", "aria-selected": t.id === v ? "true" : "false", onClick: () => { paint(t.id); onChange(t.id); } }, t.label)));
	paint(value);
	return el;
}
