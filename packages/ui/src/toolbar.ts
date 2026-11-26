/** A row of controls (buttons, a search box, a dropdown). Returns the row; draw the controls into it. */
export function toolbar(parent: HTMLElement, o: { label?: string; sticky?: boolean } = {}): HTMLElement {
  const el = parent.ownerDocument.createElement("div");
  el.classList.add("hel-toolbar");
  if (o.sticky) el.classList.add("is-sticky"); // stays at the top of its scrolling pane (a page's navigation)
  el.setAttribute("role", "toolbar");
  if (o.label) el.setAttribute("aria-label", o.label);
  parent.appendChild(el);
  return el;
}
