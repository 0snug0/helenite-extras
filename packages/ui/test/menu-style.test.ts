import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "../../base-theme/css/06-design-system.css"), "utf8");
const styling = readFileSync(resolve(__dirname, "../../../docs/design-system/STYLING.md"), "utf8");
const rules = css.split("\n").filter((l) => /^\.menu\b/.test(l)).join("\n");

describe("Finesse menu", () => {
  it("styles the panel, items, check, separator and danger items", () => {
    for (const sel of [".menu {", ".menu .menu-item.mod-checked", ".menu .menu-item.is-danger:hover", ".menu .menu-item.is-disabled", ".menu .menu-separator", ".menu .menu-item-icon"]) expect(rules).toContain(sel);
    expect(rules).toContain("var(--hel-ring-overlay, var(--shadow-l))");
  });

  it("uses tokens only, so light and dark follow the theme", () => {
    expect(rules.length).toBeGreaterThan(0);
    expect(rules).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(/);
  });

  it("declares the radius tokens and documents them", () => {
    expect(css).toContain("--hel-menu-radius: var(--hel-dialog-radius, 12px)");
    expect(css).toContain("--hel-menu-item-radius: var(--hel-control-radius, 6px)");
    for (const n of ["`--hel-menu-radius`", "`--hel-menu-item-radius`", "`menu`", "`menu-item`", "`menu-item-icon`", "`menu-separator`", "`menu-item.is-danger`"]) expect(styling).toContain(`| ${n} |`);
  });
});
