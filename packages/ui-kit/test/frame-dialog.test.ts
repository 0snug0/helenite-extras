import { afterEach, describe, expect, it, vi } from "vitest";
import { frameDialog } from "../src";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("frameDialog", () => {
  it("draws a named dialog on the body, closes from the backdrop and Escape, and is removed by destroy", () => {
    const onClose = vi.fn();
    const d = frameDialog({ label: "Releases for Heat", onClose });
    expect(d.el.parentElement).toBe(document.body);
    expect(d.modal.getAttribute("role")).toBe("dialog");
    expect(d.modal.getAttribute("aria-label")).toBe("Releases for Heat");
    expect(d.body.parentElement).toBe(d.modal);
    expect(document.activeElement).toBe(d.modal);
    d.el.querySelector<HTMLElement>(".modal-bg")!.click();
    d.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(onClose).toHaveBeenCalledTimes(2);
    d.destroy();
    expect(document.body.children.length).toBe(0);
  });
});
