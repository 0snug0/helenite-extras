import { make } from "./states";

let checkCounter = 0;

export interface CheckOption<T extends string> {
  value: T;
  text: string;
  /** A second line under the text. */
  detail?: string;
  disabled?: boolean;
}

export interface CheckListOptions<T extends string> {
  options: CheckOption<T>[];
  value: T[];
  /** The group's accessible name, when there is no visible label (a field's label names it otherwise). */
  label?: string;
  onChange?: (v: T[]) => void;
}

export interface CheckListHandle<T extends string> {
  el: HTMLElement;
  /** The checked values, in option order. */
  value(): T[];
  /** Checks exactly these values, without calling `onChange`. */
  setValue(v: T[]): void;
}

/** Several checkboxes, each with an optional detail line: pick any number of options. */
export function checkList<T extends string>(parent: HTMLElement, o: CheckListOptions<T>): CheckListHandle<T> {
  const el = make(parent, "div", ["hel-check-list"]);
  el.setAttribute("role", "group");
  if (o.label) el.setAttribute("aria-label", o.label);
  else if (parent.classList.contains("hel-field-control") && parent.dataset.labelledby) el.setAttribute("aria-labelledby", parent.dataset.labelledby);
  const boxes: [T, HTMLInputElement][] = [];
  for (const opt of o.options) {
    const id = `hel-check-${++checkCounter}`;
    const row = make(el, "label", ["hel-check"]);
    const box = make(row, "input", []) as HTMLInputElement;
    box.type = "checkbox";
    box.checked = o.value.includes(opt.value);
    box.dataset.value = opt.value;
    const body = make(row, "span", ["hel-check-body"]);
    make(body, "span", ["hel-check-text"], opt.text);
    if (opt.detail !== undefined) {
      const detail = make(body, "span", ["hel-check-detail"], opt.detail);
      detail.id = `${id}-detail`;
      box.setAttribute("aria-describedby", detail.id);
    }
    if (opt.disabled) {
      box.disabled = true;
      row.classList.add("is-disabled");
    }
    box.addEventListener("change", () => o.onChange?.(value()));
    boxes.push([opt.value, box]);
  }
  const value = (): T[] => boxes.filter(([, b]) => b.checked).map(([v]) => v);
  return {
    el,
    value,
    setValue(v) {
      for (const [val, b] of boxes) b.checked = v.includes(val);
    },
  };
}
