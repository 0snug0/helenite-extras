import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "../../base-theme/css/06-design-system.css"), "utf8");
const styling = readFileSync(resolve(__dirname, "../../../docs/design-system/STYLING.md"), "utf8");
/** The declarations of the rule with exactly this selector. */
const rule = (selector: string): string => css.split("\n").find((l) => l.startsWith(`${selector} {`))?.slice(selector.length) ?? "";

describe("a list row being drag-reordered", () => {
  it("dims the dragged row", () => {
    expect(rule(".hel-list-row.is-being-dragged")).toContain("opacity: 0.5");
  });

  it("outlines the row it would drop on, in the theme's accent", () => {
    expect(rule(".hel-list-row.is-drop-target")).toContain("outline: 2px dashed var(--interactive-accent); outline-offset: -2px;");
    // After the focus rule, which sets `outline: none` at the same specificity.
    expect(css.indexOf("\n.hel-list-row.is-drop-target {")).toBeGreaterThan(css.indexOf("\n.hel-list-row:focus-visible"));
  });

  it("documents both classes", () => {
    const row = styling.split("\n").find((l) => l.startsWith("| `hel-list-row` |"));
    expect(row).toContain("`is-being-dragged`");
    expect(row).toContain("`is-drop-target`");
  });
});
