import { afterEach, describe, expect, it, vi } from "vitest";
import { popover, type PopoverCloseReason, type PopoverHandle } from "../src";

const open: PopoverHandle[] = [];
const make = (...a: Parameters<typeof popover>): PopoverHandle => {
  const p = popover(...a);
  open.push(p);
  return p;
};
afterEach(() => {
  for (const p of open.splice(0)) p.close();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
const key = (el: Element, k: string, o: KeyboardEventInit = {}): KeyboardEvent => {
  const e = new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...o });
  el.dispatchEvent(e);
  return e;
};
const mousedown = (el: Element): void => void el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
const button = (text = "Open"): HTMLButtonElement => {
  const b = document.createElement("button");
  b.textContent = text;
  document.body.append(b);
  return b;
};
/** happy-dom has no layout: give the window and every popover a size. */
function layout(w: number, h: number): void {
  Object.defineProperty(window, "innerWidth", { value: 1000, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const size = this.classList.contains("hel-popover") ? { width: w, height: h } : { width: 0, height: 0 };
    return { x: 0, y: 0, left: 0, top: 0, right: size.width, bottom: size.height, ...size, toJSON: () => ({}) } as DOMRect;
  });
}
const at = (p: PopoverHandle): [string, string, string | undefined] => [p.el.style.left, p.el.style.top, p.el.dataset.side];

describe("popover: parts", () => {
  it("is a labelled dialog on the body with a title, a body and a footer slot", () => {
    const p = make({ x: 10, y: 10 }, { title: "notes.md · line 3", icon: "message-circle" });
    expect(p.el.parentElement).toBe(document.body);
    expect(p.el.getAttribute("role")).toBe("dialog");
    expect(p.titleEl?.textContent).toBe("notes.md · line 3");
    expect(p.el.getAttribute("aria-labelledby")).toBe(p.titleEl?.id);
    expect([...p.el.children].map((c) => c.className)).toEqual(["hel-popover-head", "hel-popover-body", "hel-popover-footer"]);
    expect(p.head.querySelector(".hel-popover-icon")).not.toBeNull();
    expect(p.el.contains(p.body) && p.el.contains(p.footer)).toBe(true);
  });

  it("takes an accessible name without a title, a quote and a width", () => {
    const p = make({ x: 0, y: 0 }, { label: "Colors", quote: "a <b>quote</b>\nsecond", width: 380 });
    expect(p.titleEl).toBeNull();
    expect(p.el.getAttribute("aria-label")).toBe("Colors");
    const q = p.body.querySelector("blockquote.hel-popover-quote")!;
    expect(q.textContent).toBe("a <b>quote</b>\nsecond");
    expect(q.children).toHaveLength(0);
    expect(p.el.style.getPropertyValue("--hel-popover-width")).toBe("380px");
  });

  it("only one is open at a time", () => {
    const closed: PopoverCloseReason[] = [];
    const a = make({ x: 0, y: 0 }, { onClose: (r) => closed.push(r) });
    make({ x: 5, y: 5 });
    expect(a.el.isConnected).toBe(false);
    expect(closed).toEqual(["close"]);
    expect(document.querySelectorAll(".hel-popover")).toHaveLength(1);
  });

  it("opens inside the modal its anchor is in, so it draws above it and goes with it", () => {
    const modal = document.body.appendChild(document.createElement("div"));
    modal.className = "modal-container";
    const b = modal.appendChild(document.createElement("button"));
    expect(make(b).el.parentElement).toBe(modal);
    b.focus();
    expect(make({ x: 1, y: 1 }).el.parentElement).toBe(modal);
  });

  it("with nothing in a modal to go by, opens in the topmost one rather than under it", () => {
    const modals = [0, 1].map(() => {
      const m = document.body.appendChild(document.createElement("div"));
      m.className = "modal-container";
      return m;
    });
    (document.activeElement as HTMLElement | null)?.blur();
    expect(make({ x: 1, y: 1 }).el.parentElement).toBe(modals[1]);
    expect(make(button()).el.parentElement).toBe(modals[1]);
  });
});

