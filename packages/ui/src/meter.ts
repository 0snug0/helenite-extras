import { make, type Tone } from "./states";

export interface MeterOptions {
  /** What is measured ("Context", "5h"). Also the meter's accessible name. */
  label: string;
  /** How full, 0 to 100 (clamped). Leave out when only the text is known: no bar is drawn. */
  value?: number;
  /** The reading in words ("40k / 200k", "42%"). */
  text: string;
  /** Colours the bar's fill. `default` is muted. */
  tone?: Tone;
  title?: string;
}

/** A labelled usage meter on one line: the label, a short bar, the reading. */
export function meter(parent: HTMLElement, o: MeterOptions): HTMLElement {
  const el = make(parent, "span", ["hel-meter", `is-${o.tone ?? "default"}`]);
  if (o.title) el.title = o.title;
  make(el, "span", ["hel-meter-label"], o.label);
  // role="meter" needs a value, so a reading without one is left as plain text.
  if (o.value !== undefined && Number.isFinite(o.value)) {
    const pct = Math.min(100, Math.max(0, o.value));
    el.setAttribute("role", "meter");
    el.setAttribute("aria-label", o.label);
    el.setAttribute("aria-valuemin", "0");
    el.setAttribute("aria-valuemax", "100");
    el.setAttribute("aria-valuenow", String(Math.round(pct)));
    // A meter's children are not read, so the reading goes on the meter itself.
    el.setAttribute("aria-valuetext", o.text);
    const bar = make(el, "span", ["hel-meter-bar"]);
    make(bar, "span", ["hel-meter-fill"]).style.width = `${pct}%`;
  }
  make(el, "span", ["hel-meter-text"], o.text);
  return el;
}
