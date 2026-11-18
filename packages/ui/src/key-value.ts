import { badge, make } from "./states";

export interface KeyValueRow {
  key: string;
  /** Text, a list of items, or a node drawn as given. */
  value: string | string[] | Node;
  /** Shown (with `is-empty`) when the value is "" or []. Default "None". */
  empty?: string;
  /** Marks a list item as new (`is-new`, and a "new" badge), as in a permission review. */
  isNew?: (item: string) => boolean;
}

/** A definition list: a key and its value per row. */
export function keyValue(parent: HTMLElement, rows: KeyValueRow[]): HTMLElement {
  const el = make(parent, "dl", ["hel-kv"]);
  for (const r of rows) {
    const row = make(el, "div", ["hel-kv-row"]);
    make(row, "dt", ["hel-kv-key"], r.key);
    const value = make(row, "dd", ["hel-kv-value"]);
    const v = r.value;
    if (typeof v === "string" ? v === "" : Array.isArray(v) && v.length === 0) {
      value.classList.add("is-empty");
      value.textContent = r.empty ?? "None";
    } else if (typeof v === "string") {
      value.textContent = v;
    } else if (Array.isArray(v)) {
      const list = make(value, "ul", []);
      for (const item of v) {
        const li = make(list, "li", [], item);
        if (r.isNew?.(item)) {
          li.classList.add("is-new");
          li.append(" ");
          badge(li, "new", "accent");
        }
      }
    } else {
      value.appendChild(v);
    }
  }
  return el;
}
