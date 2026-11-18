import { afterEach, describe, expect, it, vi } from "vitest";
import { listGroup, listRow, setMenuRenderer } from "../src";
import type { MenuItemSpec } from "../src";

const host = () => document.body.appendChild(document.createElement("div"));
const key = (el: Element, k: string) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));

afterEach(() => {
  setMenuRenderer(null);
  document.body.innerHTML = "";
});

describe("listRow", () => {
  it("draws the title, icon, dot, meta and tag, with is-active", () => {
    const row = listRow(host(), {
      title: "Fix the build",
      icon: "file-text",
      meta: "2m",
      tag: "new",
      active: true,
      dot: { tone: "warning", label: "Waiting for you", pulse: true },
    });
    expect(row.classList.contains("hel-list-row")).toBe(true);
    expect(row.classList.contains("is-active")).toBe(true);
    expect(row.querySelector(".hel-list-row-title")!.textContent).toBe("Fix the build");
    expect(row.querySelector<HTMLElement>(".hel-list-row-icon")!.dataset.icon).toBe("file-text");
    expect(row.querySelector(".hel-status-dot.is-warning.is-pulse")!.getAttribute("aria-label")).toBe("Waiting for you");
    expect(row.querySelector(".hel-list-row-meta")!.textContent).toBe("2m");
    expect(row.querySelector(".hel-list-row-tag")!.textContent).toBe("new");
    // Without obsidianClass it carries no Obsidian tree classes.
    expect(row.className).not.toMatch(/nav-file|tree-item/);
  });

  it("obsidianClass emits the file tree's classes", () => {
    const tree = listRow(host(), { title: "A", tag: "x", obsidianClass: "tree-item" });
    expect([...tree.classList]).toEqual(expect.arrayContaining(["tree-item-self", "is-clickable", "nav-file-title"]));
    expect(tree.querySelector(".hel-list-row-title")!.classList.contains("tree-item-inner")).toBe(true);
    expect(tree.querySelector(".hel-list-row-title")!.classList.contains("nav-file-title-content")).toBe(true);
    expect(tree.querySelector(".hel-list-row-tag")!.classList.contains("nav-file-tag")).toBe(true);
    expect(tree.parentElement!.classList.contains("nav-file")).toBe(false);
    const navHost = host();
    const nav = listRow(navHost, { title: "B", obsidianClass: "nav-file-title" });
    expect(nav.classList.contains("nav-file-title")).toBe(true);
    // A nav-file-title row sits in Obsidian's nav-file wrapper; a plain row goes straight into its parent.
    expect(nav.parentElement!.classList.contains("nav-file")).toBe(true);
    expect(nav.parentElement!.parentElement).toBe(navHost);
    const plainHost = host();
    expect(listRow(plainHost, { title: "C" }).parentElement).toBe(plainHost);
    expect(nav.classList.contains("tree-item-self")).toBe(false);
    expect(nav.querySelector(".nav-file-title-content")).not.toBeNull();
  });

  it("a badge sits after the title and before the meta; an action's id is its data-action", () => {
    const row = listRow(host(), {
      title: "Chat", meta: "2m", badge: { count: 2, tone: "danger", label: "waiting" },
      actions: [{ icon: "play", label: "Resume", id: "resume", onClick: () => {} }, { icon: "x", label: "Close", onClick: () => {} }],
    });
    const kids = [...row.children].map((c) => c.className.split(" ")[0]);
    expect(kids).toEqual(["hel-list-row-title", "hel-count-badge", "hel-list-row-meta", "hel-list-row-actions"]);
    expect(row.querySelector(".hel-count-badge")!.classList.contains("is-danger")).toBe(true);
    expect(row.querySelector(".hel-count-badge")!.textContent).toBe("22 waiting");
    expect([...row.querySelectorAll<HTMLElement>(".hel-list-row-action")].map((b) => b.dataset.action ?? null)).toEqual(["resume", null]);
    expect(listRow(host(), { title: "None", badge: { count: 0 } }).querySelector<HTMLElement>(".hel-count-badge")!.hidden).toBe(true);
  });

  it("a click or Enter runs onClick; an action runs its own handler and not the row's", () => {
    const onClick = vi.fn();
    const resume = vi.fn();
    const row = listRow(host(), { title: "A", onClick, actions: [{ icon: "play", label: "Resume", onClick: resume }] });
    expect(row.tabIndex).toBe(0);
    expect(row.getAttribute("role")).toBe("button");
    expect(listRow(host(), { title: "T", onClick, obsidianClass: "tree-item" }).getAttribute("role")).toBe("treeitem");
    row.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    key(row, "Enter");
    expect(onClick).toHaveBeenCalledTimes(2);
    const action = row.querySelector<HTMLButtonElement>(".hel-list-row-actions button[aria-label=Resume]")!;
    action.click();
    expect(resume).toHaveBeenCalledTimes(1);
    key(action, "Enter");
    expect(onClick).toHaveBeenCalledTimes(2);
    const plain = listRow(host(), { title: "B" });
    expect(plain.hasAttribute("tabindex")).toBe(false);
    expect(plain.hasAttribute("role")).toBe(false);
  });

  it("a right-click opens the menu through the installed renderer, built fresh each time", () => {
    const shown: { items: MenuItemSpec[]; at: unknown }[] = [];
    setMenuRenderer((items, at) => shown.push({ items, at }));
    let n = 0;
    const row = listRow(host(), { title: "A", menu: () => [{ title: `Item ${++n}`, onClick: () => {} }] });
    const e = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 5, clientY: 6 });
    row.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    row.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    expect(shown.map((s) => (s.items[0] as { title: string }).title)).toEqual(["Item 1", "Item 2"]);
    expect(shown[0].at).toBe(e);
  });
});

