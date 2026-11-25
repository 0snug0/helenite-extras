import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "../../base-theme/css/06-design-system.css"), "utf8");
const styling = readFileSync(resolve(__dirname, "../../../docs/design-system/STYLING.md"), "utf8");
const block = css.slice(css.indexOf("/* settings: sub-pages"), css.indexOf("/* notice variants"));

describe("Finesse settings parts", () => {
  it("styles the sub-page header, Back, summary rows, scope bar and vault-scope list", () => {
    for (const sel of [".hel-subpage-header", ".hel-subpage-back", ".hel-subpage-title", ".hel-summary-row.is-clickable:hover", ".hel-summary-row.is-clickable:has(:focus-visible)", ".hel-scope-bar.is-defaults", ".hel-scope-bar-hint", ".hel-vault-scope-list"]) expect(block).toContain(sel);
  });

  it("keeps the sub-page header on screen while the page scrolls, over a hairline token", () => {
    expect(block).toMatch(/\.hel-subpage-header \{[^}]*position: sticky;/);
    expect(block).toContain("var(--hel-subpage-header-border, var(--background-modifier-border))");
    expect(block).toContain("var(--hel-subpage-header-bg, var(--background-primary))");
  });

  it("draws the scope bar with the Finesse ring, and an accent wash while it edits the Vault Defaults", () => {
    expect(block).toMatch(/\.hel-scope-bar \{[^}]*box-shadow: var\(--hel-ring\)/);
    expect(block).toContain("var(--hel-scope-bar-defaults-bg, hsla(var(--interactive-accent-hsl), 0.08))");
  });

  it("uses tokens only, so light and dark follow the theme", () => {
    expect(block.length).toBeGreaterThan(0);
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });

  it("keeps the setting-item classes for theme parity (no rule replaces them)", () => {
    expect(block).not.toMatch(/^\.setting-item(-name|-description|-control)? \{/m);
  });

  it("fades a disabled row's name and description and makes its controls non-interactive", () => {
    expect(block).toMatch(/\.setting-item\.is-disabled > \.setting-item-info \{[^}]*opacity: 0\.5;/);
    expect(block).toMatch(/\.setting-item\.is-disabled > \.setting-item-control \{[^}]*pointer-events: none;/);
    // The controls fade through their own disabled look; fading the row or the control cell too would double it.
    expect(block).not.toMatch(/\.setting-item\.is-disabled(?: > \.setting-item-control)? \{[^}]*opacity/);
    expect(styling).toContain("| `setting-item is-disabled` |");
  });

  it("STYLING.md has a row for each new class and variable", () => {
    for (const name of ["`hel-subpage-back`", "`hel-scope-bar-hint`", "`--hel-subpage-header-bg`", "`--hel-subpage-header-border`", "`--hel-summary-row-radius`", "`--hel-scope-bar-bg`", "`--hel-scope-bar-defaults-bg`", "`--hel-vault-scope-rail`"]) expect(styling).toContain(`| ${name} |`);
  });
});
