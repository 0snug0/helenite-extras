import { make } from "./states";

export interface BarChartBucket {
  /** The bucket's name: under the baseline when it is first or last, and the column's `data-key`. */
  key: string;
  /** The column's size. Zero, negative or non-finite draws no bar. */
  value: number;
  /** The column's tooltip. */
  title?: string;
  /** The name under the column when `labels` is "all" (or, as the first or last, under the baseline). Default `key`. */
  label?: string;
  /** Not reached yet (a week to come): a faint stub in place of a bar, and not selectable. */
  muted?: boolean;
}

export interface BarChartOptions {
  /** What the chart shows ("Cost per day"). The chart's accessible name. */
  label: string;
  buckets: readonly BarChartBucket[];
  /** `ends` (default) names the first and last bucket; `all` names every column. */
  labels?: "ends" | "all";
  /** Makes each column with a value a button, to list what is behind it. */
  onSelect?: (bucket: BarChartBucket) => void;
}

/** A column chart: one column per bucket, scaled to the largest, the first and last bucket named under the baseline. */
export function barChart(parent: HTMLElement, o: BarChartOptions): HTMLElement {
  const el = make(parent, "div", ["hel-bar-chart"]);
  const plot = make(el, "div", ["hel-bar-chart-plot"]);
  // With buttons inside, the plot is a group of them; otherwise one image.
  plot.setAttribute("role", o.onSelect ? "group" : "img");
  plot.setAttribute("aria-label", o.label);
  const values = o.buckets.map((b) => (Number.isFinite(b.value) && b.value > 0 ? b.value : 0));
  const top = values.reduce((a, v) => Math.max(a, v), 0);
  o.buckets.forEach((b, i) => {
    const select = o.onSelect && values[i] && !b.muted ? o.onSelect : undefined;
    const col = make(plot, select ? "button" : "div", ["hel-bar-chart-col"]);
    col.dataset.key = b.key;
    if (b.title) col.title = b.title;
    if (b.muted) col.classList.add("is-muted");
    if (select) {
      (col as HTMLButtonElement).type = "button";
      col.classList.add("is-clickable");
      col.setAttribute("aria-label", b.title ?? `${b.label ?? b.key}: ${b.value}`);
      col.addEventListener("click", () => select(b));
    }
    // A small share rounds to nothing on screen: the bar's CSS min-height keeps it visible.
    if (values[i] && !b.muted) make(col, "div", ["hel-bar-chart-bar"]).style.height = `${(values[i]! / top) * 100}%`;
  });
  const name = (b: BarChartBucket): string => b.label ?? b.key;
  if (o.buckets.length) {
    const axis = make(el, "div", ["hel-bar-chart-axis"]);
    if (o.labels === "all") {
      axis.classList.add("is-all");
      for (const b of o.buckets) make(axis, "span", [], name(b));
    } else {
      make(axis, "span", [], name(o.buckets[0]!));
      if (o.buckets.length > 1) make(axis, "span", [], name(o.buckets[o.buckets.length - 1]!));
    }
  }
  return el;
}
