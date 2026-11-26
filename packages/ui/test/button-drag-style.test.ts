import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "../../base-theme/css/06-design-system.css"), "utf8");
const styling = readFileSync(resolve(__dirname, "../../../docs/design-system/STYLING.md"), "utf8");
const lines = css.split("\n");
const at = (selector: string): number => lines.findIndex((l) => l.startsWith(`${selector} {`));
const rule = (selector: string): string => lines[at(selector)]?.slice(selector.length) ?? "";

describe("a draggable button", () => {
  it("shows a grab cursor and dims while dragged", () => {
    expect(rule('.hel-button[draggable="true"]')).toContain("cursor: grab;");
    expect(rule(".hel-button.is-dragging")).toContain("opacity: 0.5;");
  });

  it("wins over the icon button's cursor and hover opacity, which come first at no higher specificity", () => {
    expect(at('.hel-button[draggable="true"]')).toBeGreaterThan(at(":where(.hel-button).clickable-icon:hover"));
    expect(at(".hel-button.is-dragging")).toBeGreaterThan(at(":where(.hel-button).clickable-icon:hover"));
  });

  it("STYLING.md lists both states", () => {
    const row = styling.split("\n").find((l) => l.startsWith("| `hel-button` |"));
    expect(row).toContain('draggable="true"');
    expect(row).toContain("is-dragging");
    expect(styling.split("\n").find((l) => l.startsWith("Button states and variants:"))).toContain("`is-dragging`");
  });
});
