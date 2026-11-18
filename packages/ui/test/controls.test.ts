import { afterEach, describe, expect, it, vi } from "vitest";
import { dropdown, field, searchInput, slider, textInput, toggle, toolbar } from "../src";

const host = () => document.body.appendChild(document.createElement("div"));
const key = (el: Element, k: string) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
const type = (el: HTMLInputElement, v: string) => {
  el.value = v;
  el.dispatchEvent(new Event("input"));
};

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("field", () => {
  it("has a label, a control slot, a hint, and an error line hidden until set", () => {
    const f = field(host(), { label: "Name", hint: "Shown in the sidebar." });
    expect(f.el.classList.contains("hel-field")).toBe(true);
    expect(f.el.querySelector(".hel-field-label")!.textContent).toBe("Name");
    expect(f.el.querySelector(".hel-field-hint")!.textContent).toBe("Shown in the sidebar.");
    expect(f.control.classList.contains("hel-field-control")).toBe(true);
    const error = f.el.querySelector<HTMLElement>(".hel-field-error")!;
    expect(error.hidden).toBe(true);
    const input = textInput(f.control, {});
    f.setError("Enter a name.");
    expect(error.hidden).toBe(false);
    expect(error.textContent).toBe("Enter a name.");
    expect(f.el.classList.contains("is-invalid")).toBe(true);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    f.setError(null);
    expect(error.hidden).toBe(true);
    expect(input.hasAttribute("aria-invalid")).toBe(false);
    expect(field(host(), { label: "x", inline: true }).el.classList.contains("is-inline")).toBe(true);
  });

  it("a control drawn into the slot is named by the label and described by the hint and error", () => {
    const f = field(host(), { label: "Name", hint: "hint" });
    const input = textInput(f.control, {});
    const label = f.el.querySelector("label")!;
    expect(input.getAttribute("aria-labelledby")).toBe(label.id);
    expect(label.htmlFor).toBe(input.id);
    const ids = input.getAttribute("aria-describedby")!.split(" ");
    expect(ids).toEqual([f.el.querySelector(".hel-field-hint")!.id, f.el.querySelector(".hel-field-error")!.id]);
    const d = dropdown(field(host(), { label: "Kind" }).control, { options: [{ value: "a", text: "A" }] });
    expect(d.el.getAttribute("aria-labelledby")).toBeTruthy();
  });

  it("an explicit label wins over the field's", () => {
    const f = field(host(), { label: "Name" });
    const input = textInput(f.control, { label: "Full name" });
    expect(input.getAttribute("aria-label")).toBe("Full name");
    expect(input.hasAttribute("aria-labelledby")).toBe(false);
  });
});

describe("textInput", () => {
  it("fires onInput and onEnter and keeps its value", () => {
    const onInput = vi.fn(), onEnter = vi.fn();
    const i = textInput(host(), { value: "x", placeholder: "Name", label: "Name", onInput, onEnter });
    expect(i.classList.contains("hel-input")).toBe(true);
    expect(i.type).toBe("text");
    expect(i.value).toBe("x");
    expect(i.placeholder).toBe("Name");
    expect(i.getAttribute("aria-label")).toBe("Name");
    type(i, "y");
    key(i, "Enter");
    expect(onInput).toHaveBeenCalledWith("y");
    expect(onEnter).toHaveBeenCalledWith("y");
  });

  it("secret is a password input with is-secret; type number", () => {
    const s = textInput(host(), { secret: true });
    expect(s.type).toBe("password");
    expect(s.classList.contains("is-secret")).toBe(true);
    expect(textInput(host(), { type: "number" }).type).toBe("number");
  });
});

describe("searchInput", () => {
  it("sits in Obsidian's search-input-container with a clear button and debounces", () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    const parent = host();
    const s = searchInput(parent, { delayMs: 100, onSearch, placeholder: "Filter plugins" });
    const wrap = parent.querySelector(".search-input-container")!;
    expect(s.parentElement).toBe(wrap);
    expect([...s.classList]).toEqual(["hel-input", "hel-search"]);
    expect(s.type).toBe("search");
    expect(s.getAttribute("aria-label")).toBe("Filter plugins");
    const clear = wrap.querySelector<HTMLElement>(".search-input-clear-button")!;
    expect(clear.style.display).toBe("none");
    for (const v of ["a", "ab", "abc"]) type(s, v);
    expect(clear.style.display).toBe("");
    vi.advanceTimersByTime(99);
    expect(onSearch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith("abc");
  });

  it("Enter and the clear button search at once", () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    const parent = host();
    const s = searchInput(parent, { value: "old", onSearch });
    expect(s.value).toBe("old");
    type(s, "new");
    key(s, "Enter");
    expect(onSearch).toHaveBeenLastCalledWith("new");
    (parent.querySelector(".search-input-clear-button") as HTMLElement).click();
    expect(onSearch).toHaveBeenLastCalledWith("");
    expect(s.value).toBe("");
    vi.advanceTimersByTime(500);
    expect(onSearch).toHaveBeenCalledTimes(2); // the pending debounce was cancelled
  });
});

