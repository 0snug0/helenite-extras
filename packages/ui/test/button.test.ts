import { afterEach, describe, expect, it, vi } from "vitest";
import { button } from "../src";

const host = () => document.body.appendChild(document.createElement("div"));
afterEach(() => vi.restoreAllMocks());
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("button", () => {
  it("primary is hel-button is-primary mod-cta; danger adds mod-warning; icon adds clickable-icon and aria-label", () => {
    const p = button(host(), { text: "Go", variant: "primary" });
    expect(p.el.classList.contains("hel-button")).toBe(true);
    expect(p.el.classList.contains("is-primary")).toBe(true);
    expect(p.el.classList.contains("mod-cta")).toBe(true);
    const d = button(host(), { text: "Del", variant: "danger" });
    expect(d.el.classList.contains("mod-warning")).toBe(true);
    const i = button(host(), { icon: "x", label: "Close", variant: "icon" });
    expect(i.el.classList.contains("clickable-icon")).toBe(true);
    expect(i.el.getAttribute("aria-label")).toBe("Close");
    expect(i.el.querySelector<HTMLElement>(".hel-button-icon")?.dataset.icon).toBe("x");
  });

  it('throws "ui.button: an icon button needs a label" for variant icon without label', () => {
    expect(() => button(host(), { icon: "x", variant: "icon" })).toThrow("ui.button: an icon button needs a label");
  });

  it("an onClick returning a promise sets is-busy, disabled and aria-busy until it settles, also on reject; a second click while busy does not call onClick", async () => {
    let resolve!: () => void;
    const onClick = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    const b = button(host(), { text: "Save", onClick });
    b.el.click();
    expect(b.el.classList.contains("is-busy")).toBe(true);
    expect(b.el.disabled).toBe(true);
    expect(b.el.getAttribute("aria-busy")).toBe("true");
    b.el.dispatchEvent(new MouseEvent("click"));
    expect(onClick).toHaveBeenCalledTimes(1);
    resolve();
    await flush();
    expect(b.el.classList.contains("is-busy")).toBe(false);
    expect(b.el.disabled).toBe(false);
    expect(b.el.hasAttribute("aria-busy")).toBe(false);

    vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = button(host(), { text: "Fail", onClick: () => Promise.reject(new Error("no")) });
    failing.el.click();
    expect(failing.el.classList.contains("is-busy")).toBe(true);
    await flush();
    expect(failing.el.classList.contains("is-busy")).toBe(false);
    expect(failing.el.disabled).toBe(false);
  });

  it("pressed sets aria-pressed=\"true\" and is-active; setPressed(false) clears both", () => {
    const b = button(host(), { text: "T", pressed: true });
    expect(b.el.getAttribute("aria-pressed")).toBe("true");
    expect(b.el.classList.contains("is-active")).toBe(true);
    b.setPressed(false);
    expect(b.el.getAttribute("aria-pressed")).toBe("false");
    expect(b.el.classList.contains("is-active")).toBe(false);
  });

  it("logs a rejected onClick promise via console.error and still clears busy", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("boom");
    const b = button(host(), { text: "X", onClick: () => Promise.reject(err) });
    b.el.click();
    await flush();
    expect(spy).toHaveBeenCalledWith(err);
    expect(b.el.classList.contains("is-busy")).toBe(false);
  });

  it("setText sets and updates the text", () => {
    const b = button(host(), { icon: "x" });
    b.setText("One");
    b.setText("Two");
    expect(b.el.querySelectorAll(".hel-button-text").length).toBe(1);
    expect(b.el.textContent).toBe("Two");
  });

  it("draggable sets the attribute, and is-dragging for as long as it is dragged", () => {
    const b = button(host(), { text: "Read", draggable: true });
    expect(b.el.getAttribute("draggable")).toBe("true");
    expect(b.el.classList.contains("is-dragging")).toBe(false);
    b.el.dispatchEvent(new Event("dragstart"));
    expect(b.el.classList.contains("is-dragging")).toBe(true);
    b.el.dispatchEvent(new Event("dragend"));
    expect(b.el.classList.contains("is-dragging")).toBe(false);
  });

  it("is not draggable unless asked", () => {
    const b = button(host(), { text: "Read" });
    expect(b.el.hasAttribute("draggable")).toBe(false);
    b.el.dispatchEvent(new Event("dragstart"));
    expect(b.el.classList.contains("is-dragging")).toBe(false);
  });

  it("link variant adds is-link", () => {
    expect(button(host(), { text: "L", variant: "link" }).el.classList.contains("is-link")).toBe(true);
  });

  it("setBusy(false) does not re-enable a button disabled via setDisabled(true)", () => {
    const b = button(host(), { text: "D" });
    b.setDisabled(true);
    b.setBusy(true);
    b.setBusy(false);
    expect(b.el.disabled).toBe(true);
    b.setDisabled(false);
    expect(b.el.disabled).toBe(false);
  });
});
