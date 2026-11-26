import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const file = resolve(__dirname, "../../base-theme/css/08-hotkeys.css");
const css = existsSync(file) ? readFileSync(file, "utf8") : "";
/** The declarations of the rule with exactly this selector. */
const rule = (selector: string): string => css.split("\n").find((l) => l.startsWith(`${selector} {`))?.slice(selector.length) ?? "";

describe("Obsidian's hotkey chips", () => {
  it("keeps several bindings apart in a wrapping row", () => {
    expect(rule(".setting-command-hotkeys")).toContain("flex-wrap: wrap");
    expect(rule(".setting-command-hotkeys")).toContain("gap: var(--size-4-1)");
  });

  it("draws a binding as a Finesse chip", () => {
    const chip = rule(".setting-hotkey");
    expect(chip).toContain("border-radius: var(--hel-chip-radius, var(--hel-control-radius, 6px))");
    expect(chip).toContain("background-color: color-mix(in srgb, var(--text-muted) 10%, transparent)");
    expect(chip).toContain("box-shadow: inset 0 0 0 1px");
  });

  it("tells inherited, blank and capturing apart", () => {
    expect(rule(".setting-hotkey:where(.mod-inherited)")).toContain("background-color: transparent");
    expect(rule(".setting-hotkey:where(.mod-inherited)")).toContain("color: var(--text-muted)");
    expect(rule(".setting-hotkey:where(.mod-empty)")).toContain("box-shadow: none");
    expect(rule(".setting-hotkey:where(.mod-capturing)")).toContain("color: var(--text-accent)");
  });

  it("rings a focused chip and delete button over the state looks", () => {
    expect(rule(".setting-hotkey:focus-visible, .setting-delete-hotkey:focus-visible")).toContain("box-shadow: var(--hel-ring-focus)");
  });

  it("shows a clickable chip and a delete button as such", () => {
    expect(rule('.setting-hotkey:where([role="button"])')).toContain("cursor: pointer");
    expect(rule(".setting-hotkey-icon")).toContain("display: inline-flex");
    expect(rule(".setting-delete-hotkey:where(:hover)")).toContain("color: var(--text-error)");
  });

  // A theme's `.setting-hotkey { … }` must beat every resting look: state classes sit inside :where().
  it("weighs no more than one class outside the focus ring", () => {
    const selectors = css.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => l.includes("{")).map((l) => l.slice(0, l.indexOf("{")).trim());
    expect(selectors.length).toBeGreaterThan(5);
    for (const s of selectors.filter((s) => !s.includes(":focus-visible"))) {
      expect(s.replace(/:where\([^)]*\)/g, "")).toMatch(/^\.[a-z-]+( \.svg-icon)?$/);
    }
  });
});
