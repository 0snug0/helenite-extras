import { describe, expect, it, vi } from "vitest";
import { chip, countBadge } from "../src";

const host = () => document.body.appendChild(document.createElement("div"));

describe("countBadge", () => {
  it("shows the count, hides at 0 and caps at max with a plus", () => {
    const b = countBadge(host(), 3);
    expect(b.el.classList.contains("hel-count-badge")).toBe(true);
    expect(b.el.textContent).toBe("3");
    expect(b.el.hidden).toBe(false);
    b.set(0);
    expect(b.el.hidden).toBe(true);
    b.set(12);
    expect(b.el.hidden).toBe(false);
    expect(b.el.textContent).toBe("9+");
    expect(countBadge(host(), 120, { max: 99 }).el.textContent).toBe("99+");
    expect(countBadge(host(), 0).el.hidden).toBe(true);
  });

  it("pulse adds is-pulse; label gives a spoken count", () => {
    const b = countBadge(host(), 2, { pulse: true, label: "waiting" });
    expect(b.el.classList.contains("is-pulse")).toBe(true);
    expect(b.el.getAttribute("aria-label")).toBe("2 waiting");
    b.set(5);
    expect(b.el.getAttribute("aria-label")).toBe("5 waiting");
    expect(countBadge(host(), 1).el.classList.contains("is-pulse")).toBe(false);
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
