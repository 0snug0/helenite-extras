import { describe, expect, it, vi } from "vitest";
import { badge, emptyState, errorState, loadingState, statusDot } from "../src";

const host = () => document.body.appendChild(document.createElement("div"));

describe("states", () => {
  it("emptyState and loadingState render hel- parts with text; loading defaults to Loading…", () => {
    const e = emptyState(host(), "No items");
    expect(e.classList.contains("hel-empty")).toBe(true);
    expect(e.textContent).toBe("No items");
    const l = loadingState(host());
    expect(l.classList.contains("hel-loading")).toBe(true);
    expect(l.textContent).toBe("Loading…");
    expect(l.getAttribute("role")).toBe("status");
  });

  it("errorState with retry renders a hel-button \"Try again\" calling retry; without retry no button", () => {
    const retry = vi.fn();
    const e = errorState(host(), "Failed", retry);
    expect(e.classList.contains("hel-error")).toBe(true);
    expect(e.getAttribute("role")).toBe("alert");
    expect(e.textContent).toContain("Failed");
    const b = e.querySelector<HTMLButtonElement>("button.hel-button")!;
    expect(b.textContent).toBe("Try again");
    b.click();
    expect(retry).toHaveBeenCalledTimes(1);
    expect(errorState(host(), "x").querySelector("button")).toBeNull();
  });

  it("badge has tone class; statusDot has aria-label", () => {
    const b = badge(host(), "New", "accent");
    expect(b.classList.contains("hel-badge")).toBe(true);
    expect(b.classList.contains("is-accent")).toBe(true);
    expect(b.textContent).toBe("New");
    expect(badge(host(), "x").classList.contains("is-default")).toBe(true);
    const d = statusDot(host(), "success", "Running");
    expect(d.classList.contains("hel-status-dot")).toBe(true);
    expect(d.classList.contains("is-success")).toBe(true);
    expect(d.getAttribute("aria-label")).toBe("Running");
  });
});
