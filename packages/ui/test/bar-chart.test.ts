import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { barChart } from "../src";

const css = readFileSync(resolve(__dirname, "../../base-theme/css/06-design-system.css"), "utf8");
const styling = readFileSync(resolve(__dirname, "../../../docs/design-system/STYLING.md"), "utf8");
const chartRules = css.split("\n").filter((l) => /^\.hel-bar-chart/.test(l));
const rule = (selector: string) => chartRules.find((l) => l.startsWith(`${selector} {`)) ?? "";

const host = () => document.body.appendChild(document.createElement("div"));
const cols = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>(".hel-bar-chart-col")];
const heights = (el: HTMLElement) => cols(el).map((c) => c.querySelector<HTMLElement>(".hel-bar-chart-bar")?.style.height ?? null);
const axis = (el: HTMLElement) => [...el.querySelectorAll(".hel-bar-chart-axis > span")].map((s) => s.textContent);
const days = (...values: number[]) => values.map((value, i) => ({ key: `d${i}`, value }));

afterEach(() => {
  document.body.innerHTML = "";
});

describe("barChart", () => {
  it("draws one column per bucket, named as an image for screen readers", () => {
    const h = host();
    const c = barChart(h, { label: "Cost per day", buckets: [{ key: "Nov 24", value: 1, title: "Nov 24: $1.00" }, { key: "Nov 25", value: 2 }] });
    expect(h.firstElementChild).toBe(c);
    expect(c.className).toBe("hel-bar-chart");
    expect([...c.children].map((x) => x.className)).toEqual(["hel-bar-chart-plot", "hel-bar-chart-axis"]);
    const plot = c.querySelector(".hel-bar-chart-plot")!;
    expect(plot.getAttribute("role")).toBe("img");
    expect(plot.getAttribute("aria-label")).toBe("Cost per day");
    expect(cols(c).map((x) => x.dataset.key)).toEqual(["Nov 24", "Nov 25"]);
    expect(cols(c).map((x) => x.getAttribute("title"))).toEqual(["Nov 24: $1.00", null]);
  });

  it("scales the bars to the largest bucket, however small it is", () => {
    expect(heights(barChart(host(), { label: "x", buckets: days(5, 10, 2.5) }))).toEqual(["50%", "100%", "25%"]);
    expect(heights(barChart(host(), { label: "x", buckets: days(0.0001, 0.0002) }))).toEqual(["50%", "100%"]);
  });

  it("draws a bar for every non-zero bucket and none for a zero one", () => {
    const c = barChart(host(), { label: "x", buckets: days(0, 1, 100000) });
    expect(heights(c)[0]).toBeNull();
    expect(heights(c)[1]).toBe("0.001%");
    expect(rule(".hel-bar-chart-bar")).toContain("min-height: 2px");
  });

  it("treats a negative or non-finite value as nothing, without upsetting the scale", () => {
    expect(heights(barChart(host(), { label: "x", buckets: days(-4, NaN, Infinity, 2, 4) }))).toEqual([null, null, null, "50%", "100%"]);
    expect(heights(barChart(host(), { label: "x", buckets: days(0, 0) }))).toEqual([null, null]);
  });

  it("labels the first and last bucket under the baseline", () => {
    expect(axis(barChart(host(), { label: "x", buckets: days(1, 2, 3) }))).toEqual(["d0", "d2"]);
    expect(axis(barChart(host(), { label: "x", buckets: days(1) }))).toEqual(["d0"]);
  });

  it("with no buckets draws the empty plot and no labels", () => {
    const c = barChart(host(), { label: "x", buckets: [] });
    expect(cols(c)).toHaveLength(0);
    expect(c.querySelector(".hel-bar-chart-axis")).toBeNull();
  });
});

describe("Finesse bar chart styling", () => {
  it("stands the columns on a baseline, in the accent colour", () => {
    expect(rule(".hel-bar-chart-plot")).toContain("height: var(--hel-bar-chart-height, 110px)");
    expect(rule(".hel-bar-chart-plot")).toContain("align-items: flex-end");
    expect(rule(".hel-bar-chart-plot")).toContain("border-bottom: 1px solid var(--background-modifier-border)");
    expect(rule(".hel-bar-chart-bar")).toContain("var(--hel-bar-chart-color, var(--interactive-accent))");
    expect(rule(".hel-bar-chart-axis")).toContain("justify-content: space-between");
  });

  it("lets many columns share a narrow pane", () => {
    expect(rule(".hel-bar-chart-col")).toContain("flex: 1 1 0");
    expect(rule(".hel-bar-chart-col")).toContain("min-width: 1px");
  });

  it("keeps a clickable column's layout over the base theme's button rule, which is no less specific", () => {
    const button = css.split("\n").find((l) => l.startsWith("button.hel-bar-chart-col {")) ?? "";
    for (const d of ["display: flex;", "flex-direction: column;", "align-items: stretch;", "justify-content: flex-end;", "gap: 0;", "height: 100%;"]) expect(button).toContain(d);
  });

  it("uses tokens only, so light and dark follow the theme", () => {
    expect(chartRules.length).toBeGreaterThan(0);
    expect(chartRules.join("\n")).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(/);
  });

  it("STYLING.md has a row for each class and variable", () => {
    for (const name of ["`hel-bar-chart`", "`hel-bar-chart-plot`", "`hel-bar-chart-col`", "`hel-bar-chart-bar`", "`hel-bar-chart-axis`", "`--hel-bar-chart-height`", "`--hel-bar-chart-color`"]) expect(styling).toContain(`| ${name} |`);
  });
});
