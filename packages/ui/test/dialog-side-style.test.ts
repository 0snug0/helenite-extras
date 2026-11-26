import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "../../base-theme/css/06-design-system.css"), "utf8");
const styling = readFileSync(resolve(__dirname, "../../../docs/design-system/STYLING.md"), "utf8");
const rules = css.split("\n").filter((l) => /\.hel-modal-(split|main|side)\b|has-side-panel/.test(l) && !l.startsWith("/*"));
const rule = (start: string) => css.split("\n").find((l) => l.startsWith(start)) ?? "";
/** The rules inside the narrow-dialog container query. */
const narrow = css.slice(css.indexOf("@container hel-modal-body")).split("\n}")[0];

describe("dialog side panel styling", () => {
  it("is two columns: the content takes the room, the side column has the side width", () => {
    expect(rule(".hel-modal-split {")).toContain("grid-template-columns: minmax(0, 1fr) var(--hel-modal-side-width)");
    expect(rule(".hel-modal-main, .hel-modal-side {")).toContain("flex-direction: column");
    expect(rule(".hel-modal-main, .hel-modal-side {")).toContain("min-width: 0");
    expect(css).toContain("--hel-modal-side-width: 300px;");
  });

  it("the side column sits behind a hairline", () => {
    expect(rule(".hel-modal-side {")).toContain("border-inline-start: var(--border-width) solid var(--hel-modal-side-divider)");
    expect(css).toContain("--hel-modal-side-divider: var(--background-modifier-border);");
  });

  it("stacks to one column when the dialog body is narrow, with the hairline on top", () => {
    expect(rule(".hel-modal-body.has-side-panel {")).toContain("container: hel-modal-body / inline-size");
    expect(narrow).toContain("(max-width: 600px)");
    expect(narrow).toContain(".hel-modal-split { grid-template-columns: minmax(0, 1fr);");
    expect(narrow).toContain("border-inline-start: none");
    expect(narrow).toContain("border-top: var(--border-width) solid var(--hel-modal-side-divider)");
  });

  it("each column scrolls on its own, and the two as one when stacked", () => {
    expect(rule(".hel-modal > .modal-content:has(> .hel-modal-body.has-side-panel) {")).toContain("flex-direction: column");
    for (const start of [".hel-modal-body.has-side-panel {", ".hel-modal-split {", ".hel-modal-main, .hel-modal-side {"]) expect(rule(start)).toContain("min-height: 0");
    expect(rule(".hel-modal-split {")).toContain("grid-template-rows: minmax(0, 1fr)");
    expect(rule(".hel-modal-main, .hel-modal-side {")).toContain("overflow-y: auto");
    expect(narrow).toMatch(/\.hel-modal-split \{[^}]*overflow-y: auto/);
    expect(narrow).toMatch(/\.hel-modal-main, \.hel-modal-side \{[^}]*overflow: visible/);
  });

  it("uses tokens only, so light and dark follow the theme", () => {
    expect(rules.length).toBeGreaterThan(4);
    expect(rules.join("\n")).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
  });

  it("STYLING.md has a row for each class and variable", () => {
    for (const name of ["`hel-modal-split`", "`hel-modal-main`", "`hel-modal-side`", "`--hel-modal-side-width`", "`--hel-modal-side-divider`"]) expect(styling).toContain(`| ${name} |`);
    expect(styling).toMatch(/\| `hel-modal-body` \|[^\n]*has-side-panel/);
  });
});
