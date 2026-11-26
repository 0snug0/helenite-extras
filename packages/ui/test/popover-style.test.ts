import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const theme = (f: string): string => readFileSync(resolve(__dirname, "../../base-theme/css", f), "utf8");
const css = theme("06-design-system.css");
const styling = readFileSync(resolve(__dirname, "../../../docs/design-system/STYLING.md"), "utf8");
const rules = css.split("\n").filter((l) => /^\.hel-popover\b/.test(l));
const rule = (selector: string): string => rules.find((l) => l.startsWith(`${selector} {`)) ?? "";

describe("Finesse popover styling", () => {
  it("floats on the overlay ring above the page, with the card radius", () => {
    const base = rule(".hel-popover");
    expect(base).toContain("position: fixed");
    expect(base).toContain("z-index: var(--layer-popover)");
    expect(base).toContain("box-shadow: var(--hel-ring-overlay");
    expect(base).toContain("border-radius: var(--hel-card-radius)");
    expect(base).toContain("width: var(--hel-popover-width)");
  });

  it("wraps a long unbroken title, scrolls the body and the quote, and hides empty slots", () => {
    expect(rule(".hel-popover-title")).toContain("min-width: 0; overflow-wrap: anywhere");
    expect(rule(".hel-popover-body")).toContain("overflow: auto");
    expect(rule(".hel-popover-quote")).toContain("max-height: var(--hel-popover-quote-max-height)");
    expect(css).toContain(".hel-popover-head:empty { display: none; }");
    expect(css).toContain(".hel-popover-footer:empty { display: none; }");
  });

  it("uses tokens only, so light and dark follow the theme", () => {
    expect(rules.length).toBeGreaterThan(8);
    expect(rules.join("\n")).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
    expect(theme("01-variables.css")).toContain("--hel-popover-width: 320px;");
    expect(theme("02-colors.css").match(/--hel-ring-overlay:/g)).toHaveLength(2);
  });

  it("STYLING.md has a row for every popover part and variable", () => {
    for (const name of ["hel-popover", "hel-popover-head", "hel-popover-icon", "hel-popover-title", "hel-popover-body", "hel-popover-quote", "hel-popover-footer", "--hel-popover-width", "--hel-popover-quote-max-height"]) expect(styling).toContain(`| \`${name}\` |`);
  });
});
