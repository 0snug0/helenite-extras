import { button } from "./button";

export interface PaneHeaderAction {
  icon: string;
  /** The accessible name and tooltip. */
  label: string;
  onClick: (e: MouseEvent) => void;
  /** Set as the button's `data-action`, for tests and snippets. */
  id?: string;
}

/** How much a list row shows: `compact` is one line, `detailed` adds a second line of details (`ui.listRow`'s `sub`). */
export type ListDensity = "compact" | "detailed";

/**
 * The pane-header button that switches a list between one line and two lines per row. Its icon and label name what a
 * click switches to. Rebuild the header after `onChange` so they follow (`paneHeader` is cheap to redo).
 */
export function densityAction(density: ListDensity, onChange: (next: ListDensity) => void): PaneHeaderAction {
  const detailed = density === "detailed";
  return {
    icon: detailed ? "align-justify" : "rows-2",
    label: detailed ? "Show one line per item" : "Show details per item",
    id: "density",
    onClick: () => onChange(detailed ? "compact" : "detailed"),
  };
}

/**
 * The icon-button row at the top of a pane (Obsidian's `nav-header` / `nav-buttons-container` / `nav-action-button`,
 * so themes style it). Placed first in `contentEl`; returns the header.
 */
export function paneHeader(contentEl: HTMLElement, actions: PaneHeaderAction[]): HTMLElement {
  const doc = contentEl.ownerDocument;
  const header = doc.createElement("div");
  header.className = "hel-pane-header nav-header";
  const bar = doc.createElement("div");
  bar.className = "nav-buttons-container";
  bar.setAttribute("role", "toolbar");
  header.appendChild(bar);
  for (const a of actions) {
    const b = button(bar, { variant: "icon", icon: a.icon, label: a.label, onClick: (e) => a.onClick(e) });
    b.el.classList.add("nav-action-button");
    if (a.id) b.el.dataset.action = a.id;
  }
  contentEl.prepend(header);
  return header;
}
