import { describe, expect, it, vi } from "vitest";
import { chip, countBadge } from "../src";

const host = () => document.body.appendChild(document.createElement("div"));

describe("countBadge", () => {
  it("shows the count, hides at 0 and caps at max with a plus", () => {
    const shown = (b: { el: HTMLElement }) => b.el.querySelector("[aria-hidden=true]")!.textContent;
    const b = countBadge(host(), 3);
    expect(b.el.classList.contains("hel-count-badge")).toBe(true);
    expect(shown(b)).toBe("3");
    expect(b.el.hidden).toBe(false);
    b.set(0);
    expect(b.el.hidden).toBe(true);
    b.set(12);
    expect(b.el.hidden).toBe(false);
    expect(shown(b)).toBe("9+");
    expect(shown(countBadge(host(), 120, { max: 99 }))).toBe("99+");
    expect(countBadge(host(), 0).el.hidden).toBe(true);
  });

  it("pulse adds is-pulse; the count is spoken from a live region, exact and with the label", () => {
    const spoken = (b: { el: HTMLElement }) => b.el.querySelector(".hel-count-badge-spoken")!.textContent;
    const b = countBadge(host(), 2, { pulse: true, label: "waiting" });
    expect(b.el.classList.contains("is-pulse")).toBe(true);
    expect(b.el.getAttribute("role")).toBe("status");
    expect(spoken(b)).toBe("2 waiting");
    b.set(12);
    expect(spoken(b)).toBe("12 waiting"); // the reader hears the exact count, not "9+"
    expect(b.el.querySelector(".hel-count-badge-spoken")!.getAttribute("aria-hidden")).toBeNull();
    expect(spoken(countBadge(host(), 4))).toBe("4");
    expect(countBadge(host(), 1).el.classList.contains("is-pulse")).toBe(false);
  });

  it("tone is accent by default, danger or warning for attention; an icon sits before the number, hidden from readers", () => {
    expect([...countBadge(host(), 1).el.classList]).toEqual(["hel-count-badge", "is-accent"]);
    expect(countBadge(host(), 1, { tone: "danger" }).el.classList.contains("is-danger")).toBe(true);
    expect(countBadge(host(), 1, { tone: "warning" }).el.classList.contains("is-warning")).toBe(true);
    const b = countBadge(host(), 3, { tone: "danger", icon: "circle-help", label: "waiting" });
    const icon = b.el.firstElementChild as HTMLElement;
    expect(icon.classList.contains("hel-count-badge-icon")).toBe(true);
    expect(icon.dataset.icon).toBe("circle-help");
    expect(icon.getAttribute("aria-hidden")).toBe("true");
    expect(b.el.textContent).toBe("33 waiting"); // the shown number and the spoken count; the icon adds no text
    expect(countBadge(host(), 1).el.querySelector(".hel-count-badge-icon")).toBeNull();
  });
});

describe("chip", () => {
  it("renders text with a tone class (default when none) and a title", () => {
    const c = chip(host(), "draft", { tone: "accent", title: "Status" });
    expect([...c.classList]).toEqual(["hel-chip", "is-accent"]);
    expect(c.textContent).toBe("draft");
    expect(c.title).toBe("Status");
    expect(chip(host(), "x").classList.contains("is-default")).toBe(true);
    expect(chip(host(), "x").querySelector("button")).toBeNull();
  });

  it("onRemove adds a labelled remove button that removes the chip and calls back", () => {
    const parent = host();
    const onRemove = vi.fn();
    const c = chip(parent, "work", { onRemove });
    const b = c.querySelector<HTMLButtonElement>("button.hel-chip-remove")!;
    expect(b.getAttribute("aria-label")).toBe("Remove work");
    expect(b.dataset.icon).toBe("x");
    b.click();
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(parent.contains(c)).toBe(false);
  });
});
