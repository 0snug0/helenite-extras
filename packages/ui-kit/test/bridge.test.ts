import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as ui from "@helenite/ui";
import * as kit from "../src";
import { choose, confirm, form, getBridge, menu, modal, notice, openUrl, prompt, promptSecret, setBridge } from "../src";
import { fakeHost } from "./setup";

describe("re-exports from @helenite/ui", () => {
  it("button/segmented/table/states are the same functions", () => {
    for (const k of ["button", "segmented", "table", "emptyState", "errorState", "loadingState", "badge", "statusDot", "setIconRenderer", "renderIcon"] as const) {
      expect(kit[k], k).toBe(ui[k]);
    }
  });
  it("drops the parts @helenite/ui replaced", () => {
    for (const k of ["sortableTable", "toggle", "sortRows"]) expect(k in kit, k).toBe(false);
  });
});

describe("host bridge", () => {
  it("throws a helpful error before setBridge", () => {
    expect(() => getBridge()).toThrow(/setBridge/);
  });
  it("modal and notice go to the host as declarative specs", async () => {
    const { api, calls } = fakeHost();
    setBridge(api);
    await modal({ title: "T", body: [{ text: "x" }] });
    notice("Saved", { kind: "success" });
    expect(calls.modal[0].title).toBe("T");
    expect(calls.notice).toEqual([["Saved", { kind: "success" }]]);
    expect(document.body.children).toHaveLength(0); // nothing drawn in the frame
  });
  it('confirm({ title, message, action: "Delete", danger: true }) sends [cancel "Cancel", delete "Delete" danger] and resolves true only for the action id', async () => {
    const { api, calls } = fakeHost({ modal: { action: "action", values: {} } });
    setBridge(api);
    expect(await confirm({ title: "Remove?", message: "Sure?", action: "Delete", danger: true })).toBe(true);
    expect(calls.modal[0].title).toBe("Remove?");
    expect(calls.modal[0].body).toEqual([{ text: "Sure?" }]);
    expect(calls.modal[0].actions).toEqual([
      { id: "cancel", label: "Cancel" },
      { id: "action", label: "Delete", danger: true },
    ]);
    setBridge(fakeHost({ modal: { action: "cancel", values: {} } }).api);
    expect(await confirm({ title: "T", message: "M", action: "Go" })).toBe(false);
    const h = fakeHost();
    setBridge(h.api);
    expect(await confirm({ title: "T", message: "M", action: "Go", cancel: "Keep" })).toBe(false);
    expect(h.calls.modal[0].actions).toEqual([{ id: "cancel", label: "Keep" }, { id: "action", label: "Go", primary: true }]);
  });
  it("prompt returns the typed value or null", async () => {
    const h = fakeHost({ modal: { action: "action", values: { v: "hello" } } });
    setBridge(h.api);
    expect(await prompt({ title: "Name", label: "Name", value: "x", placeholder: "p", action: "Rename" })).toBe("hello");
    expect(h.calls.modal[0].fields).toEqual([{ id: "v", kind: "text", label: "Name", value: "x", placeholder: "p" }]);
    expect(h.calls.modal[0].actions!.map((a) => a.label)).toEqual(["Cancel", "Rename"]);
    setBridge(fakeHost().api);
    expect(await prompt({ title: "Name", action: "Save" })).toBeNull();
  });
  it("choose maps text to label and returns the picked value", async () => {
    const h = fakeHost({ modal: { action: "action", values: { choice: "r2" } } });
    setBridge(h.api);
    const options = [{ value: "r1" as const, text: "A", detail: "1 GB" }, { value: "r2" as const, text: "B", disabled: true }];
    expect(await choose({ title: "Release", options })).toBe("r2");
    expect(h.calls.modal[0].fields).toEqual([{ id: "choice", kind: "choice", options: [{ value: "r1", label: "A", detail: "1 GB", disabled: undefined }, { value: "r2", label: "B", detail: undefined, disabled: true }] }]);
    setBridge(fakeHost().api);
    expect(await choose({ title: "Release", options: [] })).toBeNull();
  });
  it("form returns the values on the action and null otherwise", async () => {
    const values = { name: "x", on: true };
    const h = fakeHost({ modal: { action: "action", values } });
    setBridge(h.api);
    const fields: ui.Field[] = [{ id: "name", kind: "text", label: "Name" }, { id: "on", kind: "checkbox", label: "On" }];
    expect(await form({ title: "Add", fields, action: "Add", danger: true })).toEqual(values);
    expect(h.calls.modal[0].fields).toBe(fields);
    expect(h.calls.modal[0].actions![1]).toEqual({ id: "action", label: "Add", danger: true });
    setBridge(fakeHost().api);
    expect(await form({ title: "Add", fields, action: "Add" })).toBeNull();
  });
  it("menu sends items with ids and runs the chosen onClick; separators pass through", async () => {
    const open = vi.fn(), del = vi.fn();
    const h = fakeHost({ menu: "1" });
    setBridge(h.api);
    await menu([{ title: "Open", icon: "file", onClick: open }, "separator", { title: "Delete", danger: true, disabled: false, onClick: del }], { x: 1, y: 2 });
    expect(h.calls.menu[0].at).toEqual({ x: 1, y: 2 });
    expect(h.calls.menu[0].items).toEqual([
      { id: "0", label: "Open", icon: "file", danger: undefined, disabled: undefined },
      { separator: true },
      { id: "2", label: "Delete", icon: undefined, danger: true, disabled: false },
    ]);
    expect(open).not.toHaveBeenCalled();
  });
  it("menu runs the onClick of the chosen item", async () => {
    const open = vi.fn(), del = vi.fn();
    setBridge(fakeHost({ menu: "2" }).api);
    await menu([{ title: "Open", onClick: open }, "separator", { title: "Delete", onClick: del }], { x: 0, y: 0 });
    expect(del).toHaveBeenCalledOnce();
    expect(open).not.toHaveBeenCalled();
    setBridge(fakeHost({ menu: null }).api);
    await menu([{ title: "Open", onClick: open }], { x: 0, y: 0 });
    expect(open).not.toHaveBeenCalled();
  });
  it('no ModalSpec the kit builds has an action labelled "OK"', async () => {
    const h = fakeHost({ modal: { action: "action", values: {} } });
    setBridge(h.api);
    await confirm({ title: "T", message: "M", action: "Delete", danger: true });
    await prompt({ title: "T", action: "Save" });
    await choose({ title: "T", options: [] });
    await form({ title: "T", fields: [], action: "Add" });
    expect(h.calls.modal).toHaveLength(4);
    for (const spec of h.calls.modal) for (const a of spec.actions!) expect(a.label.toLowerCase()).not.toBe("ok");
  });
  it("secret prompts and links go through the host, never the frame", async () => {
    const { api, calls } = fakeHost();
    setBridge(api);
    await promptSecret("RADARR_API_KEY");
    openUrl("https://example.com");
    expect(calls.secrets).toEqual(["RADARR_API_KEY"]);
    expect(calls.urls).toEqual(["https://example.com"]);
  });
});

describe("stylesheet", () => {
  const css = readFileSync(join(__dirname, "../src/ui-kit.css"), "utf8");
  it("contains no hk- selector", () => {
    expect(css).not.toMatch(/hk-/);
  });
  it("does not restyle parts @helenite/ui provides", () => {
    expect(css).not.toMatch(/\.hel-(button|table|badge|empty|error|loading|segmented|status-dot)\b/);
  });
});
