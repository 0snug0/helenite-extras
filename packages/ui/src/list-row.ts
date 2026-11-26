import { chip, countBadge, type CountBadgeOptions } from "./badges";
import { button } from "./button";
import { renderIcon } from "./icons";
import { openMenu, type MenuItemSpec } from "./menu";
import { badge, make, statusDot, type Tone } from "./states";

export interface ListRowAction {
  icon: string;
  label: string;
  onClick: () => void;
  /** Set as the button's `data-action`, for tests and snippets. */
  id?: string;
}

export interface ListRowChip {
  text: string;
  tone?: Tone;
  /** The tooltip. Default: the text, so a cut chip can still be read. */
  title?: string;
}

/** With more chips than this plus one, the row shows this many and counts the rest ("+3"), so a line never ends in a lone "+1". */
const ROW_CHIPS = 3;

export interface ListRowOptions {
  title: string;
  icon?: string;
  /** A short faint line after the title (a time, a folder). */
  meta?: string;
  /** A second, faint line under the title (details). Gives the row two lines. */
  sub?: string;
  /** A small label after the title ("not installed"). */
  tag?: string;
  /** A toned badge with words after the title (a CI result, "Failing"). `title` is its tooltip, default the text. */
  status?: { text: string; tone?: Tone; title?: string };
  /**
   * A line of tag chips under the row (labels), after `sub`. The chips share one line and are cut with an ellipsis;
   * five or more show three and a "+N" whose tooltip names the rest.
   */
  chips?: (string | ListRowChip)[];
  /** A count badge after the title, before the meta (open questions). Hidden at 0, as `countBadge`. */
  badge?: { count: number } & CountBadgeOptions;
  /** A trailing chevron: the row opens something (a detail, a sub-page), as in a settings list. */
  chevron?: boolean;
  active?: boolean;
  dot?: { tone: Tone; label: string; pulse?: boolean };
  /** Icon buttons shown when the row is hovered, focused or active. */
  actions?: ListRowAction[];
  onClick?: (e: MouseEvent) => void;
  /** The context menu, built fresh on each right-click. */
  menu?: () => MenuItemSpec[];
  /**
   * Also emit Obsidian's file-tree classes, so a theme's look for them applies: `tree-item` (`tree-item-self
   * is-clickable nav-file-title`, as Obsidian's file explorer) or `nav-file-title` (that class alone, in a `nav-file`
   * wrapper, as Obsidian draws a file row).
   */
  obsidianClass?: "tree-item" | "nav-file-title";
}

