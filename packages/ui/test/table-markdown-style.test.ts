import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { table } from "../src/table";

const css = readFileSync(resolve(__dirname, "../../base-theme/css/04-markdown.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
/** Splits a selector list at its top-level commas. */
const list = (selectors: string): string[] => selectors.split(/,(?![^(]*\))/).map((s) => s.trim());
/** Every `.markdown-rendered` selector that styles a table, a row or a cell. `:hover` is dropped so it can be matched. */
const selectors = [...css.matchAll(/([^{}]+)\{/g)]
  .flatMap((m) => list(m[1]!))
  .filter((s) => /^\.markdown-rendered .*\b(table|tr|th|td)\b/.test(s))
  .map((s) => s.replace(/:hover(?![\w-])/g, ""));
/** `el.matches`, with a trailing `:where(:not(X))` taken apart: happy-dom does not read a complex selector inside :not(). */
const matches = (el: Element, selector: string): boolean => {
  const [, base, excluded] = /^(.*):where\(:not\((.*)\)\)$/.exec(selector) ?? [];
  return base && excluded ? el.matches(base) && !el.matches(excluded) : el.matches(selector);
};
const hits = (el: Element): string[] => selectors.filter((s) => matches(el, s));

describe("ui.table inside rendered markdown", () => {
  let root: HTMLElement;
  beforeEach(() => {
    document.body.replaceChildren();
    root = document.body.appendChild(document.createElement("div"));
    root.className = "markdown-rendered";
  });

  it("takes none of the markdown table rules, on the table, its rows or its cells", () => {
    const { el } = table(root, {
      columns: [{ key: "a", title: "A", cell: (r: string) => r }],
      groups: [{ title: "Group", rows: ["one", "two", "three"] }],
      actions: () => {},
    });
    const parts = [el, ...el.querySelectorAll("tr, th, td")];
    expect(parts.length).toBeGreaterThan(10);
    expect(parts.flatMap(hits)).toEqual([]);
  });

  it("leaves a markdown table styled, including one drawn in a part's cell", () => {
    const markdown = "<table><thead><tr><th>h</th></tr></thead><tbody><tr><td>1</td></tr><tr><td>2</td></tr></tbody></table>";
    root.innerHTML = markdown;
    const { el } = table(root, { columns: [{ key: "a", title: "A", cell: (_: string, td) => void (td.innerHTML = markdown) }], rows: ["x"] });
    for (const t of [root.querySelector(":scope > table")!, el.querySelector("table")!]) {
      expect(hits(t)).toHaveLength(1);
      expect(hits(t.querySelector("th")!)).toHaveLength(2);
      expect(hits(t.querySelector("td")!)).toHaveLength(1);
      expect(hits(t.querySelector("tbody tr:nth-child(2)")!)).toHaveLength(2);
    }
  });

  // A theme's `.markdown-rendered td { … }` must still beat the base rule: the exclusion adds no weight.
  it("excludes the part without adding specificity", () => {
    expect(selectors.length).toBeGreaterThanOrEqual(6);
    for (const s of selectors) expect(s).not.toMatch(/(?<!:where\():not\(/);
  });
});
