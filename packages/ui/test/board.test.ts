import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { board, type BoardOptions } from "../src";

const css = readFileSync(resolve(__dirname, "../../base-theme/css/06-design-system.css"), "utf8");
const styling = readFileSync(resolve(__dirname, "../../../docs/design-system/STYLING.md"), "utf8");
const rules = css.split("\n").filter((l) => /^\.hel-board/.test(l));
const rule = (start: string) => rules.find((l) => l.startsWith(start))!;

const host = () => document.body.appendChild(document.createElement("div"));
/** A drag event with what the part reads: the pointer's height and, on dragleave, where it went. */
const fire = (el: Element, type: string, props: Record<string, unknown> = {}): Event => {
  const e = new Event(type, { bubbles: true, cancelable: true });
  for (const [k, v] of Object.entries(props)) Object.defineProperty(e, k, { value: v });
  el.dispatchEvent(e);
  return e;
};
/** Places a card at `top`, 20 tall: the test DOM does no layout. */
const place = (el: HTMLElement, top: number) => { el.getBoundingClientRect = () => ({ top, height: 20 }) as DOMRect; };

/** A board with a `todo` lane holding a, b and c, and an empty `done` lane; `log` records what the board reports. */
function setup(extra: BoardOptions = {}) {
  const log: string[] = [];
  const b = board(host(), {
    onDragStart: (id) => log.push(`start ${id}`),
    onDragEnd: () => log.push("end"),
    onDrop: (id, lane, index) => log.push(`drop ${id} ${lane} ${index}`),
    ...extra,
  });
  const todo = b.lane({ id: "todo", label: "To do" });
  const done = b.lane({ id: "done", label: "Done" });
  const cards = ["a", "b", "c"].map((id, i) => {
    const c = todo.card({ id, title: id.toUpperCase() });
    place(c.el, i * 20);
    return c;
  });
  return { b, todo, done, cards, log };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("board", () => {
  it("is a named row of lanes, each a named group with a head slot over its card list", () => {
    const h = host();
    const b = board(h, { label: "Tickets" });
    expect(h.firstElementChild).toBe(b.el);
    expect([...b.el.classList]).toEqual(["hel-board"]);
    expect(b.el.getAttribute("role")).toBe("group");
    expect(b.el.getAttribute("aria-label")).toBe("Tickets");
    const lane = b.lane({ id: "todo", label: "To do" });
    expect(b.el.firstElementChild).toBe(lane.el);
    expect(lane.el.dataset.lane).toBe("todo");
    expect(lane.el.getAttribute("role")).toBe("group");
    expect(lane.el.getAttribute("aria-label")).toBe("To do");
    expect([...lane.el.children]).toEqual([lane.head, lane.list, lane.footer]);
    expect(lane.head.className).toBe("hel-board-lane-head");
    expect(lane.list.className).toBe("hel-board-list");
    expect(lane.footer.className).toBe("hel-board-lane-footer");
    expect(lane.footer.childNodes.length).toBe(0);
  });

  it("a drop on the footer goes last and on the head first, wherever a scrolled list has put its cards", () => {
    const { todo, cards, log } = setup();
    todo.footer.appendChild(document.createElement("button"));
    // Scrolled: the first card is above the view, and the others reach past the fold, under the footer.
    place(cards[1]!.el, 300);
    place(cards[2]!.el, 320);
    place(cards[0]!.el, -40);
    for (const [dragged, target, y, index] of [[0, todo.footer.firstElementChild!, 200, 2], [2, todo.head, 0, 0]] as const) {
      log.length = 0;
      fire(cards[dragged]!.el, "dragstart");
      fire(target, "drop", { clientY: y });
      expect(log.at(-1)).toBe(`drop ${cards[dragged]!.el.dataset.id} todo ${index}`);
    }
  });

  it("a lane title is drawn first in the head, as text or as a button when it can be clicked", () => {
    const b = board(host());
    const plain = b.lane({ id: "a", label: "A", title: "Backlog" });
    expect(plain.head.firstElementChild!.tagName).toBe("SPAN");
    expect(plain.head.firstElementChild!.className).toBe("hel-board-lane-title");
    expect(plain.head.textContent).toBe("Backlog");
    let clicked = 0;
    const named = b.lane({ id: "b", label: "B", title: "Doing", onTitleClick: () => { clicked++; } });
    const title = named.head.firstElementChild as HTMLButtonElement;
    expect(title.tagName).toBe("BUTTON");
    expect(title.type).toBe("button");
    expect(title.className).toBe("hel-board-lane-title");
    expect(title.textContent).toBe("Doing");
    title.click();
    expect(clicked).toBe(1);
    expect(b.lane({ id: "c", label: "C" }).head.childNodes.length).toBe(0);
  });

  it("a drop on a lane's footer or head lands in its list", () => {
    const { todo, cards, log } = setup();
    for (const [target, y, index] of [[todo.footer, 100, 2], [todo.head, -5, 0]] as const) {
      log.length = 0;
      fire(cards[0]!.el, "dragstart");
      expect(fire(target, "dragover").defaultPrevented).toBe(true);
      expect(todo.list.classList.contains("is-drop-target")).toBe(true);
      // Moving between the lane's own parts is not leaving it.
      fire(target, "dragleave", { relatedTarget: todo.list });
      expect(todo.list.classList.contains("is-drop-target")).toBe(true);
      fire(target, "drop", { clientY: y });
      expect(log).toEqual(["start a", "end", `drop a todo ${index}`]);
    }
  });

  it("a card is a compact ui.card in the lane's list, with an empty row and meta row in its body", () => {
    const { todo } = setup();
    const c = todo.card({ id: "d", title: "Fix it", tone: "warning" });
    expect(c.el.parentElement).toBe(todo.list);
    expect([...c.el.classList]).toEqual(["hel-card", "is-compact", "is-warning", "hel-board-card"]);
    expect(c.el.dataset.id).toBe("d");
    expect(c.titleEl!.textContent).toBe("Fix it");
    const row = c.content.parentElement!;
    expect([...c.body.children]).toEqual([row, c.meta]);
    expect(row.className).toBe("hel-board-card-row");
    expect([...row.children]).toEqual([c.content, c.actions]);
    expect(c.content.className).toBe("hel-board-card-content markdown-rendered");
    expect(c.actions.className).toBe("hel-board-card-actions");
    expect(c.meta.className).toBe("hel-board-card-meta");
    for (const el of [c.content, c.actions, c.meta]) expect(el.childNodes.length).toBe(0);
  });

  it("check draws a done checkbox first in the card's row, named by its label, that reports what it was set to", () => {
    const { todo } = setup();
    const seen: boolean[] = [];
    let opened = 0;
    const c = todo.card({ id: "d", onOpen: () => { opened++; }, check: { checked: true, label: "Mark card as not done", onToggle: (v) => seen.push(v) } });
    const row = c.content.parentElement!;
    const check = row.firstElementChild as HTMLLabelElement;
    expect(check.tagName).toBe("LABEL");
    expect(check.className).toBe("hel-check hel-board-card-check");
    expect([...row.children]).toEqual([check, c.content, c.actions]);
    const box = check.firstElementChild as HTMLInputElement;
    expect(box.type).toBe("checkbox");
    expect(box.checked).toBe(true);
    expect(box.getAttribute("aria-label")).toBe("Mark card as not done");
    box.click();
    box.click();
    expect(seen).toEqual([false, true]);
    check.click();
    expect(opened).toBe(0);
  });

  it("a card without check has no checkbox, and an unchecked one starts unchecked", () => {
    const { todo } = setup();
    expect(todo.card({ id: "d" }).el.querySelector("input")).toBeNull();
    expect(todo.card({ id: "e", check: { checked: false, label: "Done", onToggle: () => {} } }).el.querySelector("input")!.checked).toBe(false);
  });

  it("onOpen puts an open button first in the card, beside its controls, named by the label", () => {
    const { todo } = setup();
    const c = todo.card({ id: "d", title: "Fix it", label: "Q-1 Fix it", onOpen: () => {}, check: { checked: false, label: "Done", onToggle: () => {} } });
    // A button's children are presentational to assistive tech, so the card must not be one around its controls.
    for (const a of ["role", "tabindex", "aria-label"]) expect(c.el.hasAttribute(a), a).toBe(false);
    expect(c.el.classList.contains("is-clickable")).toBe(true);
    const open = c.el.firstElementChild as HTMLButtonElement;
    expect(open.tagName).toBe("BUTTON");
    expect(open.type).toBe("button");
    expect(open.className).toBe("hel-board-card-open");
    expect(open.getAttribute("aria-label")).toBe("Q-1 Fix it");
    expect(open.childNodes.length).toBe(0);
    expect(c.el.querySelector("input")!.closest("button, [role=button]")).toBeNull();
  });

  it("a click on the card or its open button opens it once, and a click on a control inside it does not", () => {
    const { todo } = setup();
    let opened = 0;
    const c = todo.card({ id: "d", title: "Fix it", onOpen: () => { opened++; } });
    c.titleEl!.click();
    expect(opened).toBe(1);
    // What Enter and Space on a button do.
    (c.el.firstElementChild as HTMLButtonElement).click();
    expect(opened).toBe(2);
    const button = c.footer.appendChild(document.createElement("button"));
    const link = c.meta.appendChild(document.createElement("a"));
    const inner = link.appendChild(document.createElement("span"));
    button.click();
    inner.click();
    // The keys belong to the focused button; the card has no handler of its own to open it a second time.
    expect(fire(c.el, "keydown", { key: "Enter" }).defaultPrevented).toBe(false);
    expect(opened).toBe(2);
  });

  it("the open button's name defaults to the title, then to the content; a card without onOpen has none", () => {
    const { todo } = setup();
    const open = (el: HTMLElement) => el.querySelector<HTMLButtonElement>(":scope > .hel-board-card-open");
    expect(open(todo.card({ id: "d", title: "Fix it", onOpen: () => {} }).el)!.getAttribute("aria-label")).toBe("Fix it");
    const [one, two] = ["e", "f"].map((id) => todo.card({ id, onOpen: () => {} }));
    for (const c of [one!, two!]) {
      expect(c.content.id).not.toBe("");
      expect(open(c.el)!.getAttribute("aria-labelledby")).toBe(c.content.id);
      expect(open(c.el)!.hasAttribute("aria-label")).toBe(false);
    }
    expect(one!.content.id).not.toBe(two!.content.id);
    const plain = todo.card({ id: "g", title: "Read me" });
    expect(open(plain.el)).toBeNull();
    expect(plain.content.id).toBe("");
    expect(plain.el.classList.contains("is-clickable")).toBe(false);
  });

  it("cards drag when the board takes drops, unless a card says otherwise", () => {
    const { todo, cards } = setup();
    expect(cards[0]!.el.getAttribute("draggable")).toBe("true");
    expect(todo.card({ id: "d", draggable: false }).el.hasAttribute("draggable")).toBe(false);
    const fixed = board(host()).lane({ id: "x", label: "X" });
    expect(fixed.card({ id: "e" }).el.hasAttribute("draggable")).toBe(false);
  });

  it("dims the dragged card and reports the start and the end", () => {
    const { cards, log } = setup();
    const data: string[] = [];
    fire(cards[1]!.el, "dragstart", { dataTransfer: { setData: (type: string, v: string) => data.push(`${type} ${v}`) } });
    expect(cards[1]!.el.classList.contains("is-dragging")).toBe(true);
    expect(data).toEqual(["text/plain b"]);
    fire(cards[1]!.el, "dragend");
    expect(cards[1]!.el.classList.contains("is-dragging")).toBe(false);
    expect(log).toEqual(["start b", "end"]);
  });

  it("outlines the lane under a dragged card, and only until the pointer leaves it", () => {
    const { todo, done, cards } = setup();
    fire(cards[0]!.el, "dragstart");
    expect(fire(done.list, "dragover").defaultPrevented).toBe(true);
    expect(done.list.classList.contains("is-drop-target")).toBe(true);
    // Moving onto something inside the list is not leaving it.
    fire(todo.list, "dragover");
    fire(cards[1]!.el, "dragleave", { relatedTarget: cards[2]!.el });
    expect(todo.list.classList.contains("is-drop-target")).toBe(true);
    fire(done.list, "dragleave", { relatedTarget: todo.list });
    expect(done.list.classList.contains("is-drop-target")).toBe(false);
    fire(cards[0]!.el, "dragend");
    expect(todo.list.classList.contains("is-drop-target")).toBe(false);
  });

  it("ignores a drag that is not one of its cards", () => {
    const first = setup();
    const second = setup();
    expect(fire(first.todo.list, "dragover").defaultPrevented).toBe(false);
    fire(second.cards[0]!.el, "dragstart");
    expect(fire(first.todo.list, "dragover").defaultPrevented).toBe(false);
    expect(first.todo.list.classList.contains("is-drop-target")).toBe(false);
    expect(fire(first.todo.list, "drop").defaultPrevented).toBe(false);
    expect(first.log).toEqual([]);
  });

  it("a drop reports the lane and the place before the first card whose middle is below the pointer, not counting the dragged one", () => {
    for (const [dragged, y, index] of [["a", 0, 0], ["a", 31, 1], ["a", 100, 2], ["c", 15, 1], ["c", 100, 2], ["b", 11, 1]] as const) {
      document.body.innerHTML = "";
      const { todo, cards, log } = setup();
      const card = cards.find((c) => c.el.dataset.id === dragged)!;
      fire(card.el, "dragstart");
      fire(todo.list, "dragover");
      expect(fire(todo.list, "drop", { clientY: y }).defaultPrevented).toBe(true);
      expect(todo.list.classList.contains("is-drop-target")).toBe(false);
      expect(log, `${dragged} at ${y}`).toEqual([`start ${dragged}`, "end", `drop ${dragged} todo ${index}`]);
    }
  });

  it("a drop ends the drag once, before it is reported, even when dragend follows", () => {
    const { done, cards, log } = setup();
    fire(cards[0]!.el, "dragstart");
    fire(done.list, "drop", { clientY: 5 });
    fire(cards[0]!.el, "dragend");
    expect(log).toEqual(["start a", "end", "drop a done 0"]);
    expect(cards[0]!.el.classList.contains("is-dragging")).toBe(false);
  });
});

describe("Finesse board styling", () => {
  it("a fixed-height row of lanes that scrolls sideways, each list scrolling on its own", () => {
    expect(rule(".hel-board {")).toContain("overflow-x: auto");
    expect(rule(".hel-board {")).toContain("min-height: 0");
    expect(rule(".hel-board-lane {")).toContain("flex: 0 0 var(--hel-board-lane-width, 280px)");
    expect(rule(".hel-board-list {")).toContain("overflow-y: auto");
    expect(rule(".hel-board-list > * {")).toContain("flex: none");
    expect(rule(".hel-board-page {")).toContain("flex-direction: column");
    expect(rule(".hel-board-page > :not(.hel-board) {")).toContain("flex: none");
  });

  it("takes its content's height in a container with none of its own, and the space left on a board page", () => {
    expect(rule(".hel-board {")).toContain("flex: 1 1 auto");
    expect(rule(".hel-board-page > .hel-board {")).toContain("flex: 1 1 0");
  });

  it("the page still does not scroll as a pane's view-content, whose workspace rule is more specific than one class", () => {
    expect(css).toContain(".view-content.hel-board-page { overflow: hidden; }");
  });

  it("outlines the drop target and gives cards a grab cursor, hover and focus rings and a dimmed drag", () => {
    expect(rule(".hel-board-list.is-drop-target {")).toContain("outline: 2px dashed var(--interactive-accent)");
    expect(rule('.hel-board-card[draggable="true"] {')).toContain("cursor: grab");
    expect(rule(".hel-board-card:is(.is-clickable,")).toContain("var(--hel-ring-hover)");
    expect(rule(".hel-board-card:has(> .hel-board-card-open:focus-visible) {")).toContain("var(--hel-ring-focus)");
    expect(rule(".hel-board-card.is-dragging {")).toContain("opacity: 0.5");
    expect(rule(".hel-board-card-meta {")).toContain("flex-wrap: wrap");
  });

  it("the card rules come after the card's tones, so the focus ring shows on a toned card", () => {
    expect(css.indexOf(".hel-board-card:has(> .hel-board-card-open:focus-visible) {")).toBeGreaterThan(css.indexOf(".hel-card.is-muted {"));
  });

  it("the open button lies unseen over the card and takes no pointer, so clicks, drags and links work as before", () => {
    // Beats base.css's button:not(.clickable-icon) and its hover and focus looks.
    const open = css.split("\n").find((l) => l.startsWith(".hel-board-card > button.hel-board-card-open:not(.clickable-icon),"))!;
    // Space presses it, so a theme's pressed or focused button must not tint the whole card either.
    expect(open).toContain("button.hel-board-card-open:not(.clickable-icon):is(:hover, :focus, :focus-visible, :active) {");
    for (const d of ["position: absolute", "inset: 0", "pointer-events: none", "background: none", "box-shadow: none", "outline: none"]) expect(open).toContain(d);
  });

  it("the card row lines the checkbox and the actions up with the first line, with the actions at the far end", () => {
    expect(rule(".hel-board-card-row {")).toContain("align-items: flex-start");
    for (const side of [".hel-board-card-row > .hel-board-card-check {", ".hel-board-card-actions {"]) {
      for (const d of ["height: 1lh", "flex: none", "align-items: center"]) expect(rule(side), side).toContain(d);
    }
    for (const d of ["flex: 1 1 0", "min-width: 0"]) expect(rule(".hel-board-card-content {")).toContain(d);
    expect(css).toContain(".hel-board-card-actions:empty { display: none; }");
    expect(css).toContain(".hel-board-card-row:has(> .hel-board-card-content:first-child:empty + .hel-board-card-actions:empty) { display: none; }");
  });

  it("trims the margins at the edges of a card's markdown, however many blocks it has", () => {
    expect(rule(".hel-board-card-content > :first-child,")).toContain(".hel-board-card-content > :first-child > :first-child { margin-block-start: 0; }");
    expect(rule(".hel-board-card-content > :last-child,")).toContain(".hel-board-card-content > :last-child > :last-child { margin-block-end: 0; }");
  });

  it("a lane title wraps, beside a count and menu that keep their size, and a title button looks like text", () => {
    const title = rule(".hel-board-lane-head > .hel-board-lane-title {");
    for (const d of ["flex: 0 1 auto", "min-width: 0", "overflow-wrap: anywhere", "text-align: start"]) expect(title).toContain(d);
    expect(css).toContain(".hel-board-lane-head:has(> .hel-board-lane-title) { flex-wrap: nowrap; align-items: baseline; }");
    expect(css).toContain(".hel-board-lane-head:has(> .hel-board-lane-title) > :not(.hel-board-lane-title) { flex: none; }");
    // Beats base.css's button:not(.clickable-icon) (one line, a fixed height, a filled button) and its :hover.
    const button = css.split("\n").find((l) => l.startsWith(".hel-board-lane-head > button.hel-board-lane-title:not(.clickable-icon) {"))!;
    for (const d of ["height: auto", "white-space: normal", "background: none", "box-shadow: none"]) expect(button).toContain(d);
    expect(css).toContain(".hel-board-lane-head > button.hel-board-lane-title:not(.clickable-icon):hover {");
    expect(css).toContain(".hel-board-lane-head > button.hel-board-lane-title:not(.clickable-icon):focus-visible { outline: none; box-shadow: var(--hel-ring-focus); }");
  });

  it("a lane footer follows the cards and stays in view under a long list", () => {
    expect(rule(".hel-board-lane-footer {")).toContain("flex: none");
    expect(css).toContain(".hel-board-lane-footer:empty { display: none; }");
    // The list stops at its cards (and still shrinks and scrolls), so the footer sits right under them.
    expect(css).toContain(".hel-board-lane:has(> .hel-board-lane-footer:not(:empty)) > .hel-board-list { flex-grow: 0; }");
  });

  it("uses tokens only, so light and dark follow the theme", () => {
    expect(rules.length).toBeGreaterThan(10);
    expect(rules.join("\n")).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });

  it("STYLING.md has a row for each class and variable", () => {
    for (const name of ["`hel-board`", "`hel-board-page`", "`hel-board-lane`", "`hel-board-lane-head`", "`hel-board-list`", "`hel-board-card`", "`hel-board-card-open`", "`hel-board-card-meta`", "`hel-board-card-row`", "`hel-board-card-check`", "`hel-board-card-content`", "`hel-board-card-actions`", "`hel-board-lane-title`", "`hel-board-lane-footer`", "`--hel-board-lane-width`", "`--hel-board-gap`"]) expect(styling).toContain(`| ${name} |`);
  });
});
