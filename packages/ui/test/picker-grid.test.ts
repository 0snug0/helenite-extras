import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pickerGrid } from "../src";

const css = readFileSync(resolve(__dirname, "../../base-theme/css/06-design-system.css"), "utf8");
const styling = readFileSync(resolve(__dirname, "../../../docs/design-system/STYLING.md"), "utf8");
const rules = css.split("\n").filter((l) => /^(button)?\.hel-picker/.test(l));

const host = () => document.body.appendChild(document.createElement("div"));
const icons = ["code", "music", "star", "home", "book"].map((i) => ({ value: i, label: i, icon: i }));
const cells = (el: HTMLElement) => [...el.querySelectorAll<HTMLButtonElement>(".hel-picker-cell")];
const checked = (el: HTMLElement) => cells(el).filter((c) => c.getAttribute("aria-checked") === "true").map((c) => c.getAttribute("aria-label"));
const tabStops = (el: HTMLElement) => cells(el).filter((c) => c.tabIndex === 0).map((c) => c.getAttribute("aria-label"));
const press = (el: Element, key: string, init: KeyboardEventInit = {}) => {
  const e = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  el.dispatchEvent(e);
  return e;
};
/** Lays the cells out `columns` to a row, which happy-dom does not do itself. */
const layOut = (el: HTMLElement, columns: number) =>
  cells(el).forEach((c, i) => {
    Object.defineProperty(c, "offsetTop", { value: Math.floor(i / columns) * 36 });
    Object.defineProperty(c, "offsetLeft", { value: (i % columns) * 36 });
  });

afterEach(() => {
  document.body.innerHTML = "";
});

