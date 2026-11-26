import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { meter } from "../src";

const css = readFileSync(resolve(__dirname, "../../base-theme/css/06-design-system.css"), "utf8");
const styling = readFileSync(resolve(__dirname, "../../../docs/design-system/STYLING.md"), "utf8");
const meterRules = css.split("\n").filter((l) => /^\.hel-meter/.test(l));

const host = () => document.body.appendChild(document.createElement("div"));

afterEach(() => {
  document.body.innerHTML = "";
});

describe("meter", () => {
  it("draws label, bar and text in one line, named and valued for screen readers", () => {
    const h = host();
    const m = meter(h, { label: "Context", value: 20, text: "40k / 200k" });
    expect(h.firstElementChild).toBe(m);
    expect([...m.classList]).toEqual(["hel-meter", "is-default"]);
    expect([...m.children].map((c) => c.className)).toEqual(["hel-meter-label", "hel-meter-bar", "hel-meter-text"]);
    expect(m.querySelector(".hel-meter-label")!.textContent).toBe("Context");
    expect(m.querySelector(".hel-meter-text")!.textContent).toBe("40k / 200k");
    expect(m.querySelector<HTMLElement>(".hel-meter-fill")!.style.width).toBe("20%");
    expect(m.hasAttribute("role")).toBe(false);
    const bar = m.querySelector(".hel-meter-bar")!;
    expect(bar.getAttribute("role")).toBe("progressbar");
    expect(bar.getAttribute("aria-label")).toBe("Context");
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("100");
    expect(bar.getAttribute("aria-valuenow")).toBe("20");
    expect(bar.getAttribute("aria-valuetext")).toBe("40k / 200k");
    expect(m.hasAttribute("title")).toBe(false);
  });

  it("clamps the value to 0 to 100", () => {
    for (const [value, shown] of [[140, "100"], [-5, "0"], [0, "0"]] as const) {
      const m = meter(host(), { label: "5h", value, text: "x" });
      expect(m.querySelector(".hel-meter-bar")!.getAttribute("aria-valuenow")).toBe(shown);
      expect(m.querySelector<HTMLElement>(".hel-meter-fill")!.style.width).toBe(`${shown}%`);
    }
  });

  it("keeps a fractional value for the bar and rounds what is announced", () => {
    const m = meter(host(), { label: "5h", value: 42.4, text: "42%" });
    expect(m.querySelector<HTMLElement>(".hel-meter-fill")!.style.width).toBe("42.4%");
    expect(m.querySelector(".hel-meter-bar")!.getAttribute("aria-valuenow")).toBe("42");
  });

  it("without a usable value draws no bar and claims no progressbar role; the label and text still read", () => {
    for (const value of [undefined, NaN]) {
      const m = meter(host(), { label: "Context", value, text: "40k" });
      expect(m.querySelector(".hel-meter-bar")).toBeNull();
      expect(m.querySelector("[role], [aria-label], [aria-valuenow]")).toBeNull();
      expect(m.hasAttribute("role")).toBe(false);
      expect([...m.children].map((c) => c.textContent)).toEqual(["Context", "40k"]);
    }
  });

  it("takes a tone and a tooltip", () => {
    const m = meter(host(), { label: "5h", value: 95, text: "95%", tone: "danger", title: "Resets at 14:00" });
    expect([...m.classList]).toEqual(["hel-meter", "is-danger"]);
    expect(m.title).toBe("Resets at 14:00");
  });
});

