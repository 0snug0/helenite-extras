import { renderIcon } from "./icons";
import { make } from "./states";

export interface Figure {
  /** The figure as written ("4.1", "92%"). */
  text: string;
  /** What it measures ("Critics score"): the tooltip and the accessible name's start. */
  label?: string;
  /** A Lucide icon name, or a node drawn as given (a brand mark). */
  icon?: string | Node;
  /** Makes the figure a link that calls this. */
  onClick?: () => void;
  /** Set as `data-key`, for tests and snippets. */
  key?: string;
}

export interface FiguresOptions {
  /** A fixed number of columns, spread to the edges. Default: one wrapping row, centred. */
  columns?: 2;
}

/** A group of small figures with icons (ratings, scores), some linking out. */
export function figures(parent: HTMLElement, items: readonly Figure[], o: FiguresOptions = {}): HTMLElement {
  const el = make(parent, "div", ["hel-figures"]);
  if (o.columns) el.classList.add("is-columns");
  for (const f of items) {
    const item = make(el, f.onClick ? "a" : "span", ["hel-figure"]);
    if (f.key) item.dataset.key = f.key;
    if (f.label) {
      item.title = f.label;
      item.setAttribute("aria-label", `${f.label}: ${f.text}`);
    }
    if (f.icon !== undefined) {
      const icon = make(item, "span", ["hel-figure-icon"]);
      icon.setAttribute("aria-hidden", "true");
      if (typeof f.icon === "string") renderIcon(icon, f.icon);
      else icon.appendChild(f.icon);
    }
    make(item, "span", ["hel-figure-text"], f.text);
    if (f.onClick) {
      const onClick = f.onClick;
      item.setAttribute("href", "#");
      item.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      });
    }
  }
  return el;
}

export interface RatingOptions {
  /** 0 to `max`, in halves or any fraction. Nothing (or 0) draws an empty space the same height. */
  value?: number | null;
  /** The number of stars. Default 5. */
  max?: number;
}

/** A read-only star rating, partly filled for a fraction. */
export function rating(parent: HTMLElement, o: RatingOptions): HTMLElement {
  const max = o.max ?? 5;
  const el = make(parent, "span", ["hel-rating"]);
  el.setAttribute("role", "img");
  const value = typeof o.value === "number" && Number.isFinite(o.value) && o.value > 0 ? Math.min(o.value, max) : 0;
  if (!value) {
    el.classList.add("is-none");
    el.setAttribute("aria-label", "Not rated");
    return el;
  }
  el.setAttribute("aria-label", `${value} of ${max} stars`);
  el.title = `${value} / ${max}`;
  const stars = "★".repeat(max);
  make(el, "span", ["hel-rating-base"], stars);
  make(el, "span", ["hel-rating-fill"], stars).style.width = `${(value / max) * 100}%`;
  return el;
}

export interface StatTile {
  /** The headline number. */
  value: string;
  /** What it counts. */
  label: string;
  title?: string;
  /** Makes the tile a button (to list what is behind the number). */
  onClick?: () => void;
}

/** A row of headline numbers, each over its name. */
export function statTiles(parent: HTMLElement, tiles: readonly StatTile[]): HTMLElement {
  const el = make(parent, "div", ["hel-stats"]);
  for (const t of tiles) {
    const tile = make(el, t.onClick ? "button" : "div", ["hel-stat"]);
    if (t.onClick) {
      (tile as HTMLButtonElement).type = "button";
      tile.classList.add("is-clickable");
      tile.addEventListener("click", t.onClick);
    }
    if (t.title) tile.title = t.title;
    make(tile, "span", ["hel-stat-value"], t.value);
    make(tile, "span", ["hel-stat-label"], t.label);
  }
  return el;
}

export interface SectionHeadingOptions {
  title: string;
  /** A short note at the end of the line ("avg 3.8"). */
  extra?: string;
  /** The heading's level: 1 for a page title, 2 (default) for a section, 3 for a part of one. */
  level?: 1 | 2 | 3;
}

export interface SectionHeadingHandle {
  el: HTMLElement;
  /** The `<h1>` to `<h3>`. */
  titleEl: HTMLElement;
  /** At the end of the line, for buttons. Not shown while empty. */
  actions: HTMLElement;
}

/** A page or section title with room for a note and buttons at the end of its line. */
export function sectionHeading(parent: HTMLElement, o: SectionHeadingOptions): SectionHeadingHandle {
  const level = o.level ?? 2;
  const el = make(parent, "div", ["hel-heading", `is-level-${level}`]);
  const titleEl = make(el, `h${level}`, ["hel-heading-title"], o.title);
  if (o.extra !== undefined) make(el, "span", ["hel-heading-extra"], o.extra);
  const actions = make(el, "div", ["hel-heading-actions"]);
  return { el, titleEl, actions };
}