describe("pickerGrid", () => {
  it("is a named radio group of buttons, the value checked", () => {
    const h = host();
    const g = pickerGrid(h, { label: "Icon", options: icons, value: "music", onChange: () => {} });
    expect(h.firstElementChild).toBe(g.el);
    expect(g.el.getAttribute("role")).toBe("radiogroup");
    expect(g.el.getAttribute("aria-label")).toBe("Icon");
    expect(cells(g.el)).toHaveLength(icons.length);
    for (const c of cells(g.el)) {
      expect(c.tagName).toBe("BUTTON");
      expect(c.type).toBe("button");
      expect(c.getAttribute("role")).toBe("radio");
      expect(c.title).toBe(c.getAttribute("aria-label"));
    }
    expect(checked(g.el)).toEqual(["music"]);
    expect(cells(g.el)[1].querySelector<HTMLElement>(".hel-picker-icon")!.dataset.icon).toBe("music");
  });

  it("takes its name from the field it is drawn into", () => {
    const h = host();
    h.classList.add("hel-field-control");
    h.dataset.labelledby = "label-1";
    expect(pickerGrid(h, { options: icons, onChange: () => {} }).el.getAttribute("aria-labelledby")).toBe("label-1");
  });

  it("draws a colour cell as a dot filled with the colour, not as an icon or a swatch image", () => {
    const g = pickerGrid(host(), { options: [{ value: 2, label: "red", color: "rgb(1, 2, 3)" }], onChange: () => {} });
    const cell = cells(g.el)[0];
    expect(cell.classList.contains("is-color")).toBe(true);
    const dot = cell.querySelector<HTMLElement>(".hel-picker-dot")!;
    expect(dot.style.background).toContain("rgb(1, 2, 3)");
    expect(dot.getAttribute("aria-hidden")).toBe("true");
    expect(cell.querySelector("[role=img], .hel-picker-icon")).toBeNull();
  });

  it("has one Tab stop: the checked cell, or the first when none is", () => {
    expect(tabStops(pickerGrid(host(), { options: icons, value: "star", onChange: () => {} }).el)).toEqual(["star"]);
    const none = pickerGrid(host(), { options: icons, onChange: () => {} });
    expect(tabStops(none.el)).toEqual(["code"]);
    expect(checked(none.el)).toEqual([]);
  });

  it("a click picks and calls onChange once; picking the checked cell again does not", () => {
    const onChange = vi.fn();
    const g = pickerGrid(host(), { options: icons, value: "code", onChange });
    cells(g.el)[2].click();
    cells(g.el)[2].click();
    expect(onChange.mock.calls).toEqual([["star"]]);
    expect(checked(g.el)).toEqual(["star"]);
    expect(tabStops(g.el)).toEqual(["star"]);
  });

  it("left and right move the focus and the pick, wrapping at the ends; Home and End jump", () => {
    const onChange = vi.fn();
    const g = pickerGrid(host(), { options: icons, value: "code", onChange });
    const step = (key: string) => {
      const e = press(document.activeElement!, key);
      expect(e.defaultPrevented, key).toBe(true);
      return (document.activeElement as HTMLElement).getAttribute("aria-label");
    };
    cells(g.el)[0].focus();
    expect(step("ArrowRight")).toBe("music");
    expect(step("ArrowLeft")).toBe("code");
    expect(step("ArrowLeft")).toBe("book");
    expect(step("ArrowRight")).toBe("code");
    expect(step("End")).toBe("book");
    expect(step("Home")).toBe("code");
    expect(checked(g.el)).toEqual(["code"]);
    expect(onChange.mock.calls.map((c) => c[0])).toEqual(["music", "code", "book", "code", "book", "code"]);
  });

  it("up and down move a row, to the nearest cell, wrapping past the first and last rows", () => {
    const g = pickerGrid(host(), { options: icons, value: "music", onChange: () => {} }); // code music star / home book
    layOut(g.el, 3);
    cells(g.el)[1].focus();
    press(document.activeElement!, "ArrowDown");
    expect(checked(g.el)).toEqual(["book"]);
    press(document.activeElement!, "ArrowDown"); // past the last row: back to the first
    expect(checked(g.el)).toEqual(["music"]);
    press(document.activeElement!, "ArrowUp"); // past the first row: round to the last
    expect(checked(g.el)).toEqual(["book"]);
    press(document.activeElement!, "ArrowUp");
    expect(checked(g.el)).toEqual(["music"]);
    cells(g.el)[2].click();
    cells(g.el)[2].focus();
    press(document.activeElement!, "ArrowDown"); // a short last row: its closest cell
    expect(checked(g.el)).toEqual(["book"]);
  });

  it("in a single row, down is next and up is previous", () => {
    const g = pickerGrid(host(), { options: icons, value: "code", onChange: () => {} });
    cells(g.el)[0].focus();
    press(document.activeElement!, "ArrowDown");
    expect(checked(g.el)).toEqual(["music"]);
    press(document.activeElement!, "ArrowUp");
    expect(checked(g.el)).toEqual(["code"]);
  });

  it("leaves other keys and modified arrows alone", () => {
    const onChange = vi.fn();
    const g = pickerGrid(host(), { options: icons, value: "code", onChange });
    cells(g.el)[0].focus();
    for (const e of [press(cells(g.el)[0], "a"), press(cells(g.el)[0], "ArrowRight", { metaKey: true }), press(cells(g.el)[0], "ArrowRight", { altKey: true })])
      expect(e.defaultPrevented).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("setValue checks without calling onChange; undefined or an unknown value checks nothing", () => {
    const onChange = vi.fn();
    const g = pickerGrid(host(), { options: icons, onChange });
    g.setValue("home");
    expect(checked(g.el)).toEqual(["home"]);
    expect(tabStops(g.el)).toEqual(["home"]);
    g.setValue("nope");
    expect(checked(g.el)).toEqual([]);
    expect(tabStops(g.el)).toEqual(["code"]);
    g.setValue(undefined);
    expect(checked(g.el)).toEqual([]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("the stylesheet draws a round dot at full strength and marks the checked cell, with tokens only", () => {
    const all = rules.join("\n");
    expect(all).toMatch(/\.hel-picker-dot \{[^}]*border-radius: 50%/);
    expect(all).toContain('[aria-checked="true"]');
    expect(all).toContain(":focus-visible");
    expect(all).not.toContain("--icon-opacity");
    expect(all).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(/);
  });

  it("keeps the colours, the checked icon and the focus visible in forced colours", () => {
    const at = css.indexOf("@media (forced-colors: active) {\n  .hel-picker-dot { forced-color-adjust: none; }");
    expect(at).toBeGreaterThan(-1);
    const block = css.slice(at, css.indexOf("\n}", at));
    expect(block).toContain('[aria-checked="true"]:not(.is-color) { outline: 2px solid Highlight');
    expect(block).toContain(":focus-visible { outline: 2px solid CanvasText");
  });

  it("STYLING.md has a row for each class", () => {
    for (const name of ["hel-picker-grid", "hel-picker-cell", "hel-picker-icon", "hel-picker-dot"]) expect(styling).toContain(`\`${name}\``);
  });
});
