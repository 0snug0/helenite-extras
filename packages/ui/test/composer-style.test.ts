import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { composer, type ComposerField } from "../src";

const css = readFileSync(resolve(__dirname, "../../base-theme/css/06-design-system.css"), "utf8");
const styling = readFileSync(resolve(__dirname, "../../../docs/design-system/STYLING.md"), "utf8");
const host = () => document.body.appendChild(document.createElement("div"));
const tick = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  document.body.innerHTML = "";
});

describe("Finesse composer attachments", () => {
  it("has no attach button and a hidden chip row by default", () => {
    const c = composer(host(), { onSubmit: () => {} });
    expect(c.el.querySelector(".hel-composer-attach")).toBeNull();
    expect(c.el.classList.contains("has-attach")).toBe(false);
    expect(c.el.querySelector<HTMLElement>(".hel-composer-attachments")!.hidden).toBe(true);
  });

  it("onAttach adds the picked files as chips; remove drops one; submit sends them and clears", async () => {
    const onSubmit = vi.fn();
    const c = composer(host(), { onSubmit, onAttach: async () => [{ name: "a.md", data: 1 }, { name: "b.png", icon: "image" }] });
    const attach = c.el.querySelector<HTMLElement>(".hel-composer-attach")!;
    expect(attach.getAttribute("aria-label")).toBe("Attach");
    expect(c.el.classList.contains("has-attach")).toBe(true);
    attach.click();
    await tick();
    const chips = c.el.querySelector<HTMLElement>(".hel-composer-attachments")!;
    expect(chips.hidden).toBe(false);
    expect([...chips.querySelectorAll(".hel-composer-attachment-name")].map((n) => n.textContent)).toEqual(["a.md", "b.png"]);
    c.el.querySelectorAll<HTMLElement>(".hel-composer-attachment-remove")[1].click();
    expect(c.attachments().map((a) => a.name)).toEqual(["a.md"]);
    c.input.value = "hi";
    c.el.querySelector<HTMLElement>(".hel-composer-send")!.click();
    expect(onSubmit).toHaveBeenCalledWith("hi", [{ name: "a.md", data: 1 }]);
    expect(c.attachments()).toEqual([]);
    expect(chips.hidden).toBe(true);
    expect(chips.querySelector(".hel-composer-attachment")).toBeNull();
  });

  it("an attachment alone is enough to send; a failed submit keeps the chips", () => {
    const onSubmit = vi.fn(() => false);
    const c = composer(host(), { onSubmit });
    c.addAttachment({ name: "x.txt" });
    c.el.querySelector<HTMLElement>(".hel-composer-send")!.click();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(c.attachments()).toHaveLength(1);
    const remove = c.addAttachment({ name: "y.txt" });
    remove();
    expect(c.attachments().map((a) => a.name)).toEqual(["x.txt"]);
  });

  it("a blank box with no attachment is still not sent", () => {
    const onSubmit = vi.fn();
    const c = composer(host(), { onSubmit });
    c.el.querySelector<HTMLElement>(".hel-composer-send")!.click();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("Finesse composer styling", () => {
  it("the stylesheet gives the box the input rings and styles the chips and attach button", () => {
    for (const cls of [".hel-composer-attachments", ".hel-composer-attachment", ".hel-composer-attachment-remove", ".hel-composer-attach", ".hel-composer.has-attach"]) expect(css).toContain(cls);
    expect(css).toContain("textarea.hel-composer-input):focus { outline: none; box-shadow: var(--hel-ring-focus); }");
  });

  it("the composer rules use tokens only, so light and dark follow the theme", () => {
    const rules = css.split("\n").filter((l) => /^(\.hel-composer|:where\(textarea\.hel-composer)/.test(l)).join("\n");
    expect(rules.length).toBeGreaterThan(0);
    expect(rules).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(/);
  });

  it("STYLING.md has a row for each new class", () => {
    for (const name of ["`hel-composer-attach`", "`hel-composer-attachments`", "`hel-composer-attachment`"]) expect(styling).toContain(`| ${name} |`);
  });
});

/** A textarea-shaped contenteditable inside a wrapper, the shape an editor has. */
const editorInput = (parent: HTMLElement) => {
  const wrap = parent.appendChild(document.createElement("div"));
  wrap.className = "my-editor";
  const field = wrap.appendChild(document.createElement("div")) as unknown as ComposerField;
  field.setAttribute("contenteditable", "true");
  field.tabIndex = 0;
  Object.defineProperties(field, { value: { value: "", writable: true }, readOnly: { value: false, writable: true }, selectionStart: { value: 0 } });
  field.setSelectionRange = () => {};
  return field;
};

describe("composer around a custom input", () => {
  it("marks the element createInput added as the host, with the rows for its height", () => {
    const c = composer(host(), { rows: 5, createInput: editorInput, onSubmit: () => {} });
    const box = c.el.querySelector<HTMLElement>(":scope > .my-editor")!;
    expect(box.classList.contains("hel-composer-host")).toBe(true);
    expect(box.style.getPropertyValue("--hel-composer-rows")).toBe("5");
    // The input is the editor's own: an editor rewrites its classes, so the composer puts none there.
    expect(c.input.className).toBe("");
  });

  it("defaults to 3 rows, and a field added without a wrapper is its own host", () => {
    const bare = (p: HTMLElement) => {
      const f = editorInput(p);
      p.querySelector(".my-editor")!.remove();
      return p.appendChild(f) as ComposerField;
    };
    const c = composer(host(), { createInput: bare, onSubmit: () => {} });
    expect(c.input.classList.contains("hel-composer-host")).toBe(true);
    expect(c.input.style.getPropertyValue("--hel-composer-rows")).toBe("3");
  });

  it("the plain textarea has no host", () => {
    expect(composer(host(), { onSubmit: () => {} }).el.querySelector(".hel-composer-host")).toBeNull();
  });

  it("a press on the box's padding focuses the input, as it does on a textarea; a press inside or on the scrollbar is left alone", () => {
    const c = composer(host(), { createInput: editorInput, onSubmit: () => {} });
    const box = c.el.querySelector<HTMLElement>(".hel-composer-host")!;
    Object.defineProperty(box, "clientWidth", { value: 300 });
    const press = (target: HTMLElement, offsetX = 4) => {
      const e = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
      Object.defineProperty(e, "offsetX", { value: offsetX });
      target.dispatchEvent(e);
      return e.defaultPrevented;
    };
    expect(press(c.input)).toBe(false);
    expect(press(box, 305)).toBe(false);
    expect(press(box)).toBe(true);
    expect(document.activeElement).toBe(c.input);
  });

  const H = ".hel-composer > .hel-composer-host";
  const rule = (selector: string) => css.split("\n").find((l) => l.startsWith(`${selector} {`)) ?? "";

  it("gives the host the textarea's box, rings and a height from rows up to a scrolling maximum", () => {
    const parts = [
      "background-color: var(--background-modifier-form-field)",
      "box-shadow: var(--input-shadow)",
      "border-radius: var(--input-radius)",
      "font-size: var(--font-ui-small)",
      "height: auto",
      "min-height: calc(var(--hel-composer-rows, 3) * 1.5em",
      "max-height: var(--hel-composer-max-height, 320px)",
      "overflow-y: auto",
      // A field that is its own host would otherwise keep the browser's focus outline inside the ring.
      "outline: none",
    ];
    for (const part of parts) expect(rule(H)).toContain(part);
    expect(rule(`${H}:hover:not(:focus-within)`)).toContain("box-shadow: var(--input-shadow-hover)");
    expect(rule(`${H}:focus-within`)).toContain("box-shadow: var(--hel-ring-focus)");
  });

  it("resets the editor's own box and styles its text, caret, selection and thumbnails", () => {
    const rules = css.split("\n").filter((l) => l.startsWith(H)).join("\n");
    for (const cls of [".cm-editor", ".cm-scroller", ".cm-sizer", ".cm-contentContainer", ".cm-content", ".cm-line", ".cm-activeLine", ".cm-placeholder", ".cm-cursor", ".cm-dropCursor", ".cm-selectionBackground", ".image-embed img"]) expect(rules).toContain(cls);
    expect(rules).toContain("max-height: var(--hel-composer-thumb-size, 52px)");
  });

  it("STYLING.md has a row for the host", () => {
    expect(styling).toContain("| `hel-composer-host` |");
  });
});