describe("listGroup", () => {
  it("a header with the title and count toggles the body; onToggle gets the new state", () => {
    const onToggle = vi.fn();
    const g = listGroup(host(), { title: "Today", count: 3, onToggle });
    expect(g.el.classList.contains("hel-list-group")).toBe(true);
    const header = g.el.querySelector<HTMLElement>(".hel-list-group-header")!;
    expect(header.querySelector(".hel-list-group-title")!.textContent).toBe("Today");
    expect(header.querySelector(".hel-list-group-count")!.textContent).toBe("3");
    expect(header.getAttribute("aria-expanded")).toBe("true");
    expect(g.body.classList.contains("hel-list-group-body")).toBe(true);
    expect(g.body.id).toBeTruthy();
    expect(header.getAttribute("aria-controls")).toBe(g.body.id);
    expect(g.body.hidden).toBe(false);
    header.click();
    expect(onToggle).toHaveBeenLastCalledWith(true);
    expect(g.el.classList.contains("is-collapsed")).toBe(true);
    expect(header.getAttribute("aria-expanded")).toBe("false");
    expect(g.body.hidden).toBe(true);
    key(header, "Enter");
    expect(onToggle).toHaveBeenLastCalledWith(false);
    expect(g.body.hidden).toBe(false);
  });

  it("starts collapsed when asked", () => {
    const g = listGroup(host(), { title: "Older", collapsed: true });
    expect(g.el.classList.contains("is-collapsed")).toBe(true);
    expect(g.el.querySelector(".hel-list-group-chevron")!.classList.contains("is-collapsed")).toBe(true);
    expect(g.body.hidden).toBe(true);
    expect(g.el.querySelector(".hel-list-group-count")).toBeNull();
  });
});

describe("frame safety (list parts)", () => {
  it("draw into the parent's document", () => {
    const doc = document.implementation.createHTMLDocument("frame");
    const parent = doc.body.appendChild(doc.createElement("div"));
    const g = listGroup(parent, { title: "G", count: 1 });
    listRow(g.body, { title: "A", icon: "x", meta: "m", tag: "t", dot: { tone: "accent", label: "l" }, actions: [{ icon: "play", label: "Play", onClick: () => {} }] });
    for (const el of parent.querySelectorAll("*")) expect(el.ownerDocument).toBe(doc);
  });
});
