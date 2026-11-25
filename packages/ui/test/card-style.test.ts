import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "../../base-theme/css/06-design-system.css"), "utf8");
const styling = readFileSync(resolve(__dirname, "../../../docs/design-system/STYLING.md"), "utf8");
const rules = css.split("\n").filter((l) => /^\.hel-(card|cards)\b/.test(l) && !/is-attention|is-sticky|is-pulse/.test(l));

describe("Finesse card styling", () => {
  it("a card is a ring with the card radius, and a transparent border so tones and attention can still colour it", () => {
    const card = rules.find((l) => l.startsWith(".hel-card {"))!;
    expect(card).toContain("box-shadow: var(--hel-ring-card)");
    expect(card).toContain("border-radius: var(--hel-card-radius)");
    expect(card).toContain("border: 1px solid transparent");
  });

  it("has a footer slot hidden while empty, and the grid raises the ring on hover and focus", () => {
    expect(css).toContain(".hel-card-footer:empty { display: none; }");
    expect(css).toContain(".hel-cards > .hel-card:hover { box-shadow: var(--hel-ring-hover)");
    expect(css).toContain(".hel-cards > .hel-card:has(.hel-card-main:focus-visible) { box-shadow: var(--hel-ring-focus); }");
  });

  it("card rules use tokens only, so light and dark follow the theme", () => {
    expect(rules.length).toBeGreaterThan(5);
    expect(rules.join("\n")).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });

  it("STYLING.md has a row for the card parts", () => {
    for (const name of ["`hel-card`", "`hel-card-head`", "`hel-card-body`", "`hel-card-footer`", "`hel-cards`"]) expect(styling).toContain(`| ${name} |`);
  });
});
