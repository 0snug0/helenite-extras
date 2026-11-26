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
    // dot or icon, title, tag, badge, meta, chevron: one column each, so none draws over another
    expect(rule(".hel-list-row.has-sub")).toContain("grid-template-columns: auto minmax(0, 1fr) auto auto fit-content(50%) auto;");
    const at = (part: string) => rule(`.hel-list-row.has-sub > ${part}`);
    expect(at(".hel-list-row-tag")).toContain("grid-column: 3; grid-row: 1;");
    expect(at(".hel-count-badge")).toContain("grid-column: 4; grid-row: 1;");
    expect(at(".hel-list-row-meta")).toContain("grid-column: 5; grid-row: 1;");
    expect(at(".hel-list-row-chevron")).toContain("grid-column: 6; grid-row: 1 / span 2;");
    expect(css).toContain(".hel-list-row.has-sub:has(> .hel-list-row-tag, > .hel-count-badge, > .hel-list-row-meta, > .hel-list-row-chevron) > .hel-list-row-title { grid-column: 2; }");
  });

  it("is capped by its column in a two-line row, not halved again", () => {
    expect(rule(".hel-list-row.has-sub > .hel-list-row-meta")).toContain("max-width: none;");
  });

  it("leaves the second line under the title, with the actions over its end and clear of the chevron", () => {
    expect(rule(".hel-list-row-sub")).toContain("grid-column: 2 / -1; grid-row: 2;");
    expect(rule(".hel-list-row.has-sub:has(> .hel-list-row-chevron) > .hel-list-row-sub")).toContain("grid-column: 2 / 6;");
    // spanning the title's flexible column, so the hidden buttons widen no column beside the title
    expect(rule(".hel-list-row.has-sub > .hel-list-row-actions")).toContain("grid-column: 2 / 6; grid-row: 2;");
  });

  it("STYLING.md says so in the meta row", () => {
    expect(styling.split("\n").find((l) => l.startsWith("| `hel-list-row-meta` |"))).toContain("ellipsis");
  });
});
