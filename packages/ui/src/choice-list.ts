import { renderIcon } from "./icons";
import { badge, make } from "./states";

export interface ChoiceOption<T> {
  value: T;
  text: string;
  /** A second line under the text. */
  detail?: string;
  icon?: string;
  /** A short label after the text ("Recommended"). */
  tag?: string;
  disabled?: boolean;
  /** A key that picks this option while the list has focus; shown as a hint. */
  key?: string;
}

interface ChoiceListBase<T> {
  options: ChoiceOption<T>[];
  /** The list's accessible name. */
  label?: string;
}

/** Pick one: `onChange` gets the value. */
export interface ChoiceListSingleOptions<T> extends ChoiceListBase<T> { multi?: false; value?: T; onChange: (v: T) => void }
/** Pick any number: `onChange` gets the selected values in option order. */
export interface ChoiceListMultiOptions<T> extends ChoiceListBase<T> { multi: true; value?: T[]; onChange: (v: T[]) => void }
export type ChoiceListOptions<T> = ChoiceListSingleOptions<T> | ChoiceListMultiOptions<T>;

export interface ChoiceListHandle<T> {
  el: HTMLElement;
  /** Selects these values (one, or an array for a multi list), without calling `onChange`. */
  setValue(v: T | T[] | undefined): void;
}

/** Option rows to pick from inline, with an optional detail, icon, tag and key hint. Arrow keys move; Enter or Space picks. */
export function choiceList<T>(parent: HTMLElement, o: ChoiceListSingleOptions<T>): ChoiceListHandle<T>;
export function choiceList<T>(parent: HTMLElement, o: ChoiceListMultiOptions<T>): ChoiceListHandle<T>;
export function choiceList<T>(parent: HTMLElement, o: ChoiceListOptions<T>): ChoiceListHandle<T> {
  const el = make(parent, "div", ["hel-choice-list"]);
  el.setAttribute("role", "listbox");
  if (o.label) el.setAttribute("aria-label", o.label);
  else if (parent.classList.contains("hel-field-control") && parent.dataset.labelledby) el.setAttribute("aria-labelledby", parent.dataset.labelledby);
  if (o.multi) {
    el.classList.add("is-multi");
    el.setAttribute("aria-multiselectable", "true");
  }
  // A multi list's value is an array of values; a single list's value is one value, even when T is itself an array.
  const toSet = (v: T | T[] | undefined): Set<T> => new Set(v === undefined ? [] : o.multi ? (v as T[]) : [v as T]);
  let selected = toSet(o.value);
  const rows: [ChoiceOption<T>, HTMLElement][] = [];
  const paint = (): void => {
    for (const [opt, row] of rows) {
      const on = selected.has(opt.value);
      row.classList.toggle("is-selected", on);
      row.setAttribute("aria-selected", String(on));
    }
  };
  const pick = (opt: ChoiceOption<T>): void => {
    if (opt.disabled) return;
    if (o.multi) {
      if (selected.has(opt.value)) selected.delete(opt.value);
      else selected.add(opt.value);
      paint();
      o.onChange(o.options.map((x) => x.value).filter((v) => selected.has(v)));
    } else {
      selected = new Set([opt.value]);
      paint();
      o.onChange(opt.value);
    }
  };

  for (const opt of o.options) {
    const row = make(el, "div", ["hel-choice"]);
    row.setAttribute("role", "option");
    row.dataset.value = String(opt.value);
    row.tabIndex = opt.disabled ? -1 : 0;
    if (opt.icon) renderIcon(make(row, "span", ["hel-choice-icon"]), opt.icon);
    const body = make(row, "div", ["hel-choice-body"]);
    const title = make(body, "div", ["hel-choice-title"]);
    make(title, "span", ["hel-choice-text"], opt.text);
    if (opt.tag) badge(title, opt.tag, "accent").classList.add("hel-choice-tag");
    if (opt.detail) make(body, "div", ["hel-choice-detail"], opt.detail);
    if (opt.key) make(row, "kbd", ["hel-choice-key"], opt.key);
    if (opt.disabled) {
      row.classList.add("is-disabled");
      row.setAttribute("aria-disabled", "true");
    }
    row.addEventListener("click", () => pick(opt));
    rows.push([opt, row]);
  }
  el.addEventListener("keydown", (e) => {
    if (e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return;
    const current = rows.find(([, r]) => r === e.target);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!current) return;
      e.preventDefault();
      const enabled = rows.filter(([x]) => !x.disabled).map(([, r]) => r);
      enabled[enabled.indexOf(current[1]) + (e.key === "ArrowDown" ? 1 : -1)]?.focus({ preventScroll: true });
      return;
    }
    if ((e.key === "Enter" || e.key === " ") && current) {
      e.preventDefault();
      pick(current[0]);
      return;
    }
    const keyed = rows.find(([x]) => x.key !== undefined && x.key.toLowerCase() === e.key.toLowerCase());
    if (keyed && !keyed[0].disabled) {
      e.preventDefault();
      keyed[1].focus({ preventScroll: true });
      pick(keyed[0]);
    }
  });
  paint();
  return {
    el,
    setValue(v) {
      selected = toSet(v);
      paint();
    },
  };
}
