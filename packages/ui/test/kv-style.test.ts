import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { keyValue } from "../src";

const css = readFileSync(resolve(__dirname, "../../base-theme/css/06-design-system.css"), "utf8");
const styling = readFileSync(resolve(__dirname, "../../../docs/design-system/STYLING.md"), "utf8");
const kvRules = css.split("\n").filter((l) => /^\.hel-kv/.test(l));

afterEach(() => {
  document.body.innerHTML = "";
});

describe("Finesse key-value list", () => {
  it("draws a dl of rows, each a dt and a dd, with a plain list for several values", () => {
    const host = document.body.appendChild(document.createElement("div"));
    const el = keyValue(host, [
      { key: "Name", value: "Letterboxd" },
      { key: "Hosts", value: ["a.com", "b.com"], isNew: (h) => h === "b.com", newTone: "warning" },
      { key: "Secrets", value: [], empty: "None" },
    ]);
    expect([...el.querySelectorAll(".hel-kv-row")].map((r) => [r.firstElementChild!.tagName, r.lastElementChild!.tagName])).toEqual([["DT", "DD"], ["DT", "DD"], ["DT", "DD"]]);
    expect(el.querySelector("li.is-new.is-warning")!.textContent).toContain("b.com");
    expect(el.querySelector(".hel-kv-value.is-empty")!.textContent).toBe("None");
  });

  it("the stylesheet shares the columns between rows and splits them with the divider token", () => {
    expect(css).toContain("grid-template-columns: subgrid");
    expect(css).toContain("border-top: 1px solid var(--hel-kv-divider)");
    expect(css).toContain("--hel-kv-divider: var(--background-modifier-border)");
  });

  it("the key-value rules use tokens only, so light and dark follow the theme", () => {
    expect(kvRules.length).toBeGreaterThan(0);
    expect(kvRules.join("\n")).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(/);
  });

  it("STYLING.md has a row for each class and the variable", () => {
    for (const name of ["`hel-kv`", "`hel-kv-row`", "`hel-kv-key`", "`hel-kv-value`", "`--hel-kv-divider`"]) expect(styling).toContain(`| ${name} |`);
  });
});
