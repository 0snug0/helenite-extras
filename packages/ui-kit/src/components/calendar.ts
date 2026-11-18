import { h, clear, type Handle } from "../dom";

export interface CalendarEvent { /** YYYY-MM-DD, local */ date: string; title: string; kind?: string }
export interface CalendarHandle extends Handle { setEvents(e: CalendarEvent[]): void; select(day: string): void; setStart(start: Date): void }

/** Local-date `YYYY-MM-DD` (never `toISOString`, which shifts the day by the UTC offset). */
export function isoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export const addDays = (d: Date, n: number): Date => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); return x; };

/** A strip of consecutive days with event dots and counts, for "this week" views. */
export function calendarStrip(o: { start?: Date; days?: number; events?: CalendarEvent[]; selected?: string; today?: Date; onSelect?: (day: string, events: CalendarEvent[]) => void }): CalendarHandle {
  let start = o.start ?? o.today ?? new Date();
  let events = o.events ?? [];
  let selected = o.selected;
  const n = o.days ?? 7;
  const todayIso = isoDay(o.today ?? new Date());
  const el = h("div", { cls: "hel-cal", attr: { role: "group", "aria-label": "Calendar strip" } });

  const draw = () => {
    clear(el);
    for (let i = 0; i < n; i++) {
      const d = addDays(start, i);
      const iso = isoDay(d);
      const evs = events.filter((e) => e.date === iso);
      el.append(h("button", {
        cls: ["hel-cal-day", iso === todayIso && "is-today", iso === selected && "is-selected", evs.length && "has-events"].filter(Boolean) as string[],
        attr: { type: "button", "data-day": iso, "aria-pressed": iso === selected, "aria-label": `${d.toDateString()}${evs.length ? `, ${evs.length} event${evs.length > 1 ? "s" : ""}` : ""}` },
        on: { click: () => select(iso, true) },
      },
        h("span", { cls: "hel-cal-dow", text: d.toLocaleDateString(undefined, { weekday: "short" }) }),
        h("span", { cls: "hel-cal-num", text: d.getDate() }),
        h("span", { cls: "hel-cal-dots", attr: { "aria-hidden": true } }, evs.slice(0, 3).map((e) => h("i", { cls: ["hel-dot", e.kind && `hel-dot-${e.kind}`].filter(Boolean) as string[] }))),
        evs.length > 3 ? h("span", { cls: "hel-cal-more", text: `+${evs.length - 3}` }) : null));
    }
  };
  function select(day: string, notify = false) {
    selected = day; draw();
    if (notify) o.onSelect?.(day, events.filter((e) => e.date === day));
  }
  draw();
  return { el, setEvents(e) { events = e; draw(); }, select: (d) => select(d), setStart(s) { start = s; draw(); }, destroy: () => clear(el) };
}
