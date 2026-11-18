import { afterEach, describe, expect, it, vi } from "vitest";
import { callout, card, composer, field, keyValue } from "../src";

const host = () => document.body.appendChild(document.createElement("div"));
const key = (el: Element, k: string, mods: KeyboardEventInit = {}) =>
  el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...mods }));
const tick = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  document.body.innerHTML = "";
});

describe("callout", () => {
  it("solid adds is-solid (a filled banner); without it there is none", () => {
    const solid = callout(host(), { tone: "accent", text: "Waiting", solid: true, action: { text: "Answer now", variant: "primary", onClick: () => {} } });
    expect(solid.el.classList.contains("is-solid")).toBe(true);
    expect(solid.el.classList.contains("is-accent")).toBe(true);
    solid.setTone("danger");
    expect(solid.el.classList.contains("is-solid")).toBe(true);
    expect(callout(host(), { text: "Plain" }).el.classList.contains("is-solid")).toBe(false);
  });
  it("draws a toned banner with its text, Obsidian's callout class, and an action button", () => {
    const onClick = vi.fn();
    const c = callout(host(), { tone: "accent", text: "2 questions are waiting.", action: { text: "Answer now", onClick } });
    expect(c.el.classList.contains("hel-callout")).toBe(true);
    expect(c.el.classList.contains("is-accent")).toBe(true);
    expect(c.el.classList.contains("callout")).toBe(true);
    expect(c.el.querySelector(".hel-callout-text")!.textContent).toBe("2 questions are waiting.");
    const action = c.el.querySelector<HTMLButtonElement>("button.hel-callout-action")!;
    expect(action.classList.contains("hel-button")).toBe(true);
    expect(action.textContent).toBe("Answer now");
    action.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("defaults to info, and setText, setTone, hide and show update it in place", () => {
    const c = callout(host(), { text: "a" });
    expect(c.el.classList.contains("is-info")).toBe(true);
    expect(c.el.dataset.callout).toBe("info");
    expect(c.el.hasAttribute("aria-live")).toBe(false);
    c.setText("b");
    expect(c.el.querySelector(".hel-callout-text")!.textContent).toBe("b");
    c.setTone("danger");
    expect(c.el.classList.contains("is-info")).toBe(false);
    expect(c.el.classList.contains("is-danger")).toBe(true);
    expect(c.el.dataset.callout).toBe("danger");
    c.hide();
    expect(c.el.hidden).toBe(true);
    c.show();
    expect(c.el.hidden).toBe(false);
  });

  it("live sets aria-live polite; a fragment is drawn as given", () => {
    const frag = document.createDocumentFragment();
    const b = frag.appendChild(document.createElement("b"));
    b.textContent = "Bold";
    const c = callout(host(), { tone: "warning", text: frag, live: true });
    expect(c.el.getAttribute("aria-live")).toBe("polite");
    expect(c.el.querySelector(".hel-callout-text b")!.textContent).toBe("Bold");
  });
});

describe("card", () => {
  it("has a head with the icon and title, and a body to draw into", () => {
    const c = card(host(), { title: "Claude Code", icon: "terminal" });
    expect(c.el.classList.contains("hel-card")).toBe(true);
    expect(c.head.classList.contains("hel-card-head")).toBe(true);
    expect(c.head.querySelector(".hel-card-title")!.textContent).toBe("Claude Code");
    expect(c.head.querySelector<HTMLElement>(".hel-card-icon")!.dataset.icon).toBe("terminal");
    expect(c.body.classList.contains("hel-card-body")).toBe(true);
    expect(c.body.parentElement).toBe(c.el);
  });

  it("without a title or icon the head is empty; tone and compact are classes; setTone swaps the tone", () => {
    const c = card(host(), { tone: "warning", compact: true });
    expect(c.head.childElementCount).toBe(0);
    expect(c.el.classList.contains("is-warning")).toBe(true);
    expect(c.el.classList.contains("is-compact")).toBe(true);
    c.setTone("muted");
    expect(c.el.classList.contains("is-warning")).toBe(false);
    expect(c.el.classList.contains("is-muted")).toBe(true);
    c.setTone("default");
    expect(c.el.classList.contains("is-muted")).toBe(false);
    expect(card(host(), {}).el.className).toBe("hel-card");
  });
});

describe("keyValue", () => {
  it("draws a definition list: text, a list (with new items marked), a node, and an empty value", () => {
    const node = document.createElement("a");
    node.textContent = "link";
    const el = keyValue(host(), [
      { key: "Name", value: "Letterboxd" },
      { key: "Connect to", value: ["a.com", "b.com"], isNew: (x) => x === "b.com" },
      { key: "Source", value: node },
      { key: "Secrets", value: [], empty: "None" },
      { key: "Note", value: "" },
    ]);
    expect(el.tagName).toBe("DL");
    expect(el.classList.contains("hel-kv")).toBe(true);
    const rows = [...el.querySelectorAll(".hel-kv-row")];
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.querySelector("dt.hel-kv-key")!.textContent)).toEqual(["Name", "Connect to", "Source", "Secrets", "Note"]);
    expect(rows[0].querySelector("dd.hel-kv-value")!.textContent).toBe("Letterboxd");
    const items = [...rows[1].querySelectorAll("li")];
    expect(items.map((li) => li.classList.contains("is-new"))).toEqual([false, true]);
    expect(items[1].textContent).toContain("b.com");
    expect(items[1].textContent).toContain("new");
    expect(rows[2].querySelector("dd a")).toBe(node);
    const empty = rows[3].querySelector("dd")!;
    expect(empty.classList.contains("is-empty")).toBe(true);
    expect(empty.textContent).toBe("None");
    expect(rows[4].querySelector("dd")!.classList.contains("is-empty")).toBe(true);
  });
});

