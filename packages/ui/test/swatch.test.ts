import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { swatch, type SwatchKind } from "../src";

const css = readFileSync(resolve(__dirname, "../../base-theme/css/06-design-system.css"), "utf8");
const styling = readFileSync(resolve(__dirname, "../../../docs/design-system/STYLING.md"), "utf8");
const rules = css.split("\n").filter((l) => /^\.hel-swatch/.test(l));
const rule = (selector: string) => rules.find((l) => l.startsWith(`${selector} {`)) ?? "";

const host = () => document.body.appendChild(document.createElement("div"));
const fill = (el: HTMLElement) => el.querySelector<HTMLElement>(".hel-swatch-fill")!;

afterEach(() => {
  document.body.innerHTML = "";
});

describe("swatch", () => {
  it("draws a frame with a fill, appended to the parent, classed by kind", () => {
    const h = host();
    const s = swatch(h, { kind: "color", value: "#ff0000", label: "--accent" });
    expect(h.firstElementChild).toBe(s);
    expect([...s.classList]).toEqual(["hel-swatch", "is-color"]);
    expect(s.children.length).toBe(1);
    expect(s.children[0]).toBe(fill(s));
  });

  it("sets only the property the kind previews, on the fill", () => {
    const cases: [SwatchKind, string, string][] = [
      ["color", "rgb(1, 2, 3)", "background"],
      ["radius", "8px", "border-radius"],
      ["shadow", "0px 1px 2px black", "box-shadow"],
      ["size", "12px", "width"],
      ["font-family", "monospace", "font-family"],
      ["font-size", "18px", "font-size"],
      ["font-weight", "700", "font-weight"],
    ];
    for (const [kind, value, property] of cases) {
      const s = swatch(host(), { kind, value, label: kind });
      expect(fill(s).style.getPropertyValue(property), kind).toContain(value);
      expect(s.getAttribute("style"), kind).toBeNull();
    }
  });

  it("takes a custom property as its value", () => {
    const s = swatch(host(), { kind: "radius", value: "var(--radius-m)", label: "--radius-m" });
    expect(fill(s).style.getPropertyValue("border-radius")).toBe("var(--radius-m)");
  });

  it("shows a letter pair for a font, and nothing otherwise", () => {
    for (const kind of ["font-family", "font-size", "font-weight"] as const) expect(swatch(host(), { kind, value: "x", label: "f" }).textContent).toBe("Aa");
    for (const kind of ["color", "radius", "shadow", "size"] as const) expect(swatch(host(), { kind, value: "1px", label: "f" }).textContent).toBe("");
  });

  it("is an image named by the label, with the value as its tooltip unless a title is given", () => {
    const s = swatch(host(), { kind: "color", value: "red", label: "--color-red" });
    expect(s.getAttribute("role")).toBe("img");
    expect(s.getAttribute("aria-label")).toBe("--color-red");
    expect(s.title).toBe("red");
    expect(swatch(host(), { kind: "color", value: "red", label: "Danger", title: "#f00" }).title).toBe("#f00");
  });

  it("the stylesheet draws every kind with tokens only, so light and dark follow the theme", () => {
    expect(rule(".hel-swatch")).toContain("width: 28px");
    expect(rules.join("\n")).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(/);
    for (const kind of ["radius", "shadow", "size"]) expect(css).toContain(`.hel-swatch.is-${kind}`);
    expect(css).toContain(".hel-swatch:is(.is-font-family, .is-font-size, .is-font-weight)");
  });

  it("a size bar is empty for a value CSS cannot read, and never longer than its track", () => {
    const r = rule(".hel-swatch.is-size > .hel-swatch-fill");
    expect(r).toContain("width: 0");
    expect(r).toContain("max-width: 100%");
  });

  it("the stylesheet never sets on the fill what a kind sets inline with !important", () => {
    expect(rules.join("\n")).not.toContain("!important");
  });

  it("STYLING.md has a row for each class", () => {
    for (const name of ["`hel-swatch`", "`hel-swatch-fill`"]) expect(styling).toContain(`| ${name} |`);
  });
});
