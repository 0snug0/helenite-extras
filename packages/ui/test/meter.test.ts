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
    expect(m.getAttribute("role")).toBe("meter");
    expect(m.getAttribute("aria-label")).toBe("Context");
    expect(m.getAttribute("aria-valuemin")).toBe("0");
    expect(m.getAttribute("aria-valuemax")).toBe("100");
    expect(m.getAttribute("aria-valuenow")).toBe("20");
    expect(m.getAttribute("aria-valuetext")).toBe("40k / 200k");
    expect(m.hasAttribute("title")).toBe(false);
  });

  it("clamps the value to 0 to 100", () => {
    for (const [value, shown] of [[140, "100"], [-5, "0"], [0, "0"]] as const) {
      const m = meter(host(), { label: "5h", value, text: "x" });
      expect(m.getAttribute("aria-valuenow")).toBe(shown);
      expect(m.querySelector<HTMLElement>(".hel-meter-fill")!.style.width).toBe(`${shown}%`);
    }
  });

  it("keeps a fractional value for the bar and rounds what is announced", () => {
    const m = meter(host(), { label: "5h", value: 42.4, text: "42%" });
    expect(m.querySelector<HTMLElement>(".hel-meter-fill")!.style.width).toBe("42.4%");
    expect(m.getAttribute("aria-valuenow")).toBe("42");
  });

  it("without a usable value draws no bar and claims no meter role; the label and text still read", () => {
    for (const value of [undefined, NaN]) {
      const m = meter(host(), { label: "Context", value, text: "40k" });
      expect(m.querySelector(".hel-meter-bar")).toBeNull();
      for (const a of ["role", "aria-label", "aria-valuenow", "aria-valuemin", "aria-valuemax", "aria-valuetext"]) expect(m.hasAttribute(a), a).toBe(false);
      expect([...m.children].map((c) => c.textContent)).toEqual(["Context", "40k"]);
    }
  });

  it("takes a tone and a tooltip", () => {
    const m = meter(host(), { label: "5h", value: 95, text: "95%", tone: "danger", title: "Resets at 14:00" });
    expect([...m.classList]).toEqual(["hel-meter", "is-danger"]);
    expect(m.title).toBe("Resets at 14:00");
  });
});

describe("Finesse meter styling", () => {
  it("is inline, with a short bar on the progress track", () => {
    expect(meterRules.find((l) => l.startsWith(".hel-meter {"))).toContain("display: inline-flex");
    const bar = meterRules.find((l) => l.startsWith(".hel-meter-bar {"))!;
    expect(bar).toContain("width: var(--hel-meter-width, 56px)");
    expect(bar).toContain("var(--hel-progress-track");
  });

  it("each tone colours the fill", () => {
    for (const tone of ["accent", "success", "warning", "danger"]) expect(meterRules.join("\n")).toContain(`.hel-meter.is-${tone} .hel-meter-fill {`);
  });

  it("uses tokens only, so light and dark follow the theme", () => {
    expect(meterRules.length).toBeGreaterThan(0);
    expect(meterRules.join("\n")).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(/);
  });

  it("STYLING.md has a row for each class and variable", () => {
    for (const name of ["`hel-meter`", "`hel-meter-label`", "`hel-meter-bar`", "`hel-meter-fill`", "`hel-meter-text`", "`--hel-meter-width`", "`--hel-meter-height`"]) expect(styling).toContain(`| ${name} |`);
  });
});
