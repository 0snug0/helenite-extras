import { joinField } from "./field";

export interface DropdownOptions<T extends string> {
  options: { value: T; text: string }[];
  value?: T;
  /** The accessible name, when there is no visible label (a field's label names it otherwise). */
  label?: string;
  /** A shorter dropdown for toolbars and table rows. */
  compact?: boolean;
  onChange?: (v: T) => void;
}

export interface DropdownHandle<T extends string> {
  el: HTMLSelectElement;
  setValue(v: T): void;
  setDisabled(d: boolean): void;
}

/** A `<select>` with Obsidian's `dropdown` class, so a theme's dropdown look applies. */
export function dropdown<T extends string>(parent: HTMLElement, o: DropdownOptions<T>): DropdownHandle<T> {
  const doc = parent.ownerDocument;
  const el = doc.createElement("select");
  el.classList.add("hel-select", "dropdown");
  if (o.compact) el.classList.add("is-compact");
  if (o.label) el.setAttribute("aria-label", o.label);
  for (const opt of o.options) {
    const option = doc.createElement("option");
    option.value = opt.value;
    option.textContent = opt.text;
    el.appendChild(option);
  }
  if (o.value !== undefined) el.value = o.value;
  el.addEventListener("change", () => o.onChange?.(el.value as T));
  joinField(parent, el);
  parent.appendChild(el);
  return {
    el,
    setValue(v) {
      el.value = v;
    },
    setDisabled(d) {
      el.disabled = d;
    },
  };
}
