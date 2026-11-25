import { describe, expect, it, vi } from "vitest";
import { badge, emptyState, errorState, loadingState, statusDot, statusText } from "../src";

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

describe("states: variants, warning tone, statusText, pulse", () => {
  it("emptyState variants: centered by default, inline is a settings description, pane is Obsidian's pane-empty", () => {
    expect([...emptyState(host(), "x").classList]).toEqual(["hel-empty"]);
    expect([...emptyState(host(), "x", { variant: "inline" }).classList]).toEqual(["hel-empty", "is-inline", "setting-item-description"]);
    expect([...emptyState(host(), "x", { variant: "pane" }).classList]).toEqual(["hel-empty", "is-pane", "pane-empty"]);
  });

  it("errorState takes a variant and a retry label", () => {
    const retry = vi.fn();
    const e = errorState(host(), "Failed", retry, { variant: "inline", retryLabel: "Reconnect" });
    expect([...e.classList]).toEqual(["hel-error", "is-inline"]);
    const b = e.querySelector<HTMLButtonElement>("button.hel-button")!;
    expect(b.textContent).toBe("Reconnect");
    b.click();
    expect(retry).toHaveBeenCalledTimes(1);
    expect(errorState(host(), "x", undefined, { variant: "pane" }).classList.contains("is-pane")).toBe(true);
    expect([...errorState(host(), "x").classList]).toEqual(["hel-error"]);
  });

  it("the warning tone reaches badge, statusDot and statusText", () => {
    expect(badge(host(), "Stale", "warning").classList.contains("is-warning")).toBe(true);
    expect(statusDot(host(), "warning", "Busy").classList.contains("is-warning")).toBe(true);
    const t = statusText(host(), "Partly works", "warning");
    expect([...t.classList]).toEqual(["hel-status-text", "is-warning"]);
    expect(t.textContent).toBe("Partly works");
    expect(t.tagName).toBe("SPAN");
  });

  it("statusText setTone swaps the tone class and keeps the text", () => {
    const t = statusText(host(), "idle");
    t.setTone("warning");
    expect([...t.classList]).toEqual(["hel-status-text", "is-warning"]);
    t.setTone("danger");
    expect([...t.classList]).toEqual(["hel-status-text", "is-danger"]);
    t.setTone("default");
    expect([...t.classList]).toEqual(["hel-status-text", "is-default"]);
    expect(t.textContent).toBe("idle");
  });

  it("statusDot pulses only when asked", () => {
    expect(statusDot(host(), "warning", "Waiting", { pulse: true }).classList.contains("is-pulse")).toBe(true);
    expect(statusDot(host(), "success", "Idle").classList.contains("is-pulse")).toBe(false);
  });
});

describe("loadingState: spinner and determinate progress", () => {
  it("draws a spinner, the text and a hidden progress bar; no value until progress is set", () => {
    const l = loadingState(host(), "Syncing…");
    expect(l.querySelector(".hel-spinner")?.getAttribute("aria-hidden")).toBe("true");
    expect(l.querySelector(".hel-loading-text")?.textContent).toBe("Syncing…");
    const bar = l.querySelector(".hel-progress")!;
    expect(bar.getAttribute("role")).toBe("progressbar");
    expect(bar.getAttribute("aria-label")).toBe("Syncing…");
    expect(bar.hasAttribute("aria-valuenow")).toBe(false);
    expect(l.classList.contains("is-determinate")).toBe(false);
  });

  it("progress option shows the bar at that share, clamped to 0 to 100", () => {
    const l = loadingState(host(), "Uploading", { progress: 0.4 });
    const bar = l.querySelector(".hel-progress")!;
    expect(l.classList.contains("is-determinate")).toBe(true);
    expect(bar.getAttribute("aria-valuenow")).toBe("40");
    expect(l.querySelector<HTMLElement>(".hel-progress-fill")!.style.width).toBe("40%");
    l.setProgress(2);
    expect(bar.getAttribute("aria-valuenow")).toBe("100");
    l.setProgress(-1);
    expect(bar.getAttribute("aria-valuenow")).toBe("0");
  });

  it("setProgress(undefined) goes back to the spinner", () => {
    const l = loadingState(host(), "Working", { progress: 0.5 });
    l.setProgress(undefined);
    expect(l.classList.contains("is-determinate")).toBe(false);
    expect(l.querySelector(".hel-progress")!.hasAttribute("aria-valuenow")).toBe(false);
    expect(l.querySelector<HTMLElement>(".hel-progress-fill")!.style.width).toBe("");
  });
});

describe("statusText: all tones", () => {
  it("renders every tone with its class and text, and setTone round-trips through all of them", () => {
    const tones = ["default", "accent", "danger", "success", "warning"] as const;
    for (const tone of tones) {
      const t = statusText(host(), "Connected", tone);
      expect([...t.classList]).toEqual(["hel-status-text", `is-${tone}`]);
      expect(t.textContent).toBe("Connected");
      for (const next of tones) {
        t.setTone(next);
        expect([...t.classList]).toEqual(["hel-status-text", `is-${next}`]);
      }
    }
  });
});
