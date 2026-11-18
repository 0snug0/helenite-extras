import { button } from "./button";
import { renderIcon } from "./icons";
import { openMenu, type MenuItemSpec } from "./menu";
import { make, statusDot, type Tone } from "./states";

export interface ListRowAction {
  icon: string;
  label: string;
  onClick: () => void;
}

export interface ListRowOptions {
  title: string;
  icon?: string;
  /** A short faint line after the title (a time, a folder). */
  meta?: string;
  /** A small label after the title ("not installed"). */
  tag?: string;
  active?: boolean;
  dot?: { tone: Tone; label: string; pulse?: boolean };
  /** Icon buttons shown when the row is hovered, focused or active. */
  actions?: ListRowAction[];
  onClick?: (e: MouseEvent) => void;
  /** The context menu, built fresh on each right-click. */
  menu?: () => MenuItemSpec[];
  /**
   * Also emit Obsidian's file-tree classes, so a theme's look for them applies: `tree-item` (`tree-item-self
   * is-clickable nav-file-title`, as Obsidian's file explorer) or `nav-file-title` (that class alone).
   */
  obsidianClass?: "tree-item" | "nav-file-title";
}

/** A row in a sidebar pane list. Returns the row. */
export function listRow(parent: HTMLElement, o: ListRowOptions): HTMLElement {
  const tree = o.obsidianClass === "tree-item";
  const obsidian = o.obsidianClass !== undefined;
  const row = make(parent, "div", ["hel-list-row"]);
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
  if (o.meta !== undefined) make(row, "div", ["hel-list-row-meta"], o.meta);
  if (o.actions?.length) {
    const box = make(row, "div", ["hel-list-row-actions"]);
    for (const a of o.actions) {
      const b = button(box, { variant: "icon", icon: a.icon, label: a.label, onClick: (e) => (e.stopPropagation(), a.onClick()) });
      b.el.classList.add("hel-list-row-action");
    }
  }
  const { onClick, menu } = o;
  if (onClick) {
    row.tabIndex = 0;
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