describe("toggle", () => {
  it("emits Obsidian's checkbox-container with is-enabled, and a label", () => {
    const t = toggle(host(), { value: true, label: "Sync" });
    expect(t.el.classList.contains("hel-toggle")).toBe(true);
    const box = t.el.querySelector(".checkbox-container")!;
    expect(box.classList.contains("is-enabled")).toBe(true);
    expect(t.el.querySelector(".hel-toggle-label")!.textContent).toBe("Sync");
    const input = box.querySelector("input")!;
    expect(input.type).toBe("checkbox");
    expect(input.getAttribute("role")).toBe("switch");
    expect(input.checked).toBe(true);
  });

  it("clicking flips it and calls onChange; Enter flips it; setValue is silent", () => {
    const onChange = vi.fn();
    const t = toggle(host(), { value: false, label: "Sync", onChange });
    const box = t.el.querySelector(".checkbox-container")!;
    const input = box.querySelector("input")!;
    input.click();
    expect(onChange).toHaveBeenLastCalledWith(true);
    expect(box.classList.contains("is-enabled")).toBe(true);
    key(input, "Enter");
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(box.classList.contains("is-enabled")).toBe(false);
    t.setValue(true);
    expect(input.checked).toBe(true);
    expect(box.classList.contains("is-enabled")).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("disabled does not flip", () => {
    const onChange = vi.fn();
    const t = toggle(host(), { value: false, label: "Sync", disabled: true, onChange });
    const input = t.el.querySelector("input")!;
    expect(input.disabled).toBe(true);
    expect(t.el.classList.contains("is-disabled")).toBe(true);
    input.click();
    expect(onChange).not.toHaveBeenCalled();
    t.setDisabled(false);
    expect(t.el.classList.contains("is-disabled")).toBe(false);
    input.click();
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("dropdown", () => {
  it("is a select with Obsidian's dropdown class; fires onChange; setValue and setDisabled", () => {
    const onChange = vi.fn();
    const d = dropdown(host(), { options: [{ value: "1", text: "One" }, { value: "2", text: "Two" }], value: "2", label: "Count", onChange });
    expect([...d.el.classList]).toEqual(["hel-select", "dropdown"]);
    expect(d.el.getAttribute("aria-label")).toBe("Count");
    expect(d.el.value).toBe("2");
    expect([...d.el.options].map((o) => o.textContent)).toEqual(["One", "Two"]);
    d.el.value = "1";
    d.el.dispatchEvent(new Event("change"));
    expect(onChange).toHaveBeenCalledWith("1");
    d.setValue("2");
    expect(d.el.value).toBe("2");
    d.setDisabled(true);
    expect(d.el.disabled).toBe(true);
    expect(dropdown(host(), { options: [], compact: true }).el.classList.contains("is-compact")).toBe(true);
  });
});

describe("slider and toolbar", () => {
  it("slider is Obsidian's range slider and reports numbers", () => {
    const onChange = vi.fn();
    const s = slider(host(), { min: 8, max: 32, step: 2, value: 14, label: "Font size", onChange });
    expect(s.type).toBe("range");
    expect([...s.classList]).toEqual(["slider", "hel-slider"]);
    expect([s.min, s.max, s.step, s.value]).toEqual(["8", "32", "2", "14"]);
    expect(s.getAttribute("aria-label")).toBe("Font size");
    s.value = "20";
    s.dispatchEvent(new Event("input"));
    expect(onChange).toHaveBeenCalledWith(20);
  });

  it("toolbar is a labelled role=toolbar row", () => {
    const t = toolbar(host(), { label: "Filters" });
    expect(t.classList.contains("hel-toolbar")).toBe(true);
    expect(t.getAttribute("role")).toBe("toolbar");
    expect(t.getAttribute("aria-label")).toBe("Filters");
    expect(toolbar(host()).hasAttribute("aria-label")).toBe(false);
  });
});

describe("frame safety", () => {
  it("parts draw into the parent's document, not the global one", () => {
    const doc = document.implementation.createHTMLDocument("frame");
    const parent = doc.body.appendChild(doc.createElement("div"));
    const f = field(parent, { label: "Name" });
    textInput(f.control, {});
    toggle(parent, { value: true, label: "On" });
    dropdown(parent, { options: [{ value: "a", text: "A" }] });
    searchInput(parent, { onSearch: () => {} });
    for (const el of parent.querySelectorAll("*")) expect(el.ownerDocument).toBe(doc);
  });
});
