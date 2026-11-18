import { afterEach, describe, expect, it, vi } from "vitest";
import { checkList, choiceList, field } from "../src";

const host = () => document.body.appendChild(document.createElement("div"));
const key = (el: Element, k: string) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));

afterEach(() => {
  document.body.innerHTML = "";
});

const OPTIONS = [
  { value: "mail", text: "Mail", detail: "Read and send mail" },
  { value: "cal", text: "Calendar" },
  { value: "files", text: "Files", disabled: true },
] as const;

describe("checkList", () => {
  it("draws a checkbox row per option with its detail, in a labelled group", () => {
    const c = checkList(host(), { options: [...OPTIONS], value: ["cal"], label: "Capabilities" });
    expect(c.el.classList.contains("hel-check-list")).toBe(true);
    expect(c.el.getAttribute("role")).toBe("group");
    expect(c.el.getAttribute("aria-label")).toBe("Capabilities");
    const rows = [...c.el.querySelectorAll<HTMLElement>(".hel-check")];
    expect(rows).toHaveLength(3);
    const boxes = rows.map((r) => r.querySelector<HTMLInputElement>("input[type=checkbox]")!);
    expect(boxes.map((b) => b.checked)).toEqual([false, true, false]);
    const detail = rows[0].querySelector(".hel-check-detail")!;
    expect(detail.textContent).toBe("Read and send mail");
    expect(boxes[0].getAttribute("aria-describedby")).toBe(detail.id);
    expect(rows[2].classList.contains("is-disabled")).toBe(true);
    expect(boxes[2].disabled).toBe(true);
    expect(rows[1].querySelector(".hel-check-detail")).toBeNull();
  });

  it("onChange gets the checked values in option order; value() and setValue agree", () => {
    const onChange = vi.fn();
    const c = checkList(host(), { options: [...OPTIONS], value: ["cal"], onChange });
    const boxes = [...c.el.querySelectorAll<HTMLInputElement>("input")];
    boxes[0].click();
    expect(onChange).toHaveBeenLastCalledWith(["mail", "cal"]);
    expect(c.value()).toEqual(["mail", "cal"]);
    boxes[1].click();
    expect(onChange).toHaveBeenLastCalledWith(["mail"]);
    c.setValue(["files", "cal"]);
    expect(c.value()).toEqual(["cal", "files"]);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("in a field the field's label names the group", () => {
    const f = field(host(), { label: "Scopes" });
    const c = checkList(f.control, { options: [...OPTIONS], value: [] });
    expect(c.el.getAttribute("aria-labelledby")).toBe(f.el.querySelector("label")!.id);
  });
});

describe("choiceList", () => {
  it("in a field the field's label names the list", () => {
    const f = field(host(), { label: "Start from" });
    const c = choiceList(f.control, { options: [{ value: "a", text: "A" }], onChange: () => {} });
    expect(c.el.getAttribute("aria-labelledby")).toBe(f.el.querySelector("label")!.id);
  });

  it("single: rows show text, detail, icon, tag and key; picking selects one and calls onChange", () => {
    const onChange = vi.fn();
    const c = choiceList(host(), {
      label: "Harness",
      options: [
        { value: "claude", text: "Claude Code", detail: "Anthropic", icon: "terminal", tag: "Recommended", key: "1" },
        { value: "codex", text: "Codex", key: "2" },
        { value: "none", text: "None", disabled: true },
      ],
      value: "codex",
      onChange,
    });
    expect(c.el.classList.contains("hel-choice-list")).toBe(true);
    expect(c.el.classList.contains("is-multi")).toBe(false);
    expect(c.el.getAttribute("role")).toBe("listbox");
    expect(c.el.getAttribute("aria-label")).toBe("Harness");
    const rows = [...c.el.querySelectorAll<HTMLElement>(".hel-choice")];
    expect(rows.map((r) => r.getAttribute("role"))).toEqual(["option", "option", "option"]);
    expect(rows[0].querySelector(".hel-choice-text")!.textContent).toBe("Claude Code");
    expect(rows[0].querySelector(".hel-choice-detail")!.textContent).toBe("Anthropic");
    expect(rows[0].querySelector<HTMLElement>(".hel-choice-icon")!.dataset.icon).toBe("terminal");
    expect(rows[0].querySelector(".hel-choice-tag")!.textContent).toBe("Recommended");
    expect(rows[0].querySelector(".hel-choice-key")!.textContent).toBe("1");
    expect(rows.map((r) => r.classList.contains("is-selected"))).toEqual([false, true, false]);
    expect(rows[1].getAttribute("aria-selected")).toBe("true");
    rows[0].click();
    expect(onChange).toHaveBeenLastCalledWith("claude");
    expect(rows.map((r) => r.classList.contains("is-selected"))).toEqual([true, false, false]);
    rows[2].click();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(rows[2].classList.contains("is-disabled")).toBe(true);
    expect(rows[2].getAttribute("aria-disabled")).toBe("true");
  });

  it("keyboard: arrows move focus over enabled rows, Enter and Space pick, an option's key picks it", () => {
    const onChange = vi.fn();
    const c = choiceList(host(), {
      options: [{ value: "a", text: "A", key: "1" }, { value: "b", text: "B", disabled: true }, { value: "c", text: "C", key: "3" }],
      onChange,
    });
    const rows = [...c.el.querySelectorAll<HTMLElement>(".hel-choice")];
    expect(rows.map((r) => r.tabIndex)).toEqual([0, -1, 0]);
    rows[0].focus();
    key(rows[0], "ArrowDown");
    expect(document.activeElement).toBe(rows[2]);
    key(rows[2], "ArrowUp");
    expect(document.activeElement).toBe(rows[0]);
    key(rows[0], "Enter");
    expect(onChange).toHaveBeenLastCalledWith("a");
    key(rows[0], "3");
    expect(onChange).toHaveBeenLastCalledWith("c");
    key(rows[2], " ");
    expect(onChange).toHaveBeenLastCalledWith("c");
  });

  it("multi: picking toggles, onChange gets the array in option order; setValue does not call onChange", () => {
    const onChange = vi.fn();
    const c = choiceList(host(), {
      multi: true,
      options: [{ value: "a", text: "A" }, { value: "b", text: "B" }, { value: "c", text: "C" }],
      value: ["c"],
      onChange,
    });
    expect(c.el.classList.contains("is-multi")).toBe(true);
    expect(c.el.getAttribute("aria-multiselectable")).toBe("true");
    const rows = [...c.el.querySelectorAll<HTMLElement>(".hel-choice")];
    rows[0].click();
    expect(onChange).toHaveBeenLastCalledWith(["a", "c"]);
    rows[2].click();
    expect(onChange).toHaveBeenLastCalledWith(["a"]);
    c.setValue(["b"]);
    expect(rows.map((r) => r.classList.contains("is-selected"))).toEqual([false, true, false]);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("rows carry data-value; a single list's array value is one value, not a list of them", () => {
    const c = choiceList<string | string[]>(host(), { options: [{ value: ["a", "b"], text: "Both" }, { value: "a", text: "A" }], value: ["a", "b"], onChange: () => {} });
    const rows = [...c.el.querySelectorAll<HTMLElement>(".hel-choice")];
    expect(rows.map((r) => r.dataset.value)).toEqual(["a,b", "a"]);
    const both = c.el.querySelectorAll(".hel-choice.is-selected");
    // The value ['a','b'] is not the option ['a','b'] by identity, and is not read as two values either.
    expect([...both].map((r) => r.textContent)).toEqual([]);
    const multi = choiceList(host(), { multi: true, options: [{ value: "a", text: "A" }, { value: "b", text: "B" }], value: ["b"], onChange: () => {} });
    expect([...multi.el.querySelectorAll(".hel-choice.is-selected")].map((r) => r.textContent)).toEqual(["B"]);
  });

  it("single setValue moves the selection without onChange", () => {
    const onChange = vi.fn();
    const c = choiceList(host(), { options: [{ value: "a", text: "A" }, { value: "b", text: "B" }], value: "a", onChange });
    c.setValue("b");
    expect([...c.el.querySelectorAll(".hel-choice.is-selected")].map((r) => r.textContent)).toEqual(["B"]);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("frame safety (choice parts)", () => {
  it("draw into the parent's document", () => {
    const doc = document.implementation.createHTMLDocument("frame");
    const parent = doc.body.appendChild(doc.createElement("div"));
    checkList(parent, { options: [{ value: "a", text: "A", detail: "d" }], value: [] });
    choiceList(parent, { options: [{ value: "a", text: "A", detail: "d", icon: "x", tag: "t", key: "1" }], onChange: () => {} });
    for (const el of parent.querySelectorAll("*")) expect(el.ownerDocument).toBe(doc);
  });
});
