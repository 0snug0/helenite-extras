import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { composer } from "../src";

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
