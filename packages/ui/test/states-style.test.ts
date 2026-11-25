import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "../../base-theme/css/06-design-system.css"), "utf8");
const styling = readFileSync(resolve(__dirname, "../../../docs/design-system/STYLING.md"), "utf8");
const rules = css.split("\n").filter((l) => /^\.hel-(empty|error)\b/.test(l));
const rule = (start: string) => rules.find((l) => l.startsWith(start))!;

describe("Finesse empty and error state styling", () => {
  it("a centered empty state is a dashed panel with the card radius", () => {
    const r = rule(".hel-empty:not(.is-inline):not(.is-pane) {");
    expect(r).toContain("border: 1px dashed");
    expect(r).toContain("border-radius: var(--hel-card-radius)");
  });

  it("a centered error is a tinted panel with an error ring; inline and pane are not boxed", () => {
    const r = rule(".hel-error:not(.is-inline):not(.is-pane) {");
    expect(r).toContain("box-shadow: 0 0 0 1px color-mix(in srgb, var(--text-error)");
    expect(r).toContain("flex-wrap: wrap");
    const plain = rules.filter((l) => /\.is-(inline|pane)/.test(l) && !l.includes(":not("));
    expect(plain.length).toBeGreaterThan(0);
    expect(plain.join("\n")).not.toMatch(/box-shadow|border:|background/);
  });

  it("rules use tokens only, so light and dark follow the theme", () => {
    expect(rules.length).toBeGreaterThan(4);
    expect(rules.join("\n")).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });

  it("STYLING.md has rows for the empty and error parts", () => {
    for (const name of ["`hel-empty`", "`hel-error`", "`hel-error-text`"]) expect(styling).toContain(`| ${name} |`);
  });
});
