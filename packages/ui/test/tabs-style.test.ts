import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "../../base-theme/css/06-design-system.css"), "utf8");
const styling = readFileSync(resolve(__dirname, "../../../docs/design-system/STYLING.md"), "utf8");

describe("Finesse tabs and toolbar styling", () => {
  it("the stylesheet styles every tab and toolbar class and hides a zero badge", () => {
    for (const cls of [".hel-tabs", ".hel-tab", ".hel-tab-badge", ".hel-toolbar", ".hel-toolbar-end"]) expect(css).toContain(cls);
    expect(css).toContain(".hel-tab-badge[hidden] { display: none; }");
    expect(css).toContain(".hel-tab.is-active > .hel-tab-badge");
  });

  it("tab and toolbar rules use tokens only, so light and dark follow the theme", () => {
    const rules = css.split("\n").filter((l) => /^\.hel-(tabs|tab|tab-badge|toolbar)\b/.test(l)).join("\n");
    expect(rules.length).toBeGreaterThan(0);
    expect(rules).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(/);
    expect(rules).toContain("var(--hel-tab-indicator, var(--text-normal))");
    expect(rules).toContain("var(--hel-toolbar-gap, var(--size-4-2))");
  });

  it("STYLING.md has a row for each class and variable", () => {
    for (const name of ["`hel-tabs`", "`hel-tab`", "`hel-tab-badge`", "`hel-toolbar`", "`hel-toolbar-end`"]) expect(styling).toContain(`| ${name} |`);
    for (const name of ["`--hel-tab-indicator`", "`--hel-toolbar-gap`"]) expect(styling).toContain(`| ${name} |`);
  });
});
