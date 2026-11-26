import { button } from "./button";
import { popover, type PopoverHandle } from "./popover";
import { make } from "./states";

export interface MonthEvent {
  title: string;
  /** A short figure before the title (a rating, a time). */
  lead?: string;
  tooltip?: string;
  onClick?: (e: MouseEvent) => void;
}

export interface MonthGridOptions {
  /** Any day of the month to draw. */
  month: Date;
  /** The day marked as today. Default: now. */
  today?: Date;
  /** The events of a day of this month, by local date "YYYY-MM-DD". */
  events: (day: string) => readonly MonthEvent[];
  /** The rows a day has room for; with more events the last row says "+N more" and opens them all. Default 3. */
  max?: number;
  /** The first column: 1 (default) Monday, 0 Sunday. */
  weekStart?: 0 | 1;
}

const pad = (n: number): string => String(n).padStart(2, "0");
const isoDay = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const shift = (d: Date, n: number): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

function drawEvent(parent: HTMLElement, e: MonthEvent): void {
  const el = make(parent, e.onClick ? "a" : "div", ["hel-month-event"]);
  el.title = e.tooltip ?? e.title;
  if (e.lead !== undefined) make(el, "span", ["hel-month-event-lead"], e.lead);
  make(el, "span", ["hel-month-event-title"], e.title);
  if (e.onClick) {
    const onClick = e.onClick;
    el.setAttribute("href", "#");
    el.addEventListener("click", (ev) => {
      ev.preventDefault();
      onClick(ev);
    });
  }
}

/** A month of days in a week grid, each with its events. Every day is the same height, so nothing moves between months. */
export function monthGrid(parent: HTMLElement, o: MonthGridOptions): HTMLElement {
  const max = Math.max(1, o.max ?? 3);
  const weekStart = o.weekStart ?? 1;
  const today = isoDay(o.today ?? new Date());
  const first = new Date(o.month.getFullYear(), o.month.getMonth(), 1);
  const last = new Date(o.month.getFullYear(), o.month.getMonth() + 1, 0);
  const start = shift(first, -((first.getDay() - weekStart + 7) % 7));
  const end = shift(last, (weekStart + 6 - last.getDay() + 7) % 7);

  const el = make(parent, "div", ["hel-month"]);
  el.style.setProperty("--hel-month-rows", String(max));
  for (let i = 0; i < 7; i++) make(el, "div", ["hel-month-weekday"], shift(start, i).toLocaleDateString(undefined, { weekday: "short" }));
  let open: PopoverHandle | null = null;
  for (let d = start; d <= end; d = shift(d, 1)) {
    const iso = isoDay(d);
    const inMonth = d.getMonth() === first.getMonth();
    const cell = make(el, "div", ["hel-month-day"]);
    cell.dataset.day = iso;
    if (!inMonth) cell.classList.add("is-outside");
    if (iso === today) {
      cell.classList.add("is-today");
      cell.setAttribute("aria-current", "date");
    }
    make(cell, "div", ["hel-month-num"], String(d.getDate()));
    const slots = make(cell, "div", ["hel-month-events"]);
    if (!inMonth) continue;
    const events = o.events(iso);
    const shown = events.length > max ? events.slice(0, max - 1) : events;
    for (const e of shown) drawEvent(slots, e);
    if (events.length <= max) continue;
    const day = d;
    const more = button(slots, {
      text: `+${events.length - shown.length} more`,
      onClick: (ev) => {
        ev.stopPropagation();
        open?.close();
        open = popover(more.el, { title: `${day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · ${events.length}` });
        const list = make(open.body, "div", ["hel-month-list"]);
        for (const e of events) drawEvent(list, e);
      },
    });
    more.el.classList.add("hel-month-more");
  }
  return el;
}
