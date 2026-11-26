import { describe, expect, it, vi } from "vitest";
import { STANDARD_ACTIONS, action, densityAction, menuButton, moreButton, paneHeader, setBridge } from "../src";
import { fakeHost } from "./setup";

const host = () => document.body.appendChild(document.createElement("div"));
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("action", () => {
  it("draws the standard icon, label and variant", () => {
    const b = action(host(), "add", { onClick: () => {} });
    expect(b.el.classList.contains("is-primary")).toBe(true);
    expect(b.el.textContent).toBe("Add");
    expect(b.el.querySelector<HTMLElement>(".hel-button-icon")?.dataset.icon).toBe(STANDARD_ACTIONS.add.icon);
    expect(b.el.querySelector("svg")).not.toBeNull(); // the kit draws the standard icons
    const back = action(host(), "back", { onClick: () => {} });
    expect(back.el.getAttribute("aria-label")).toBe("Back");
    expect(back.el.textContent).toBe("");
  });

  it("variant icon makes a text action an icon button labelled by its label", () => {
    const b = action(host(), "reset", { onClick: () => {}, variant: "icon", label: "Reset hotkey" });
    expect(b.el.classList.contains("clickable-icon")).toBe(true);
    expect(b.el.getAttribute("aria-label")).toBe("Reset hotkey");
  });

  it("delete needs a subject", () => {
    expect(() => action(host(), "delete", { onClick: () => {} })).toThrow("ui-kit action: delete needs a subject");
  });

  it("delete asks in a host confirm and runs onClick only when confirmed", async () => {
    const yes = fakeHost({ modal: { action: "action", values: {} } });
    setBridge(yes.api);
    const onClick = vi.fn();
    action(host(), "delete", { onClick, subject: "the note" }).el.click();
    await flush();
    expect(yes.calls.modal[0]).toMatchObject({ title: "Delete the note", body: [{ text: "Delete the note? This cannot be undone." }] });
    expect(yes.calls.modal[0].actions?.[1]).toEqual({ id: "action", label: "Delete", danger: true });
    expect(onClick).toHaveBeenCalledOnce();

    setBridge(fakeHost({ modal: { action: "cancel", values: {} } }).api);
    const no = vi.fn();
    action(host(), "remove", { onClick: no, subject: "Alien", confirmText: "Remove film" }).el.click();
    await flush();
    expect(no).not.toHaveBeenCalled();
  });
});

describe("moreButton and menuButton", () => {
  const items = (run: () => void) => () => [{ title: "Rename", onClick: run }, "separator" as const, { title: "Delete", danger: true, onClick: () => {} }];

  it("moreButton opens items() as a host menu under the button and runs the chosen one", async () => {
    const h = fakeHost({ menu: "0" });
    setBridge(h.api);
    const run = vi.fn();
    const b = moreButton(host(), items(run));
    expect(b.el.getAttribute("aria-label")).toBe("More");
    expect(b.el.querySelector<HTMLElement>(".hel-button-icon")?.dataset.icon).toBe("more-horizontal");
    b.el.click();
    await flush();
    expect(h.calls.menu[0].items).toEqual([{ id: "0", label: "Rename" }, { separator: true }, { id: "2", label: "Delete", danger: true }]);
    const r = b.el.getBoundingClientRect();
    expect(h.calls.menu[0].at).toEqual({ x: r.left, y: r.bottom });
    expect(run).toHaveBeenCalledOnce();
  });

  it("menuButton is a text button marked as opening a menu", async () => {
    const h = fakeHost();
    setBridge(h.api);
    const b = menuButton(host(), { text: "Add field", items: items(() => {}), variant: "primary" });
    expect(b.el.textContent).toBe("Add field");
    expect(b.el.classList.contains("is-menu")).toBe(true);
    expect(b.el.getAttribute("aria-haspopup")).toBe("menu");
    b.el.click();
    await flush();
    expect(h.calls.menu).toHaveLength(1);
  });
});

describe("paneHeader", () => {
  it("prepends a nav-header toolbar of icon buttons; densityAction flips the mode", () => {
    const pane = host();
    pane.append(document.createElement("ul"));
    const onChange = vi.fn();
    const header = paneHeader(pane, [{ icon: "plus", label: "New", id: "new", onClick: () => {} }, densityAction("compact", onChange)]);
    expect(pane.firstElementChild).toBe(header);
    expect(header.className).toBe("hel-pane-header nav-header");
    const btns = header.querySelectorAll<HTMLButtonElement>(".nav-buttons-container[role=toolbar] > .nav-action-button");
    expect([...btns].map((b) => b.dataset.action)).toEqual(["new", "density"]);
    expect(btns[1].getAttribute("aria-label")).toBe("Show details per item");
    expect(btns[1].querySelector("svg")).not.toBeNull(); // rows-2 is a kit icon
    btns[1].click();
    expect(onChange).toHaveBeenCalledWith("detailed");
    expect(densityAction("detailed", onChange).icon).toBe("align-justify");
  });
});