/** A row in a sidebar pane list. Returns the row. */
export function listRow(parent: HTMLElement, o: ListRowOptions): HTMLElement {
  const tree = o.obsidianClass === "tree-item";
  const obsidian = o.obsidianClass !== undefined;
  // Obsidian's file rows sit in a `nav-file` element; themes style the pair.
  const host = o.obsidianClass === "nav-file-title" ? make(parent, "div", ["nav-file"]) : parent;
  const row = make(host, "div", ["hel-list-row"]);
  if (tree) row.classList.add("tree-item-self", "is-clickable");
  if (obsidian) row.classList.add("nav-file-title");
  if (o.active) row.classList.add("is-active");
  row.title = o.title;
  if (o.icon) renderIcon(make(row, "span", ["hel-list-row-icon"]), o.icon);
  if (o.dot) statusDot(row, o.dot.tone, o.dot.label, { pulse: o.dot.pulse });
  const title = make(row, "div", ["hel-list-row-title"], o.title);
  if (tree) title.classList.add("tree-item-inner");
  if (obsidian) title.classList.add("nav-file-title-content");
  if (o.tag !== undefined) {
    const tag = make(row, "span", ["hel-list-row-tag"], o.tag);
    if (obsidian) tag.classList.add("nav-file-tag");
  }
  if (o.status) {
    const status = badge(row, o.status.text, o.status.tone);
    status.classList.add("hel-list-row-status");
    status.title = o.status.title ?? o.status.text;
  }
  if (o.badge) {
    const { count, ...badge } = o.badge;
    countBadge(row, count, badge);
  }
  if (o.meta !== undefined) make(row, "div", ["hel-list-row-meta"], o.meta);
  if (o.chevron) {
    const chevron = make(row, "span", ["hel-list-row-chevron"]);
    chevron.setAttribute("aria-hidden", "true");
    renderIcon(chevron, "chevron-right");
  }
  const chips = (o.chips ?? []).map((c): ListRowChip => (typeof c === "string" ? { text: c } : c));
  if (o.dot && (o.sub || chips.length)) row.classList.add("has-dot");
  if (o.sub) {
    row.classList.add("has-sub");
    make(row, "div", ["hel-list-row-sub"], o.sub);
  }
  if (chips.length) {
    row.classList.add("has-chips");
    const line = make(row, "div", ["hel-list-row-chips"]);
    const shown = chips.length > ROW_CHIPS + 1 ? chips.slice(0, ROW_CHIPS) : chips;
    for (const c of shown) chip(line, c.text, { tone: c.tone, title: c.title ?? c.text });
    const rest = chips.slice(shown.length);
    if (rest.length) {
      chip(line, `+${rest.length}`, { title: rest.map((c) => c.text).join(", ") }).classList.add("hel-list-row-chips-more");
    }
  }
  if (o.actions?.length) {
    const box = make(row, "div", ["hel-list-row-actions"]);
    for (const a of o.actions) {
      const b = button(box, { variant: "icon", icon: a.icon, label: a.label, onClick: (e) => (e.stopPropagation(), a.onClick()) });
      b.el.classList.add("hel-list-row-action");
      if (a.id) b.el.dataset.action = a.id;
    }
  }
  const { onClick, menu } = o;
  if (onClick) {
    row.tabIndex = 0;
    row.setAttribute("role", obsidian ? "treeitem" : "button");
    row.addEventListener("click", onClick);
    row.addEventListener("keydown", (e) => {
      // Keys on an action button stay with the button.
      if (e.target !== row || (e.key !== "Enter" && e.key !== " ")) return;
      e.preventDefault();
      row.click();
    });
  }
  if (menu) {
    row.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      openMenu(menu(), e);
    });
  }
  return row;
}

let groupCounter = 0;

export interface ListGroupOptions {
  title: string;
  count?: number;
  collapsed?: boolean;
  /** Gets the new state (`true` when now collapsed). */
  onToggle?: (collapsed: boolean) => void;
}

/** A collapsible group of list rows: a header with a chevron, title and count, and a body for the rows. */
export function listGroup(parent: HTMLElement, o: ListGroupOptions): { el: HTMLElement; body: HTMLElement } {
  const el = make(parent, "div", ["hel-list-group"]);
  const header = make(el, "div", ["hel-list-group-header"]);
  header.setAttribute("role", "button");
  header.tabIndex = 0;
  const chevron = make(header, "span", ["hel-list-group-chevron", "collapse-icon"]);
  renderIcon(chevron, "chevron-down");
  make(header, "span", ["hel-list-group-title"], o.title);
  if (o.count !== undefined) make(header, "span", ["hel-list-group-count"], String(o.count));
  const body = make(el, "div", ["hel-list-group-body"]);
  body.id = `hel-list-group-${++groupCounter}-body`;
  header.setAttribute("aria-controls", body.id);
  let collapsed = o.collapsed ?? false;
  const paint = (): void => {
    el.classList.toggle("is-collapsed", collapsed);
    chevron.classList.toggle("is-collapsed", collapsed);
    header.setAttribute("aria-expanded", String(!collapsed));
    body.hidden = collapsed;
  };
  const toggle = (): void => {
    collapsed = !collapsed;
    paint();
    o.onToggle?.(collapsed);
  };
  header.addEventListener("click", toggle);
  header.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    toggle();
  });
  paint();
  return { el, body };
}
