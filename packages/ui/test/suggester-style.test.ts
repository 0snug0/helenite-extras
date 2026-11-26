import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const theme = (f: string): string => readFileSync(resolve(__dirname, "../../base-theme/css", f), "utf8");
const css = theme("06-design-system.css");
const styling = readFileSync(resolve(__dirname, "../../../docs/design-system/STYLING.md"), "utf8");
const rules = css.split("\n").filter((l) => /^(\.suggestion-container\b|:where\(\.suggestion-container\))/.test(l));
const rule = (selector: string): string => rules.find((l) => l.startsWith(`${selector} {`)) ?? "";
const box = ":where(.suggestion-container)"; // adds no specificity
const layer = (name: string): number => Number(theme("01-variables.css").match(new RegExp(`--layer-${name}: (\\d+);`))?.[1]);

describe("Finesse suggester popover", () => {
  it("floats above the page and modals, so a text box in Settings can open it", () => {
    const base = rule(".suggestion-container");
    expect(base).toContain("position: fixed");
    // The design-system sheet also stands alone in app frames, hence the fallback; both must be the same layer.
    expect(base).toContain(`z-index: var(--layer-menu, ${layer("menu")})`);
    expect(layer("menu")).toBeGreaterThan(layer("modal"));
    expect(base).toContain("-webkit-app-region: no-drag");
  });

  it("is a Finesse overlay: primary background, overlay ring and menu corners", () => {
    const base = rule(".suggestion-container");
    expect(base).toContain("background: var(--background-primary)");
    expect(base).toContain("box-shadow: var(--hel-ring-overlay, var(--shadow-l))");
    expect(base).toContain("border-radius: var(--hel-menu-radius)");
    expect(rule(`${box} .suggestion-item`)).toContain("border-radius: var(--hel-menu-item-radius)");
  });

  it("caps its height and scrolls the list, keeping the instructions strip in view", () => {
    expect(rule(".suggestion-container")).toContain("max-height: min(var(--hel-suggest-max-height), calc(100vh - var(--size-4-4)))");
    expect(rule(".suggestion-container")).toContain("flex-direction: column");
    expect(rule(`${box} > .suggestion`)).toContain("min-height: 0; overflow-y: auto");
    expect(rule(`${box} > .prompt-instructions`)).toContain("flex: none");
    expect(css).toContain("--hel-suggest-max-height: 300px;");
  });

  it("keeps a row's highlighted text together and wraps a long path", () => {
    // The prompt's rows are flex with space-between, which would pull "No" and "tes" apart around a match highlight.
    expect(rule(`${box} .suggestion-item:where(:not(.mod-complex))`)).toContain("display: block");
    expect(rule(`${box} .suggestion-item`)).toContain("overflow-wrap: anywhere");
  });

  it("draws the chosen row and an empty-result line in the standalone sheet too", () => {
    expect(rule(`${box} .suggestion-item.is-selected`)).toContain("background-color: var(--background-modifier-hover)");
    expect(rule(`${box} .suggestion-empty`)).toContain("color: var(--text-muted)");
  });

  it("outranks no plugin or theme rule: one class's specificity, so a later .my-row or .suggestion-item wins", () => {
    // The cascade is base, plugin styles, theme, snippets; a theme beats a default at the same specificity.
    const classes = (selector: string): number => selector.replace(/:where\((?:[^()]|\([^()]*\))*\)/g, "").match(/\.[\w-]+/g)?.length ?? 0;
    for (const line of rules) {
      const selector = line.slice(0, line.indexOf(" {"));
      // The chosen row has two classes, as the base rule it repeats does.
      expect(classes(selector), selector).toBeLessThanOrEqual(selector.endsWith(".is-selected") ? 2 : 1);
    }
  });

  it("scrolls as a whole for a plugin that puts its own markup in the container", () => {
    expect(rule(".suggestion-container")).toContain("overflow: auto");
  });

  it("uses tokens only, so light and dark follow the theme", () => {
    expect(rules.length).toBeGreaterThan(5);
    expect(rules.join("\n")).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
  });

  it("STYLING.md has a row for every suggester part and variable", () => {
    for (const name of ["suggestion-container", "suggestion", "suggestion-item", "suggestion-empty", "mod-search-suggestion", "--hel-suggest-min-width", "--hel-suggest-max-width", "--hel-suggest-max-height"]) expect(styling).toContain(`| \`${name}\` |`);
  });
});

describe("Prompt rows and search field", () => {
  const overlays = theme("05-overlays-and-controls.css");

  it("keeps a plain row a block, so highlighted text stays together, at one class's specificity", () => {
    expect(overlays).toContain(".suggestion-item:where(:not(.mod-complex)) { display: block; }");
  });

  it("marks the matched letters with tokens", () => {
    expect(overlays).toContain(".suggestion-highlight { color: var(--text-accent); font-weight: var(--font-semibold); }");
  });

  it("leaves the search field out of the boxed text field, at rest and focused, without adding specificity", () => {
    const boxed = overlays.split("\n").filter((l) => /^input\[type=text\]/.test(l));
    expect(boxed.length).toBe(2);
    for (const line of boxed) expect(line).toMatch(/^input\[type=text\]:where\(:not\(\.prompt-input\)\)/);
    expect(overlays).toMatch(/^\.prompt-input \{[^}]*border: 0; background: transparent; font-family: inherit;/m);
  });
});
