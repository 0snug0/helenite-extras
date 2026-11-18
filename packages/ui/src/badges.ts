import { renderIcon } from "./icons";
import { make, type Tone } from "./states";

export interface CountBadgeOptions {
  /** Above this the badge reads "<max>+". Default 9. */
  max?: number;
  pulse?: boolean;
  /** What is counted, for screen readers: `label: 'waiting'` reads "3 waiting". */
  label?: string;
}

export interface CountBadgeHandle {
  el: HTMLElement;
  set(n: number): void;
}

/** A small number on a tab, row or icon. Hidden at 0. */
export function countBadge(parent: HTMLElement, n: number, o: CountBadgeOptions = {}): CountBadgeHandle {
  const max = o.max ?? 9;
  const el = make(parent, "span", ["hel-count-badge"]);
  if (o.pulse) el.classList.add("is-pulse");
  // A live region, so a change is announced; the visible "9+" is hidden from readers in favour of the exact count.
  el.setAttribute("role", "status");
  const shown = make(el, "span", []);
  shown.setAttribute("aria-hidden", "true");
  const spoken = make(el, "span", ["hel-count-badge-spoken"]);
  const set = (count: number): void => {
    const n = Math.max(count, 0);
    el.hidden = n === 0;
    shown.textContent = n > max ? `${max}+` : String(n);
    spoken.textContent = o.label ? `${n} ${o.label}` : String(n);
  };
  set(n);
  return { el, set };
}

export interface ChipOptions {
  tone?: Tone;
  /** Shows a remove button. A click removes the chip, then calls this. */
  onRemove?: () => void;
  title?: string;
}

/** A tag-like label, optionally removable. */
export function chip(parent: HTMLElement, text: string, o: ChipOptions = {}): HTMLElement {
  const el = make(parent, "span", ["hel-chip", `is-${o.tone ?? "default"}`], text);
  if (o.title) el.title = o.title;
  if (o.onRemove) {
    const onRemove = o.onRemove;
    const remove = make(el, "button", ["hel-chip-remove", "clickable-icon"]) as HTMLButtonElement;
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove ${text}`);
    renderIcon(remove, "x");
    remove.addEventListener("click", (e) => {
      e.stopPropagation();
      el.remove();
      onRemove();
    });
  }
  return el;
}
