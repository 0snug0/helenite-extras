import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "../../base-theme/css/06-design-system.css"), "utf8");
const styling = readFileSync(resolve(__dirname, "../../../docs/design-system/STYLING.md"), "utf8");
const rule = (selector: string): string => css.split("\n").find((l) => l.startsWith(`${selector} {`)) ?? "";

const FILL = ".hel-field.is-fill > .hel-field-control > ";

describe("Finesse field styling", () => {
  it("lets a text box or dropdown shrink to a narrow slot instead of overflowing it", () => {
    expect(rule(".hel-field-control > :is(.hel-input, .hel-select)")).toContain("min-width: 0; max-width: 100%");
  });

  it("a filled field stretches text boxes, dropdowns and search boxes, sharing the row with a button", () => {
    const r = rule(`${FILL}:is(input.hel-input, .hel-select, .search-input-container)`);
    expect(r).toContain("flex: 1 1 12em");
    expect(r).toContain("min-width: 0");
    expect(r).toContain("box-sizing: border-box");
  });

  it("a filled field gives a multiline box, a choice list and a check list a row each", () => {
    expect(rule(`${FILL}:is(textarea.hel-input, .hel-choice-list, .hel-check-list, .hel-picker-grid)`)).toContain("flex: 1 1 100%; min-width: 0");
  });

  it("STYLING.md names the modifier", () => {
    expect(styling.split("\n").find((l) => l.startsWith("| `hel-field` |"))).toContain("`is-fill`");
  });
});
