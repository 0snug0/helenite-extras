import { make } from "./states";

export interface BarChartBucket {
  /** The bucket's name: under the baseline when it is first or last, and the column's `data-key`. */
  key: string;
  /** The column's size. Zero, negative or non-finite draws no bar. */
  value: number;
  /** The column's tooltip. */
  title?: string;
}

export interface BarChartOptions {
  /** What the chart shows ("Cost per day"). The chart's accessible name. */
  label: string;
  buckets: readonly BarChartBucket[];
}

/** A column chart: one column per bucket, scaled to the largest, the first and last bucket named under the baseline. */
export function barChart(parent: HTMLElement, o: BarChartOptions): HTMLElement {
  const el = make(parent, "div", ["hel-bar-chart"]);
  const plot = make(el, "div", ["hel-bar-chart-plot"]);
  plot.setAttribute("role", "img");
  plot.setAttribute("aria-label", o.label);
  const values = o.buckets.map((b) => (Number.isFinite(b.value) && b.value > 0 ? b.value : 0));
  const top = values.reduce((a, v) => Math.max(a, v), 0);
  o.buckets.forEach((b, i) => {
    const col = make(plot, "div", ["hel-bar-chart-col"]);
    col.dataset.key = b.key;
    if (b.title) col.title = b.title;
    // A small share rounds to nothing on screen: the bar's CSS min-height keeps it visible.
    if (values[i]) make(col, "div", ["hel-bar-chart-bar"]).style.height = `${(values[i]! / top) * 100}%`;
  });
  if (o.buckets.length) {
    const axis = make(el, "div", ["hel-bar-chart-axis"]);
    make(axis, "span", [], o.buckets[0]!.key);
    if (o.buckets.length > 1) make(axis, "span", [], o.buckets[o.buckets.length - 1]!.key);
  }
  return el;
}
