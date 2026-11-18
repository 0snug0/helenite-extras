import { describe, expect, it } from "vitest";
import { button, KIT_ICONS, kitIconRenderer, renderIcon } from "../src";

// The icons STANDARD_ACTIONS (obsidian-api ui/design/actions.ts) names, plus the more button's.
const STANDARD = ["chevron-left", "x", "rotate-ccw", "undo-2", "home", "settings", "power", "trash-2", "external-link"];

describe("ui-kit icon renderer", () => {
  it("is installed on import: a ui-kit icon button's icon span holds an svg", () => {
    const b = button(document.body, { icon: "x", label: "Close", variant: "icon" });
    const svg = b.el.querySelector(".hel-button-icon > svg")!;
    expect(svg).not.toBeNull();
    expect(svg.namespaceURI).toBe("http://www.w3.org/2000/svg");
    expect(svg.getAttribute("stroke")).toBe("currentColor");
    expect(svg.classList.contains("svg-icon")).toBe(true);
    expect(svg.querySelectorAll("path")).toHaveLength(2);
  });

  it("covers every standard action icon, more-horizontal and chevron-right", () => {
    for (const name of [...STANDARD, "more-horizontal", "chevron-right"]) {
      expect(KIT_ICONS[name], name).toBeDefined();
      const el = document.createElement("span");
      renderIcon(el, name);
      expect(el.dataset.icon).toBe(name);
      expect(el.querySelector("svg")!.childElementCount, name).toBeGreaterThan(0);
    }
  });

  it("an unknown name only tags the element", () => {
    const el = document.createElement("span");
    kitIconRenderer(el, "no-such-icon");
    expect(el.dataset.icon).toBe("no-such-icon");
    expect(el.childElementCount).toBe(0);
  });

  it("re-rendering replaces the previous icon", () => {
    const el = document.createElement("span");
    kitIconRenderer(el, "x");
    kitIconRenderer(el, "plus");
    expect(el.querySelectorAll("svg")).toHaveLength(1);
    expect(el.querySelector("svg")!.classList.contains("lucide-plus")).toBe(true);
  });
});
