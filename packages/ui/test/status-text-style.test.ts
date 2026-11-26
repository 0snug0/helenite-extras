import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "../../base-theme/css/06-design-system.css"), "utf8");
const styling = readFileSync(resolve(__dirname, "../../../docs/design-system/STYLING.md"), "utf8");
const rule = css.split("\n").find((l) => l.startsWith(".status-bar-item .hel-status-text {"));

describe("status text in the status bar", () => {
  it("takes the status bar's font size and uses tabular figures, so ticking digits do not shift it", () => {
    expect(rule).toContain("font-size: var(--status-bar-font-size)");
    expect(rule).toContain("font-variant-numeric: tabular-nums");
  });

  it("keeps its weight and tone colour", () => {
    expect(rule).toBeDefined();
    expect(rule).not.toMatch(/font-weight|(^|[;{])\s*color:/);
  });

  it("STYLING.md says so in the status text row", () => {
    const row = styling.split("\n").find((l) => l.startsWith("| `hel-status-text` |"))!;
    expect(row).toContain(".status-bar-item");
    expect(row).toContain("--status-bar-font-size");
    expect(row).toContain("tabular figures");
  });
});
