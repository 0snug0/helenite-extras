import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { codeBlock } from "../src";

const css = readFileSync(resolve(__dirname, "../../base-theme/css/06-design-system.css"), "utf8");
const styling = readFileSync(resolve(__dirname, "../../../docs/design-system/STYLING.md"), "utf8");
const rules = css.split("\n").filter((l) => l.startsWith("pre.hel-code-block")).join("\n");

const host = () => document.body.appendChild(document.createElement("div"));

afterEach(() => {
  document.body.innerHTML = "";
});

describe("code block", () => {
  it("draws the code in a pre, as text and exactly as written", () => {
    const code = "const a = '<b>';\n\treturn   a;";
    const el = codeBlock(host(), code);
    expect(el.tagName).toBe("PRE");
    expect(el.className).toBe("hel-code-block");
    expect(el.textContent).toBe(code);
    expect(el.children.length).toBe(0);
  });

  it("is a named group a keyboard can reach, so a long line can be scrolled without a pointer", () => {
    const a = codeBlock(host(), "x");
    expect(a.tabIndex).toBe(0);
    expect(a.getAttribute("role")).toBe("group");
    expect(a.getAttribute("aria-label")).toBe("Code");
    expect(codeBlock(host(), "x", { label: "Buttons code" }).getAttribute("aria-label")).toBe("Buttons code");
  });

  it("the stylesheet keeps lines whole, scrolls them, lets them be selected and uses the monospace font", () => {
    for (const decl of ["white-space: pre;", "overflow: auto;", "user-select: text;", "font-family: var(--font-monospace);"]) expect(rules).toContain(decl);
    expect(rules).toContain("pre.hel-code-block:focus-visible { outline: none; box-shadow: var(--hel-ring-focus); }");
  });

  it("the rules use tokens only, so light and dark follow the theme", () => {
    expect(rules.length).toBeGreaterThan(0);
    expect(rules).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(/);
  });

  it("STYLING.md has a row for the class", () => {
    expect(styling).toContain("| `hel-code-block` |");
  });
});
