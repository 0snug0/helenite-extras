import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { listRow } from "../src";

const css = readFileSync(resolve(__dirname, "../../base-theme/css/06-design-system.css"), "utf8");
const styling = readFileSync(resolve(__dirname, "../../../docs/design-system/STYLING.md"), "utf8");

afterEach(() => {
  document.body.innerHTML = "";
});

describe("Finesse list rows, groups and pane header", () => {
  it("chevron adds a hidden trailing chevron, and obsidianClass still works with it", () => {
    const host = document.body.appendChild(document.createElement("div"));
    const row = listRow(host, { title: "Appearance", icon: "palette", chevron: true, obsidianClass: "tree-item" });
    const chevron = row.querySelector<HTMLElement>(".hel-list-row-chevron")!;
    expect(chevron.getAttribute("aria-hidden")).toBe("true");
    expect(row.classList.contains("tree-item-self") && row.classList.contains("nav-file-title")).toBe(true);
    expect(listRow(host, { title: "Plain" }).querySelector(".hel-list-row-chevron")).toBeNull();
  });

  it("the stylesheet styles the chevron, the section label and the pane header", () => {
    for (const cls of [".hel-list-row-chevron", ".hel-list-group-header", ".hel-pane-header"]) expect(css).toContain(cls);
    expect(css).toContain("var(--hel-list-row-radius, var(--hel-control-radius, 6px))");
    expect(css).toContain("var(--hel-pane-header-border, var(--background-modifier-border))");
  });

  it("the list and pane-header rules use tokens only, so light and dark follow the theme", () => {
    const rules = css.split("\n").filter((l) => /^(\.hel-list-(row|group)|\.hel-pane-header|:where\(\.hel-list-row)/.test(l)).join("\n");
    expect(rules.length).toBeGreaterThan(0);
    expect(rules).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(/);
  });

  it("STYLING.md has a row for each new class and variable", () => {
    for (const name of ["`hel-list-row`", "`hel-list-row-chevron`", "`hel-list-group-header`", "`hel-pane-header`", "`--hel-list-row-radius`", "`--hel-pane-header-border`"]) expect(styling).toContain(`| ${name} |`);
  });
});
