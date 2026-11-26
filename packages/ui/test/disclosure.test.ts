import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { badge, button, disclosure } from "../src";

const host = () => document.body.appendChild(document.createElement("div"));
const key = (el: Element, k: string) => {
  const e = new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true });
  el.dispatchEvent(e);
  return e;
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("disclosure", () => {
  it("is a card with a button head: lead, then the title and summary, and a closed body and footer", () => {
    const d = disclosure(host(), { title: "Which service?", summary: "Dropbox", compact: true, tone: "accent" });
    expect([...d.el.classList]).toEqual(expect.arrayContaining(["hel-card", "hel-disclosure", "is-compact", "is-accent"]));
    expect([...d.el.children]).toEqual([d.head, d.peek, d.body, d.footer]);
    expect(d.head.getAttribute("role")).toBe("button");
    expect(d.head.tabIndex).toBe(0);
    expect(d.head.getAttribute("aria-expanded")).toBe("false");
    expect(d.head.getAttribute("aria-controls")).toBe(d.body.id);
    expect(d.lead.parentElement).toBe(d.head);
    expect(d.head.lastElementChild!.classList.contains("hel-disclosure-heading")).toBe(true);
    expect(d.titleEl!.textContent).toBe("Which service?");
    expect(d.summaryEl.textContent).toBe("Dropbox");
    expect(d.titleEl!.nextElementSibling).toBe(d.summaryEl);
    expect(d.body.hidden).toBe(true);
    expect(d.footer.hidden).toBe(true);
    expect(d.el.classList.contains("is-open")).toBe(false);
  });

  it("gives every body its own id", () => {
    const a = disclosure(host(), { title: "A" }), b = disclosure(host(), { title: "B" });
    expect(a.body.id).not.toBe("");
    expect(a.body.id).not.toBe(b.body.id);
  });

  it("starts open with open: true, and setOpen shows and hides the body and footer", () => {
    const d = disclosure(host(), { title: "A", open: true });
    expect(d.body.hidden).toBe(false);
    expect(d.head.getAttribute("aria-expanded")).toBe("true");
    d.setOpen(false);
    expect(d.body.hidden).toBe(true);
    expect(d.footer.hidden).toBe(true);
    expect(d.head.getAttribute("aria-expanded")).toBe("false");
    d.setOpen(true);
    expect(d.footer.hidden).toBe(false);
    expect(d.el.classList.contains("is-open")).toBe(true);
  });

  it("leaves what is in peek on show while closed", () => {
    const d = disclosure(host(), { title: "A" });
    d.peek.append("The section's own text.");
    expect(d.peek.hidden).toBe(false);
    d.setOpen(true);
    d.setOpen(false);
    expect(d.peek.hidden).toBe(false);
  });

  it("sets the summary", () => {
    const d = disclosure(host(), { title: "A" });
    expect(d.summaryEl.textContent).toBe("");
    d.setSummary("two picked");
    expect(d.summaryEl.textContent).toBe("two picked");
  });

  it("opens and closes itself on a click, Enter or Space when no onToggle is given", () => {
    const d = disclosure(host(), { title: "A" });
    d.head.click();
    expect(d.body.hidden).toBe(false);
    d.head.click();
    expect(d.body.hidden).toBe(true);
    expect(key(d.head, "Enter").defaultPrevented).toBe(true);
    expect(d.body.hidden).toBe(false);
    expect(key(d.head, " ").defaultPrevented).toBe(true);
    expect(d.body.hidden).toBe(true);
    expect(key(d.head, "a").defaultPrevented).toBe(false);
    expect(d.body.hidden).toBe(true);
  });

  it("with onToggle it only asks: the caller decides with setOpen", () => {
    const onToggle = vi.fn();
    const d = disclosure(host(), { title: "A", onToggle });
    d.head.click();
    expect(onToggle).toHaveBeenLastCalledWith(true);
    expect(d.body.hidden).toBe(true);
    d.setOpen(true);
    key(d.head, " ");
    expect(onToggle).toHaveBeenLastCalledWith(false);
    expect(d.body.hidden).toBe(false);
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it("ignores clicks and keys from a control inside the head, but not from its badges", () => {
    const onToggle = vi.fn();
    const d = disclosure(host(), { title: "A", onToggle });
    const b = button(d.head, { text: "Remove" }).el;
    b.click();
    key(b, "Enter");
    key(b, " ");
    expect(onToggle).not.toHaveBeenCalled();
    badge(d.lead, "1").click();
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("still toggles when it sits inside another button-like element", () => {
    const outer = host();
    outer.setAttribute("role", "button");
    const d = disclosure(outer, { title: "A" });
    d.titleEl!.click();
    expect(d.body.hidden).toBe(false);
  });
});

describe("disclosure styling", () => {
  const css = readFileSync(resolve(__dirname, "../../base-theme/css/06-design-system.css"), "utf8");
  const styling = readFileSync(resolve(__dirname, "../../../docs/design-system/STYLING.md"), "utf8");

  it("a hidden slot of a card stays hidden, although the body is a flex column", () => {
    expect(css).toContain(".hel-card > [hidden] { display: none; }");
  });

  it("the head is clickable with a focus outline inside the card, and the closed summary is one line", () => {
    expect(css).toContain(".hel-disclosure > .hel-card-head { cursor: pointer; }");
    expect(css).toContain(".hel-disclosure > .hel-card-head:focus-visible { outline: 2px solid var(--interactive-accent); outline-offset: -2px; }");
    const summary = css.split("\n").find((l) => l.startsWith(".hel-disclosure-heading > .hel-disclosure-summary {"))!;
    expect(summary).toContain("white-space: nowrap");
    expect(summary).toContain("text-overflow: ellipsis");
    expect(css).toContain(".hel-disclosure.is-open > .hel-card-head .hel-disclosure-summary, .hel-disclosure-summary:empty { display: none; }");
  });

  it("empty lead and peek slots take no room", () => {
    expect(css).toContain(".hel-disclosure-lead:empty, .hel-disclosure-peek:empty { display: none; }");
  });

  it("STYLING.md has a row for each disclosure part", () => {
    for (const name of ["hel-disclosure", "hel-disclosure-lead", "hel-disclosure-heading", "hel-disclosure-summary", "hel-disclosure-peek"]) expect(styling).toContain(`| \`${name}\` |`);
  });
});
