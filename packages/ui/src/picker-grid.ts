import { renderIcon } from "./icons";
import { make } from "./states";

export interface PickerOption<T> {
  value: T;
  /** The cell's accessible name and tooltip. */
  label: string;
  /** An icon cell draws this Lucide icon. */
  icon?: string;
  /** A colour cell draws a round dot filled with this CSS value (any background). */
  color?: string;
}

export interface PickerGridOptions<T> {
  options: PickerOption<T>[];
  /** The checked option's value; none by default. Values are compared with `===`. */
  value?: T;
  /** The grid's accessible name. */
  label?: string;
  onChange: (v: T) => void;
}

export interface PickerGridHandle<T> {
  el: HTMLElement;
  /** Checks this value (nothing for undefined or a value no option has), without calling `onChange`. */
  setValue(v: T | undefined): void;
}

/**
 * Picks one icon or colour from a grid: a radio group with one Tab stop. Arrow keys move and pick (up and down by a
 * row), Home and End jump to the ends; a click picks.
 */
export function pickerGrid<T>(parent: HTMLElement, o: PickerGridOptions<T>): PickerGridHandle<T> {
  const el = make(parent, "div", ["hel-picker-grid"]);
  el.setAttribute("role", "radiogroup");
  if (o.label) el.setAttribute("aria-label", o.label);
  else if (parent.classList.contains("hel-field-control") && parent.dataset.labelledby) el.setAttribute("aria-labelledby", parent.dataset.labelledby);
  let current = o.value;
  const cells: HTMLButtonElement[] = [];
  const paint = (): void => {
    const checked = o.options.findIndex((x) => x.value === current);
    cells.forEach((cell, i) => {
      cell.setAttribute("aria-checked", String(i === checked));
      cell.tabIndex = i === Math.max(checked, 0) ? 0 : -1;
    });
  };
  const pick = (i: number): void => {
    const { value } = o.options[i]!;
    if (value === current) return;
    current = value;
    paint();
    o.onChange(value);
  };
  o.options.forEach((opt, i) => {
    const cell = make(el, "button", ["hel-picker-cell"]) as HTMLButtonElement;
    cell.type = "button";
    cell.setAttribute("role", "radio");
    cell.setAttribute("aria-label", opt.label);
    cell.title = opt.label;
    if (opt.color !== undefined) {
      cell.classList.add("is-color");
      const dot = make(cell, "span", ["hel-picker-dot"]);
      dot.setAttribute("aria-hidden", "true");
      dot.style.background = opt.color;
    } else if (opt.icon) renderIcon(make(cell, "span", ["hel-picker-icon"]), opt.icon);
    cell.addEventListener("click", () => pick(i));
    cells.push(cell);
  });

  /** The cell one row up or down from `from`, nearest across; with a single row, the previous or next cell. */
  const rowStep = (from: number, by: 1 | -1): number => {
    const tops = [...new Set(cells.map((c) => c.offsetTop))].sort((a, b) => a - b);
    if (tops.length < 2) return (from + by + cells.length) % cells.length;
    const top = tops[tops.indexOf(cells[from]!.offsetTop) + by];
    const away = (i: number): number => Math.abs(cells[i]!.offsetLeft - cells[from]!.offsetLeft);
    return cells.reduce((best, c, i) => (c.offsetTop === top && (best === from || away(i) < away(best)) ? i : best), from);
  };
  el.addEventListener("keydown", (e) => {
    if (e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return;
    const from = cells.indexOf(e.target as HTMLButtonElement);
    if (from < 0) return;
    const count = cells.length;
    let to: number;
    if (e.key === "ArrowRight") to = (from + 1) % count;
    else if (e.key === "ArrowLeft") to = (from - 1 + count) % count;
    else if (e.key === "ArrowDown") to = rowStep(from, 1);
    else if (e.key === "ArrowUp") to = rowStep(from, -1);
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = count - 1;
    else return;
    e.preventDefault();
    cells[to]!.focus();
    pick(to);
  });
  paint();
  return {
    el,
    setValue(v) {
      current = v;
      paint();
    },
  };
}
