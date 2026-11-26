import { make, type Tone } from "./states";

interface MeterBase {
  /** What is measured ("Context", "5h"). Also the bar's accessible name. */
  label: string;
  /** How full, 0 to 100 (clamped). Leave out when only the text is known: no bar is drawn. */
  value?: number;
  /** A faint line under the meter ("resets in 3d"). Not drawn by a `bar`. */
  sub?: string;
  /** Colours the bar's fill. `default` is muted. */
  tone?: Tone;
  title?: string;
}

export type MeterOptions = MeterBase & (
  | {
      /** `inline` (the default): label, short bar and reading on one line. `stacked`: label and reading above a full-width bar. */
      layout?: "inline" | "stacked";
      /** The reading in words ("40k / 200k", "42%"). */
      text: string;
    }
  | {
      /** Only the full-width bar, for a table cell. */
      layout: "bar";
      /** The reading in words, announced; shown beside the bar with `showText`. */
      text?: string;
      showText?: boolean;
    }
);

function drawBar(parent: HTMLElement, tag: "span" | "div", o: MeterOptions): void {
  // A progressbar needs a value, so a reading without one is left as plain text.
  if (o.value === undefined || !Number.isFinite(o.value)) return;
  const pct = Math.min(100, Math.max(0, o.value));
  const bar = make(parent, tag, ["hel-meter-bar"]);
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-label", o.label);
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", "100");
  bar.setAttribute("aria-valuenow", String(Math.round(pct)));
  if (o.text) bar.setAttribute("aria-valuetext", o.text);
  make(bar, tag, ["hel-meter-fill"]).style.width = `${pct}%`;
}

/** A labelled usage meter (a quota, a budget, a context window). */
export function meter(parent: HTMLElement, o: MeterOptions): HTMLElement {
  const layout = o.layout ?? "inline";
  const tag = layout === "inline" ? "span" : "div";
  const el = make(parent, tag, ["hel-meter", `is-${o.tone ?? "default"}`, ...(layout === "inline" ? [] : [`is-${layout}`])]);
  if (o.title) el.title = o.title;
  if (o.layout === "bar") {
    drawBar(el, tag, o);
    if (o.showText) {
      el.classList.add("has-text");
      make(el, "span", ["hel-meter-text"], o.text ?? "–");
    }
    return el;
  }
  const head = layout === "stacked" ? make(el, tag, ["hel-meter-head"]) : el;
  make(head, "span", ["hel-meter-label"], o.label);
  // Inline, the reading follows the bar; stacked, it ends the head and the bar goes under both.
  if (layout === "inline") drawBar(el, tag, o);
  make(head, "span", ["hel-meter-text"], o.text);
  if (layout === "stacked") drawBar(el, tag, o);
  if (o.sub) make(el, tag, ["hel-meter-sub"], o.sub);
  return el;
}
