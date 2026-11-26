import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "../../base-theme/css/06-design-system.css"), "utf8");
const styling = readFileSync(resolve(__dirname, "../../../docs/design-system/STYLING.md"), "utf8");
/** The declarations of the rule with exactly this selector. */
const rule = (selector: string): string => css.split("\n").find((l) => l.startsWith(`${selector} {`))?.slice(selector.length) ?? "";

describe("a list row's long meta", () => {
  it("gives way to the title and ends in an ellipsis", () => {
    const meta = rule(".hel-list-row-meta");
    for (const d of ["flex: 0 1 auto;", "min-width: 0;", "max-width: 50%;", "overflow: hidden;", "text-overflow: ellipsis;", "white-space: nowrap;"]) expect(meta).toContain(d);
  });

  it("leaves a short meta whole: the title starts from no width, so a long title takes only what is spare", () => {
    expect(rule(".hel-list-row-title")).toContain("flex: 1 1 0;");
  });

  it("sits after the title on the first line of a two-line row, in a column of its own", () => {
    // dot or icon, title, tag, status, count badge, meta, chevron: one column each, so none draws over another
    expect(rule(".hel-list-row:is(.has-sub, .has-chips)")).toContain("grid-template-columns: auto minmax(3em, 1fr) auto fit-content(40%) auto fit-content(50%) auto;");
    const at = (part: string) => rule(`.hel-list-row:is(.has-sub, .has-chips) > ${part}`);
    expect(at(".hel-list-row-tag")).toContain("grid-column: 3; grid-row: 1;");
    expect(at(".hel-list-row-status")).toContain("grid-column: 4; grid-row: 1;");
    expect(at(".hel-count-badge")).toContain("grid-column: 5; grid-row: 1;");
    expect(at(".hel-list-row-meta")).toContain("grid-column: 6; grid-row: 1;");
    expect(at(".hel-list-row-chevron")).toContain("grid-column: 7; grid-row: 1 / span 2;");
    expect(css).toContain(".hel-list-row:is(.has-sub, .has-chips):has(> .hel-list-row-tag, > .hel-list-row-status, > .hel-count-badge, > .hel-list-row-meta, > .hel-list-row-chevron) > .hel-list-row-title { grid-column: 2; }");
  });

  it("is capped by its column in a two-line row, not halved again", () => {
    expect(rule(".hel-list-row:is(.has-sub, .has-chips) > .hel-list-row-meta")).toContain("max-width: none;");
  });

  it("leaves the second line under the title, with the actions over its end and clear of the chevron", () => {
    expect(rule(".hel-list-row-sub")).toContain("grid-column: 2 / -1; grid-row: 2;");
    expect(rule(".hel-list-row:is(.has-sub, .has-chips):has(> .hel-list-row-chevron) > .hel-list-row-sub")).toContain("grid-column: 2 / 7;");
    // spanning the title's flexible column, so the hidden buttons widen no column beside the title
    expect(rule(".hel-list-row:is(.has-sub, .has-chips) > .hel-list-row-actions")).toContain("grid-column: 2 / 7; grid-row: 2;");
  });

  it("cuts a long status badge with an ellipsis, in a one-line row and in a two-line one", () => {
    for (const d of ["display: block;", "min-width: 0;", "max-width: 40%;", "text-overflow: ellipsis;", "white-space: nowrap;"]) expect(rule(".hel-list-row > .hel-list-row-status")).toContain(d);
    expect(rule(".hel-list-row:is(.has-sub, .has-chips) > .hel-list-row-status")).toContain("max-width: none;");
  });

  it("keeps the chips on one line of their own, each cut with an ellipsis, the count of the rest whole", () => {
    expect(rule(".hel-list-row-chips")).toContain("grid-column: 2 / -1; grid-row: 2; display: flex;");
    expect(rule(".hel-list-row-chips")).toContain("overflow: hidden;");
    expect(rule(".hel-list-row-chips")).not.toContain("flex-wrap");
    expect(rule(".hel-list-row.has-sub > .hel-list-row-chips")).toContain("grid-row: 3;");
    expect(rule(".hel-list-row:has(> .hel-list-row-chevron) > .hel-list-row-chips")).toContain("grid-column: 2 / 7;");
    for (const d of ["display: block;", "flex: 1 1 0;", "max-width: max-content;", "min-width: 0;", "text-overflow: ellipsis;"]) expect(rule(".hel-list-row-chips > .hel-chip")).toContain(d);
    expect(rule(".hel-list-row-chips > .hel-list-row-chips-more")).toContain("flex: none;");
  });

  it("STYLING.md has a row for each new class", () => {
    for (const c of ["hel-list-row-status", "hel-list-row-chips", "hel-list-row-chips-more"]) expect(styling).toContain(`| \`${c}\` |`);
  });

  it("STYLING.md says so in the meta row", () => {
    expect(styling.split("\n").find((l) => l.startsWith("| `hel-list-row-meta` |"))).toContain("ellipsis");
  });
});