describe("popover: placement", () => {
  it("opens under a point, left edges aligned", () => {
    layout(300, 200);
    expect(at(make({ x: 100, y: 100 }))).toEqual(["100px", "106px", "bottom"]);
  });

  it("opens under an anchor rect, and above it when there is no room below", () => {
    layout(300, 200);
    expect(at(make({ left: 100, right: 140, top: 100, bottom: 120 }))).toEqual(["100px", "126px", "bottom"]);
    expect(at(make({ left: 100, right: 140, top: 700, bottom: 720 }))).toEqual(["100px", "494px", "top"]);
  });

  it("prefers the side asked for while it fits", () => {
    layout(300, 200);
    expect(at(make({ x: 100, y: 500 }, { side: "top" }))).toEqual(["100px", "294px", "top"]);
    expect(at(make({ x: 100, y: 50 }, { side: "top" }))).toEqual(["100px", "56px", "bottom"]);
  });

  it("takes a DOMRect as a rectangle, not as the point its x and y name", () => {
    layout(300, 200);
    expect(at(make(new DOMRect(100, 100, 40, 20)))).toEqual(["100px", "126px", "bottom"]);
  });

  it("flips to the anchor's right edge near the window's right side, and clamps otherwise", () => {
    layout(300, 200);
    expect(at(make({ left: 900, right: 950, top: 10, bottom: 30 }))[0]).toBe("650px");
    expect(at(make({ x: 995, y: 10 }))[0]).toBe("692px");
    expect(at(make({ x: -50, y: 10 }))[0]).toBe("8px");
  });

  it("caps its height to the roomier side when it fits neither", () => {
    layout(300, 900);
    const p = make({ left: 10, right: 20, top: 300, bottom: 320 });
    expect(at(p)).toEqual(["10px", "326px", "bottom"]);
    expect(p.el.style.maxHeight).toBe("466px");
  });

  it("stays in a window too short for either side", () => {
    layout(300, 900);
    Object.defineProperty(window, "innerHeight", { value: 200, configurable: true });
    const p = popover({ left: 10, right: 20, top: 90, bottom: 110 });
    open.push(p);
    expect(parseFloat(p.el.style.top)).toBeGreaterThanOrEqual(8);
    expect(parseFloat(p.el.style.top) + parseFloat(p.el.style.maxHeight)).toBeLessThanOrEqual(192);
  });

  it("with no anchor it is centered", () => {
    layout(300, 200);
    expect(at(make(null))).toEqual(["350px", "240px", "bottom"]);
  });

  it("places again once its content is in, on resize, and follows an element anchor on scroll", async () => {
    layout(300, 200);
    const b = button();
    const rect = { left: 40, right: 80, top: 40, bottom: 60 };
    b.getBoundingClientRect = () => rect as DOMRect;
    const p = make(b);
    expect(at(p)).toEqual(["40px", "66px", "bottom"]);
    Object.assign(rect, { top: 20, bottom: 40 });
    document.dispatchEvent(new Event("scroll"));
    expect(p.el.style.top).toBe("46px");
    Object.assign(rect, { top: 30, bottom: 50 });
    window.dispatchEvent(new Event("resize"));
    expect(p.el.style.top).toBe("56px");
    Object.assign(rect, { top: 100, bottom: 120 });
    p.update();
    expect(p.el.style.top).toBe("126px");
  });
});

describe("popover: closing and focus", () => {
  it("focuses its first control once the content is in, or itself", async () => {
    const p = make({ x: 0, y: 0 });
    const input = p.body.appendChild(document.createElement("input"));
    await tick();
    expect(document.activeElement).toBe(input);
    const empty = make({ x: 0, y: 0 });
    await tick();
    expect(document.activeElement).toBe(empty.el);
  });

  it("keeps the focus its caller gave it", async () => {
    const p = make({ x: 0, y: 0 });
    p.body.appendChild(document.createElement("input"));
    const second = p.body.appendChild(document.createElement("input"));
    second.focus();
    await tick();
    expect(document.activeElement).toBe(second);
  });

  it("Escape inside it closes it and returns focus to what had it", async () => {
    const b = button();
    b.focus();
    const reasons: PopoverCloseReason[] = [];
    const p = make(b, { onClose: (r) => reasons.push(r) });
    const input = p.body.appendChild(document.createElement("input"));
    input.focus();
    const under = vi.fn();
    document.body.addEventListener("keydown", under);
    const e = key(input, "Escape");
    expect(p.el.isConnected).toBe(false);
    expect(e.defaultPrevented).toBe(true);
    expect(under).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(b);
    expect(reasons).toEqual(["escape"]);
    document.body.removeEventListener("keydown", under);
  });

  it("Escape outside it closes it too", () => {
    const p = make({ x: 0, y: 0 });
    key(document.body, "Escape");
    expect(p.el.isConnected).toBe(false);
  });

  it("leaves an Escape that something inside used, or that ends an IME composition", () => {
    const p = make({ x: 0, y: 0 });
    const input = p.body.appendChild(document.createElement("input"));
    key(input, "Escape", { isComposing: true });
    expect(p.el.isConnected).toBe(true);
    input.addEventListener("keydown", (e) => e.preventDefault(), { once: true });
    key(input, "Escape");
    expect(p.el.isConnected).toBe(true);
  });

  it("an outside click closes it; a click inside, on its anchor or on a menu does not", async () => {
    const b = button();
    const menu = document.body.appendChild(document.createElement("div"));
    menu.className = "menu";
    const reasons: PopoverCloseReason[] = [];
    const p = make(b, { onClose: (r) => reasons.push(r) });
    mousedown(p.body);
    mousedown(b);
    mousedown(menu);
    expect(p.el.isConnected).toBe(true);
    mousedown(document.body);
    expect(p.el.isConnected).toBe(false);
    expect(reasons).toEqual(["outside"]);
  });

  it("after an outside click focus returns, unless the click focused something else", async () => {
    const b = button();
    const other = button("Other");
    b.focus();
    const p = make({ x: 0, y: 0 });
    await tick();
    mousedown(document.body);
    await tick();
    expect(document.activeElement).toBe(b);
    expect(p.el.isConnected).toBe(false);
    make({ x: 0, y: 0 });
    await tick();
    mousedown(other);
    other.focus(); // what the browser does after the mousedown
    await tick();
    expect(document.activeElement).toBe(other);
  });

  it("close() returns focus to returnFocus, and does not take focus from elsewhere; closing twice is quiet", async () => {
    const target = button("Target");
    const other = button("Other");
    const onClose = vi.fn();
    const p = make({ x: 0, y: 0 }, { returnFocus: target, onClose });
    await tick();
    p.close();
    p.close();
    expect(document.activeElement).toBe(target);
    expect(onClose).toHaveBeenCalledTimes(1);
    const q = make({ x: 0, y: 0 }, { returnFocus: target });
    await tick();
    other.focus();
    q.close();
    expect(document.activeElement).toBe(other);
  });

  it("closes itself when something else removes it", async () => {
    const onClose = vi.fn();
    const p = make({ x: 0, y: 0 }, { onClose });
    p.el.remove();
    await tick();
    expect(onClose).toHaveBeenCalledWith("close");
  });
});
