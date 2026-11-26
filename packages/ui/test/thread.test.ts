import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { card, thread, threadText, type Thread } from "../src";

const css = readFileSync(resolve(__dirname, "../../base-theme/css/06-design-system.css"), "utf8");
const styling = readFileSync(resolve(__dirname, "../../../docs/design-system/STYLING.md"), "utf8");
const threadRules = css.split("\n").filter((l) => /^\.hel-thread/.test(l));

const host = () => document.body.appendChild(document.createElement("div"));

afterEach(() => {
  document.body.innerHTML = "";
});

describe("thread", () => {
  it("draws a list that takes entries, events and anything else in order", () => {
    const h = host();
    const t = thread(h);
    expect(h.firstElementChild).toBe(t.el);
    expect([...t.el.classList]).toEqual(["hel-thread"]);
    const e = t.entry();
    card(e.el, { title: "You" });
    const line = t.event("Nov 25 · Started\na session");
    expect([...t.el.children]).toEqual([e.el, line]);
    expect(e.el.tagName).toBe("ARTICLE");
    expect([...e.el.classList]).toEqual(["hel-thread-entry"]);
  });

  it("an event is a muted line that keeps its line breaks", () => {
    const line = thread(host()).event("a\nb");
    expect([...line.classList]).toEqual(["hel-thread-event", "hel-thread-text"]);
    expect(line.querySelector(".hel-status-text")!.textContent).toBe("a\nb");
  });

  it("makes the replies list once, under what the entry already holds", () => {
    const e = thread(host()).entry();
    expect(e.el.children.length).toBe(0);
    const c = card(e.el, { title: "You" });
    const replies = e.replies();
    expect(e.replies()).toBe(replies);
    expect([...e.el.children]).toEqual([c.el, replies.el]);
    expect([...replies.el.classList]).toEqual(["hel-thread-replies"]);
    const child = replies.entry();
    expect(child.el.parentElement).toBe(replies.el);
  });

  const flatAt = (t: Thread, levels: number) => Array.from({ length: levels }, () => {
    t = t.entry().replies();
    return t.el.classList.contains("is-flat");
  });

  it("stops indenting after three levels by default", () => {
    expect(flatAt(thread(host()), 5)).toEqual([false, false, false, true, true]);
  });

  it("takes its own depth, 0 meaning no indent at all", () => {
    expect(flatAt(thread(host(), { maxIndent: 1 }), 3)).toEqual([false, true, true]);
    expect(flatAt(thread(host(), { maxIndent: 0 }), 2)).toEqual([true, true]);
  });

  it("threadText sets text as text, never markup", () => {
    const h = host();
    const el = threadText(h, "<b>one</b>\ntwo");
    expect(h.firstElementChild).toBe(el);
    expect([...el.classList]).toEqual(["hel-thread-text"]);
    expect(el.textContent).toBe("<b>one</b>\ntwo");
    expect(el.children.length).toBe(0);
    expect(threadText(h).textContent).toBe("");
  });
});

describe("Finesse thread styling", () => {
  const rule = (start: string) => threadRules.find((l) => l.startsWith(start)) ?? "";

  it("spaces the entries and indents replies along a rail", () => {
    expect(rule(".hel-thread,")).toContain("gap: var(--size-4-2)");
    expect(rule(".hel-thread-replies {")).toContain("border-inline-start: 2px solid var(--hel-thread-rail)");
    expect(rule(".hel-thread-replies {")).toContain("var(--hel-thread-indent)");
    expect(css).toContain("--hel-thread-rail: var(--background-modifier-border)");
    expect(css).toContain("--hel-thread-indent: var(--size-4-3)");
  });

  it("a flat list is level with the one above: no margin, padding or rail", () => {
    for (const d of ["margin-inline-start: 0", "padding-inline-start: 0", "border-inline-start: 0"]) expect(rule(".hel-thread-replies.is-flat {")).toContain(d);
  });

  it("comment text keeps line breaks and wraps long words", () => {
    expect(rule(".hel-thread-text {")).toContain("white-space: pre-wrap");
    expect(rule(".hel-thread-text {")).toContain("overflow-wrap: anywhere");
  });

  it("uses tokens only, so light and dark follow the theme", () => {
    expect(threadRules.length).toBeGreaterThan(0);
    expect(threadRules.join("\n")).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(/);
  });

  it("STYLING.md has a row for each class and variable", () => {
    for (const name of ["`hel-thread`", "`hel-thread-entry`", "`hel-thread-replies`", "`hel-thread-event`", "`hel-thread-text`", "`--hel-thread-rail`", "`--hel-thread-indent`"]) expect(styling).toContain(`| ${name} |`);
  });
});
