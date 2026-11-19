// The "modern" design system, Preact flavour. Plain components over the .ds-* classes in modern.css.
const cx = (...parts) => parts.filter(Boolean).join(" ");

export const Stack = ({ class: c, children, ...p }) => <div class={cx("ds-stack", c)} {...p}>{children}</div>;
export const Row = ({ between, class: c, children, ...p }) => <div class={cx("ds-row", between && "is-between", c)} {...p}>{children}</div>;
/** Responsive columns: as many as fit, each at least `min` wide (a CSS length, default 14rem). */
export const Grid = ({ min, class: c, style, children, ...p }) => <div class={cx("ds-grid", c)} style={min ? { "--ds-min": min, ...style } : style} {...p}>{children}</div>;
export const Title = ({ class: c, children, ...p }) => <h1 class={cx("ds-title", c)} {...p}>{children}</h1>;
export const Muted = ({ class: c, children, ...p }) => <p class={cx("ds-muted", c)} {...p}>{children}</p>;

export const Card = ({ title, class: c, children, ...p }) => (
	<section class={cx("ds-card", c)} {...p}>
		{title && <div class="ds-card-header">{title}</div>}
		<div class="ds-card-body">{children}</div>
	</section>
);

/** variant: "default" | "primary" | "ghost" | "danger"; size: "md" | "sm". */
export const Button = ({ variant = "default", size = "md", class: c, children, ...p }) => (
	<button type="button" class={cx("ds-button", variant !== "default" && `is-${variant}`, size === "sm" && "is-sm", c)} {...p}>{children}</button>
);

export const Input = ({ class: c, ...p }) => <input class={cx("ds-input", c)} {...p} />;

/** tone: "default" | "accent" | "success" | "danger". */
export const Badge = ({ tone = "default", class: c, children, ...p }) => <span class={cx("ds-badge", tone !== "default" && `is-${tone}`, c)} {...p}>{children}</span>;

export const Stat = ({ label, value, ...p }) => (
	<div class="ds-stat" {...p}><span class="ds-stat-value">{value}</span><span class="ds-stat-label">{label}</span></div>
);

export const List = ({ class: c, children, ...p }) => <ul class={cx("ds-list", c)} {...p}>{children}</ul>;
export const ListItem = ({ onClick, class: c, children, ...p }) => <li class={cx("ds-list-item", onClick && "is-clickable", c)} onClick={onClick} {...p}>{children}</li>;

/** tabs: [{ id, label }]; the caller owns `value` and `onChange(id)`. */
export const Tabs = ({ tabs, value, onChange }) => (
	<div class="ds-tabs" role="tablist">
		{tabs.map((t) => <button type="button" role="tab" key={t.id} class="ds-tab" aria-selected={t.id === value ? "true" : "false"} onClick={() => onChange(t.id)}>{t.label}</button>)}
	</div>
);

export const EmptyState = ({ title, children }) => <div class="ds-empty"><span class="ds-empty-title">{title}</span>{children}</div>;