describe("stacked meter", () => {
  it("puts the label and the reading above a full-width bar, with the faint line under it", () => {
    const h = host();
    const m = meter(h, { layout: "stacked", label: "Weekly", value: 30, text: "30%", sub: "resets in 3d", tone: "warning" });
    expect(h.firstElementChild).toBe(m);
    expect(m.tagName).toBe("DIV");
    expect([...m.classList]).toEqual(["hel-meter", "is-warning", "is-stacked"]);
    expect([...m.children].map((c) => c.className)).toEqual(["hel-meter-head", "hel-meter-bar", "hel-meter-sub"]);
    expect([...m.querySelector(".hel-meter-head")!.children].map((c) => c.textContent)).toEqual(["Weekly", "30%"]);
    expect(m.querySelector(".hel-meter-sub")!.textContent).toBe("resets in 3d");
    const bar = m.querySelector(".hel-meter-bar")!;
    expect(bar.getAttribute("role")).toBe("progressbar");
    expect(bar.getAttribute("aria-label")).toBe("Weekly");
    expect(bar.getAttribute("aria-valuenow")).toBe("30");
    expect(bar.getAttribute("aria-valuetext")).toBe("30%");
  });

  it("is text only without a value, and leaves out an empty faint line", () => {
    const m = meter(host(), { layout: "stacked", label: "API (month)", text: "1k in", sub: "" });
    expect([...m.children].map((c) => c.className)).toEqual(["hel-meter-head"]);
    expect(m.querySelector("[role]")).toBeNull();
  });

  it("inline draws the faint line too, after the reading", () => {
    const m = meter(host(), { label: "5h", value: 1, text: "1%", sub: "resets in 3d" });
    expect(m.lastElementChild!.className).toBe("hel-meter-sub");
  });
});

describe("bare meter bar", () => {
  it("draws only the bar, named by the label", () => {
    const td = host();
    const m = meter(td, { layout: "bar", label: "llama3", value: 62.6, tone: "accent" });
    expect([...m.classList]).toEqual(["hel-meter", "is-accent", "is-bar"]);
    expect([...m.children].map((c) => c.className)).toEqual(["hel-meter-bar"]);
    expect(m.textContent).toBe("");
    const bar = m.firstElementChild!;
    expect(bar.getAttribute("role")).toBe("progressbar");
    expect(bar.getAttribute("aria-label")).toBe("llama3");
    expect(bar.getAttribute("aria-valuenow")).toBe("63");
    expect(bar.hasAttribute("aria-valuetext")).toBe(false);
  });

  it("announces a reading when given one, without showing it", () => {
    const m = meter(host(), { layout: "bar", label: "llama3", value: 5, text: "2.5k tokens", sub: "not drawn" });
    expect(m.textContent).toBe("");
    expect(m.firstElementChild!.getAttribute("aria-valuetext")).toBe("2.5k tokens");
  });
});

describe("Finesse meter styling", () => {
  it("is inline, with a short bar on the progress track", () => {
    expect(meterRules.find((l) => l.startsWith(".hel-meter {"))).toContain("display: inline-flex");
    const bar = meterRules.find((l) => l.startsWith(".hel-meter-bar {"))!;
    expect(bar).toContain("width: var(--hel-meter-width, 56px)");
    expect(bar).toContain("var(--hel-progress-track");
  });

  it("stacked and bare bars fill the width, 6px thick", () => {
    const rule = meterRules.find((l) => l.startsWith(".hel-meter:is(.is-stacked, .is-bar) .hel-meter-bar {"))!;
    expect(rule).toContain("width: 100%");
    expect(rule).toContain("height: var(--hel-meter-height, 6px)");
    expect(meterRules.find((l) => l.startsWith(".hel-meter.is-stacked {"))).toContain("flex-direction: column");
    expect(meterRules.find((l) => l.startsWith(".hel-meter-sub {"))).toContain("var(--text-muted)");
  });

  it("puts an inline meter's faint line on its own row", () => {
    expect(meterRules.find((l) => l.startsWith(".hel-meter:not(.is-stacked):has(> .hel-meter-sub) {"))).toContain("flex-wrap: wrap");
    expect(meterRules.find((l) => l.startsWith(".hel-meter:not(.is-stacked) > .hel-meter-sub {"))).toContain("flex-basis: 100%");
  });

  it("each tone colours the fill", () => {
    for (const tone of ["accent", "success", "warning", "danger"]) expect(meterRules.join("\n")).toContain(`.hel-meter.is-${tone} .hel-meter-fill {`);
  });

  it("uses tokens only, so light and dark follow the theme", () => {
    expect(meterRules.length).toBeGreaterThan(0);
    expect(meterRules.join("\n")).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(/);
  });

  it("STYLING.md has a row for each class and variable", () => {
    for (const name of ["`hel-meter`", "`hel-meter-label`", "`hel-meter-bar`", "`hel-meter-fill`", "`hel-meter-text`", "`hel-meter-head`", "`hel-meter-sub`", "`--hel-meter-width`", "`--hel-meter-height`"]) expect(styling).toContain(`| ${name} |`);
  });
});
