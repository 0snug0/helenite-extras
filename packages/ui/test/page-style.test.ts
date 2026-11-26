import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "../../base-theme/css/06-design-system.css"), "utf8");
const styling = readFileSync(resolve(__dirname, "../../../docs/design-system/STYLING.md"), "utf8");
const rule = (start: string) => css.split("\n").find((l) => l.startsWith(start)) ?? "";

describe("page spacing and the gaps between blocks", () => {
  it("hel-page pads its container and spaces the boxed blocks, above and below", () => {
    expect(rule(".hel-page {")).toContain("padding: var(--size-4-3)");
    const gaps = css.split("\n").filter((l) => l.startsWith(":is(.hel-page,"));
    expect(gaps).toHaveLength(2);
    for (const l of gaps) expect(l).toContain("margin-block-start: var(--size-4-3)");
  });

  it("an inline state with something after it keeps a space below", () => {
    expect(rule(".hel-empty.is-inline:not(:last-child), .hel-error.is-inline:not(:last-child)")).toContain("margin-block-end: var(--size-4-3)");
  });

  it("the choice list of a form leaves a focused choice's ring its room", () => {
    const r = rule(".hel-modal-choices {");
    expect(r).toContain("padding: var(--hel-modal-bleed)");
    expect(r).toContain("margin: calc(-1 * var(--hel-modal-bleed))");
  });

  it("a two-line row with an icon and a dot gives the icon a column of its own", () => {
    expect(rule(".hel-list-row:is(.has-sub, .has-chips) > .hel-list-row-icon:has(+ .hel-status-dot)")).toContain("grid-column: span 1 / 1");
  });

  it("STYLING.md has rows for the new classes", () => {
    for (const name of ["`hel-page`", "`hel-chip-icon`"]) expect(styling).toContain(`| ${name} |`);
  });
});