describe("composer", () => {
  it("Enter submits the text and clears it; Shift+Enter and an empty box do not submit", async () => {
    const onSubmit = vi.fn();
    const c = composer(host(), { placeholder: "Ask anything", onSubmit });
    expect(c.el.classList.contains("hel-composer")).toBe(true);
    expect(c.input.classList.contains("hel-composer-input")).toBe(true);
    expect(c.input.getAttribute("aria-label")).toBe("Ask anything");
    key(c.input, "Enter");
    expect(onSubmit).not.toHaveBeenCalled();
    c.input.value = "hello";
    key(c.input, "Enter", { shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
    key(c.input, "Enter");
    expect(onSubmit).toHaveBeenCalledWith("hello");
    await tick();
    expect(c.input.value).toBe("");
  });

  it("mod-enter submits only on Cmd/Ctrl+Enter; the send button submits too", () => {
    const onSubmit = vi.fn();
    const c = composer(host(), { submitOn: "mod-enter", submitLabel: "Start", hint: "Cmd+Enter to start", onSubmit });
    c.input.value = "go";
    key(c.input, "Enter");
    expect(onSubmit).not.toHaveBeenCalled();
    key(c.input, "Enter", { metaKey: true });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    c.input.value = "again";
    key(c.input, "Enter", { ctrlKey: true });
    expect(onSubmit).toHaveBeenCalledTimes(2);
    const send = c.el.querySelector<HTMLButtonElement>("button.hel-composer-send")!;
    expect(send.textContent).toBe("Start");
    c.input.value = "click";
    send.click();
    expect(onSubmit).toHaveBeenLastCalledWith("click");
    const hint = c.el.querySelector(".hel-composer-hint")!;
    expect(hint.textContent).toBe("Cmd+Enter to start");
    expect(c.input.getAttribute("aria-describedby")).toBe(hint.id);
  });

  it("an async submit is busy until it settles; a failed one keeps the text", async () => {
    let finish!: () => void;
    let fail!: (e: Error) => void;
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const onSubmit = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((r) => (finish = r)))
      .mockImplementationOnce(() => new Promise<void>((_r, j) => (fail = j)));
    const c = composer(host(), { submitIcon: "arrow-up", onSubmit });
    const send = c.el.querySelector<HTMLButtonElement>("button.hel-composer-send")!;
    expect(send.getAttribute("aria-label")).toBe("Send");
    c.input.value = "one";
    key(c.input, "Enter");
    expect(c.el.classList.contains("is-busy")).toBe(true);
    expect(send.disabled).toBe(true);
    // Read-only while it runs, so nothing typed meanwhile is wiped when it clears.
    expect(c.input.readOnly).toBe(true);
    key(c.input, "Enter");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    finish();
    await tick();
    expect(c.el.classList.contains("is-busy")).toBe(false);
    expect(c.input.readOnly).toBe(false);
    expect(c.input.value).toBe("");
    c.input.value = "two";
    key(c.input, "Enter");
    fail(new Error("no"));
    await tick();
    expect(c.el.classList.contains("is-busy")).toBe(false);
    expect(c.input.value).toBe("two");
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("setBusy, clear, focus and rows; in a field the label names it", () => {
    const f = field(host(), { label: "Message" });
    const c = composer(f.control, { rows: 5, onSubmit: () => {} });
    expect(c.input.getAttribute("rows")).toBe("5");
    expect(c.input.getAttribute("aria-labelledby")).toBe(f.el.querySelector("label")!.id);
    c.setBusy(true);
    expect(c.el.classList.contains("is-busy")).toBe(true);
    c.setBusy(false);
    c.input.value = "x";
    c.clear();
    expect(c.input.value).toBe("");
    c.focus();
    expect(document.activeElement).toBe(c.input);
  });
});

describe("frame safety (content parts)", () => {
  it("draw into the parent's document", () => {
    const doc = document.implementation.createHTMLDocument("frame");
    const parent = doc.body.appendChild(doc.createElement("div"));
    callout(parent, { text: "x", action: { text: "Go" } });
    card(parent, { title: "t", icon: "x" });
    keyValue(parent, [{ key: "k", value: ["a"], isNew: () => true }, { key: "e", value: [] }]);
    composer(parent, { hint: "h", onSubmit: () => {} });
    for (const el of parent.querySelectorAll("*")) expect(el.ownerDocument).toBe(doc);
  });
});
