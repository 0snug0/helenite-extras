import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "../../base-theme/css/03-shell-and-trees.css"), "utf8");
const styling = readFileSync(resolve(__dirname, "../../../docs/design-system/STYLING.md"), "utf8");
/** The declarations of the rule with exactly this selector. */
const rule = (selector: string): string => css.split("\n").find((l) => l.startsWith(`${selector} {`))?.slice(selector.length) ?? "";

describe("file tree states", () => {
  it("keeps an inline rename box inside the row's height, without moving the name", () => {
    const box = rule(".tree-item-self > input.hel-input");
    expect(box).toContain("height: calc(1em * var(--line-height-tight) + 2 * var(--size-2-1))");
    expect(box).toContain("margin: calc(-1 * var(--size-2-1)) 0 calc(-1 * var(--size-2-1)) calc(-1 * var(--size-2-2))");
    // No border, which would push the text right.
    expect(box).toContain("border: 0; padding: 0 var(--size-2-2)");
    expect(box).toContain("flex: 1; min-width: 0");
    // The focus ring is the design system's; the tree must not replace it.
    expect(box).not.toContain("box-shadow");
  });

  it("dims the dragged row", () => {
    expect(rule(".tree-item-self.is-being-dragged")).toContain("opacity: 0.5");
  });

  it("fills and outlines the drop target, after the active row's fill", () => {
    const target = rule(".tree-item-self.is-being-dragged-over");
    expect(target).toContain("background-color: var(--nav-item-background-hover)");
    expect(target).toContain("outline: 1px dashed var(--interactive-accent)");
    expect(css.indexOf("\n.tree-item-self.is-being-dragged-over {")).toBeGreaterThan(css.indexOf("\n.tree-item-self.is-active {"));
  });

  it("documents the states", () => {
    for (const name of ["is-being-dragged", "is-being-dragged-over"]) expect(styling).toContain(`\`.tree-item-self.${name}\``);
  });
});
