import { describe, expect, it } from "vitest";
import { choose, confirm, getBridge, menu, modal, notice, openUrl, prompt, promptSecret, setBridge } from "../src";
import { fakeHost } from "./setup";

describe("host bridge", () => {
  it("throws a helpful error before setBridge", () => {
    expect(() => getBridge()).toThrow(/setBridge/);
  });
  it("modal, menu and notice go to the host as declarative specs", async () => {
    const { api, calls } = fakeHost({ menu: "open" });
    setBridge(api);
    await modal({ title: "T", body: [{ text: "x" }] });
    expect(await menu({ items: [{ id: "open", label: "Open" }, { separator: true }], at: { x: 1, y: 2 } })).toBe("open");
    notice("Saved", { kind: "success" });
    expect(calls.modal[0].title).toBe("T");
    expect(calls.menu[0].at).toEqual({ x: 1, y: 2 });
    expect(calls.notice).toEqual([["Saved", { kind: "success" }]]);
    expect(document.body.children).toHaveLength(0); // nothing drawn in the frame
  });
  it("confirm resolves true only for the ok action", async () => {
    setBridge(fakeHost({ modal: { action: "ok", values: {} } }).api);
    expect(await confirm("Remove?", "Sure?", { danger: true, confirmLabel: "Remove" })).toBe(true);
    const { api, calls } = fakeHost({ modal: { action: null, values: {} } });
    setBridge(api);
    expect(await confirm("Remove?", "Sure?")).toBe(false);
    expect(calls.modal[0].actions!.map((a) => a.id)).toEqual(["cancel", "ok"]);
  });
  it("prompt returns the typed value or null; choose returns the picked value", async () => {
    setBridge(fakeHost({ modal: { action: "ok", values: { v: "hello", choice: "r2" } } }).api);
    expect(await prompt("Name")).toBe("hello");
    expect(await choose("Release", [{ value: "r1", label: "A" }, { value: "r2", label: "B" }])).toBe("r2");
    setBridge(fakeHost().api);
    expect(await prompt("Name")).toBeNull();
    expect(await choose("Release", [])).toBeNull();
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
