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
  it("setAction adds, replaces and removes the action button", () => {
    const c = callout(host(), { tone: "danger", text: "Git is missing." });
    expect(c.el.querySelector(".hel-callout-action")).toBeNull();
    const onClick = vi.fn();
    c.setAction({ text: "Install Git", variant: "link", onClick });
    c.setAction({ text: "Install Git ↗", variant: "link", onClick });
    const actions = c.el.querySelectorAll<HTMLButtonElement>(".hel-callout-action");
    expect(actions.length).toBe(1);
    expect(actions[0].textContent).toBe("Install Git ↗");
    actions[0].click();
    expect(onClick).toHaveBeenCalledTimes(1);
    c.setAction(null);
    expect(c.el.querySelector(".hel-callout-action")).toBeNull();
  });

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
    expect(c.titleEl).toBe(c.head.querySelector(".hel-card-title"));
    expect(card(host(), {}).titleEl).toBeNull();
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

  it("attention and sticky are classes; setBusy dims it with aria-busy; pulse adds is-pulse for a while", () => {
    vi.useFakeTimers();
    try {
      const c = card(host(), { title: "Claude is asking you", tone: "accent", attention: true, sticky: true });
      expect(["is-attention", "is-sticky", "is-accent"].every((x) => c.el.classList.contains(x))).toBe(true);
      expect(card(host(), { tone: "warning" }).el.classList.contains("is-attention")).toBe(false);
      c.setBusy(true);
      expect(c.el.classList.contains("is-busy")).toBe(true);
      expect(c.el.getAttribute("aria-busy")).toBe("true");
      c.setBusy(false);
      expect(c.el.classList.contains("is-busy")).toBe(false);
      expect(c.el.hasAttribute("aria-busy")).toBe(false);
      c.pulse();
      expect(c.el.classList.contains("is-pulse")).toBe(true);
      vi.advanceTimersByTime(2399);
      expect(c.el.classList.contains("is-pulse")).toBe(true);
      vi.advanceTimersByTime(1);
      expect(c.el.classList.contains("is-pulse")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
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
  const typeIn = (input: HTMLTextAreaElement, v: string) => {
    input.value = v;
    input.setSelectionRange(v.length, v.length);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const items = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>(".hel-composer-menu-item")];

  it("slashCommands: '/' lists commands, typing filters, Enter inserts without sending, Escape closes", async () => {
    const onSubmit = vi.fn();
    const load = vi.fn(async () => [
      { name: "helenite-cc:helenite-plugin-creator", description: "Build a plugin" },
      { name: "helenite-cc:helenite-notes", description: "Notes" },
      { name: "review", description: "Review a plugin" },
    ]);
    const c = composer(host(), { onSubmit, slashCommands: load });
    const menu = c.el.querySelector<HTMLElement>(".hel-composer-menu")!;
    c.input.focus();
    typeIn(c.input, "/");
    await tick();
    expect(load).toHaveBeenCalledTimes(1);
    expect(menu.hidden).toBe(false);
    expect(c.input.getAttribute("aria-expanded")).toBe("true");
    expect(items(c.el).map((i) => i.querySelector(".hel-composer-menu-name")!.textContent)).toEqual(["/helenite-cc:helenite-plugin-creator", "/helenite-cc:helenite-notes", "/review"]);

    typeIn(c.input, "/helenite-p");
    expect(items(c.el)).toHaveLength(1);
    expect(c.input.getAttribute("aria-activedescendant")).toBe(items(c.el)[0].id);
    key(c.input, "Enter");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(c.input.value).toBe("/helenite-cc:helenite-plugin-creator ");
    expect(menu.hidden).toBe(true);

    // Past the first word the menu stays shut, and Enter sends.
    typeIn(c.input, "/helenite-cc:helenite-plugin-creator make a query plugin");
    expect(menu.hidden).toBe(true);
    key(c.input, "Enter");
    expect(onSubmit).toHaveBeenCalledWith("/helenite-cc:helenite-plugin-creator make a query plugin");

    // Name matches rank above description matches.
    typeIn(c.input, "/notes");
    expect(items(c.el).map((i) => i.querySelector(".hel-composer-menu-name")!.textContent)).toEqual(["/helenite-cc:helenite-notes"]);
    typeIn(c.input, "/plugin");
    expect(items(c.el)[0].querySelector(".hel-composer-menu-name")!.textContent).toBe("/helenite-cc:helenite-plugin-creator");
    typeIn(c.input, "/no");
    expect(items(c.el).map((i) => i.textContent)).toEqual(["/helenite-cc:helenite-notesNotes"]);
    typeIn(c.input, "/");
    key(c.input, "ArrowDown");
    key(c.input, "ArrowDown");
    expect(items(c.el)[2].classList.contains("is-selected")).toBe(true);
    key(c.input, "ArrowDown");
    expect(items(c.el)[0].classList.contains("is-selected")).toBe(true);
    const esc = vi.fn();
    c.input.addEventListener("keydown", (e) => e.key === "Escape" && esc());
    key(c.input, "Escape");
    expect(menu.hidden).toBe(true);
    expect(esc).not.toHaveBeenCalled();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("without slashCommands there is no menu", () => {
    const c = composer(host(), { onSubmit: () => {} });
    typeIn(c.input, "/");
    expect(c.el.querySelector(".hel-composer-menu")).toBeNull();
  });

  it("false from onSubmit keeps the text; allowEmpty sends an empty box; an IME's Enter does not send", async () => {
    const kept = composer(host(), { onSubmit: () => false });
    kept.input.value = "hello";
    key(kept.input, "Enter");
    expect(kept.input.value).toBe("hello");
    const later = composer(host(), { onSubmit: async () => false });
    later.input.value = "hi";
    key(later.input, "Enter");
    await tick();
    expect(later.input.value).toBe("hi");
    const start = vi.fn();
    const empty = composer(host(), { allowEmpty: true, onSubmit: start });
    key(empty.input, "Enter");
    expect(start).toHaveBeenCalledWith("");
    expect(composer(host(), { onSubmit: start }).input.value).toBe("");
    const ime = vi.fn();
    const c = composer(host(), { onSubmit: ime });
    c.input.value = "にほん";
    c.input.dispatchEvent(new Event("compositionstart"));
    key(c.input, "Enter");
    expect(ime).not.toHaveBeenCalled();
    c.input.dispatchEvent(new Event("compositionend"));
    key(c.input, "Enter");
    expect(ime).toHaveBeenCalledWith("にほん");
  });

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

describe("keyValue newTone", () => {
  it("marks new items with the accent badge by default, the warning badge and is-warning with newTone warning", () => {
    const el = keyValue(host(), [
      { key: "a", value: ["x"], isNew: () => true },
      { key: "b", value: ["y"], isNew: () => true, newTone: "warning" },
    ]);
    const [a, b] = [...el.querySelectorAll("li.is-new")];
    expect(a.classList.contains("is-warning")).toBe(false);
    expect(a.querySelector(".hel-badge")!.classList.contains("is-accent")).toBe(true);
    expect(b.classList.contains("is-warning")).toBe(true);
    expect(b.querySelector(".hel-badge")!.classList.contains("is-warning")).toBe(true);
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
