"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => KanbanPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian2 = require("obsidian");
var import_helenite2 = require("helenite");

// src/board.ts
var FRONTMATTER_KEY = "kanban-plugin";
var nextId = 0;
var newId = (prefix) => `${prefix}${++nextId}`;
var FRONTMATTER = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
var SETTINGS_FOOTER = /(?:\r?\n)*%% kanban:settings[ \t]*\r?\n```[^\n]*\r?\n([\s\S]*?)\r?\n```[ \t]*\r?\n%%\s*$/;
var HEADING = /^ {0,3}(#{1,6})[ \t]+(.*?)[ \t]*$/;
var THEMATIC_BREAK = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
var LIST_ITEM = /^ {0,3}(?:[-*+]|\d{1,9}[.)])(?:[ \t]+(.*))?$/;
var TASK = /^\[(.)\](?:[ \t]+([\s\S]*))?$/;
var BLOCK_ID = /\s+\^([a-zA-Z0-9-]+)$/;
var COMPLETE = "**Complete**";
var ARCHIVE_BREAK = "***";
var ARCHIVE_TITLE = "Archive";
function isBoardMarkdown(md) {
  const fm = FRONTMATTER.exec(md);
  return !!fm && boardKind(fm[1]) !== null;
}
function isBoardFrontmatter(fm) {
  const v = fm?.[FRONTMATTER_KEY];
  return v === "board" || v === "basic";
}
function boardKind(yaml) {
  const m = /^kanban-plugin:[ \t]*["']?([^"'\s#]+)["']?[ \t]*(?:#.*)?$/m.exec(yaml);
  return m ? m[1] : null;
}
function parseLaneTitle(raw) {
  const str = raw.replace(/<br>/g, "\n").trim();
  const m = /^(.*?)\s*\((\d+)\)$/.exec(str);
  return m ? { title: m[1], maxItems: Number(m[2]) } : { title: str, maxItems: 0 };
}
function laneHeading(lane) {
  const t = lane.maxItems ? `${lane.title} (${lane.maxItems})` : lane.title;
  return t.trim().replace(/\r?\n/g, "<br>");
}
function toCard(first, rest) {
  let checkChar = " ";
  let head = first;
  const task = TASK.exec(first);
  if (task) {
    checkChar = task[1];
    head = task[2] ?? "";
  }
  let text = [head, ...rest].join("\n").trim().replace(/\r?\n(?: {4}|\t)/g, "\n").replace(/<br>/g, "\n").trim();
  const lines = text.split("\n");
  let blockId;
  const bid = BLOCK_ID.exec(lines[0]);
  if (bid) {
    blockId = bid[1];
    lines[0] = lines[0].slice(0, bid.index);
    text = lines.join("\n");
  }
  const card = { id: newId("c"), text, checked: checkChar !== " ", checkChar };
  if (blockId) card.blockId = blockId;
  return card;
}
function parseBoard(md) {
  let body = md;
  let frontmatter = "";
  const fm = FRONTMATTER.exec(md);
  if (fm) {
    frontmatter = fm[1].trim();
    body = md.slice(fm[0].length);
  }
  let settings = {};
  const footer = SETTINGS_FOOTER.exec(body);
  if (footer) {
    try {
      const parsed = JSON.parse(footer[1].trim());
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) settings = parsed;
    } catch {
    }
    body = body.slice(0, footer.index);
  }
  const kind = boardKind(frontmatter);
  if (kind) settings[FRONTMATTER_KEY] = kind === "basic" ? "board" : kind;
  const board = { frontmatter, lanes: [], archive: [], settings };
  let target = null;
  let lane = null;
  let afterBreak = false;
  let item = null;
  const flush = () => {
    if (item && target) target.push(toCard(item.first, item.rest));
    item = null;
  };
  for (const line of body.split(/\r?\n/)) {
    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      if (afterBreak) {
        target = board.archive;
        lane = null;
      } else {
        lane = { id: newId("l"), ...parseLaneTitle(heading[2]), markComplete: false, cards: [] };
        board.lanes.push(lane);
        target = lane.cards;
      }
      afterBreak = false;
      continue;
    }
    if (THEMATIC_BREAK.test(line) && !(item && /^\s/.test(line))) {
      flush();
      afterBreak = true;
      continue;
    }
    if (!line.trim()) {
      if (item) item.blanks++;
      continue;
    }
    const li = LIST_ITEM.exec(line);
    if (li && target) {
      flush();
      item = { first: li[1] ?? "", rest: [], blanks: 0 };
      afterBreak = false;
      continue;
    }
    if (item && (/^\s/.test(line) || item.blanks === 0)) {
      for (; item.blanks > 0; item.blanks--) item.rest.push("");
      item.rest.push(line);
      continue;
    }
    flush();
    afterBreak = false;
    if (lane && line.trim() === COMPLETE && lane.cards.length === 0) lane.markComplete = true;
  }
  flush();
  return board;
}
function cardToMd(card, indent) {
  const lines = card.text.trim().replace(/\r?\n/g, `
${indent}`).split("\n");
  if (card.blockId) lines[0] += ` ^${card.blockId}`;
  return `- [${card.checkChar}] ${lines.join("\n")}`;
}
function serializeBoard(board, o = {}) {
  const indent = o.useTab === false ? "    " : "	";
  const yaml = board.frontmatter.trim() || `${FRONTMATTER_KEY}: board`;
  let out = ["---", "", `${yaml}
`, "---", "", ""].join("\n");
  for (const lane of board.lanes) {
    const lines = [`## ${laneHeading(lane)}`, ""];
    if (lane.markComplete) lines.push(COMPLETE);
    for (const c of lane.cards) lines.push(cardToMd(c, indent));
    lines.push("", "", "");
    out += lines.join("\n");
  }
  if (board.archive.length) {
    out += [ARCHIVE_BREAK, "", `## ${ARCHIVE_TITLE}`, "", ...board.archive.map((c) => cardToMd(c, indent))].join("\n");
  }
  const settings = { ...board.settings };
  if (!(FRONTMATTER_KEY in settings)) settings[FRONTMATTER_KEY] = boardKind(yaml) ?? "board";
  out += ["", "", "%% kanban:settings", "```", JSON.stringify(settings), "```", "%%"].join("\n");
  return out;
}
function newBoardMarkdown(lanes = ["To do", "Doing", "Done"]) {
  return serializeBoard({
    frontmatter: `${FRONTMATTER_KEY}: board`,
    lanes: lanes.map((title, i) => ({ id: newId("l"), title, maxItems: 0, markComplete: i === lanes.length - 1 && lanes.length > 1, cards: [] })),
    archive: [],
    settings: { [FRONTMATTER_KEY]: "board" }
  });
}

// src/view.ts
var import_obsidian = require("obsidian");
var import_helenite = require("helenite");

// src/ops.ts
var clone = (b) => structuredClone(b);
function findCard(b, cardId) {
  for (const lane of b.lanes) {
    const index2 = lane.cards.findIndex((c) => c.id === cardId);
    if (index2 >= 0) return { list: lane.cards, index: index2, lane };
  }
  const index = b.archive.findIndex((c) => c.id === cardId);
  return index >= 0 ? { list: b.archive, index, lane: null } : null;
}
var laneIndex = (b, laneId) => b.lanes.findIndex((l) => l.id === laneId);
var clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
function setDone(card, done) {
  card.checked = done;
  card.checkChar = done ? card.checkChar !== " " ? card.checkChar : "x" : " ";
}
function addLane(board, title, at = board.lanes.length) {
  const b = clone(board);
  b.lanes.splice(clamp(at, 0, b.lanes.length), 0, { id: newId("l"), title: title.trim(), maxItems: 0, markComplete: false, cards: [] });
  return b;
}
function renameLane(board, laneId, title) {
  const b = clone(board);
  const lane = b.lanes[laneIndex(b, laneId)];
  if (lane) lane.title = title.trim();
  return b;
}
function deleteLane(board, laneId) {
  const b = clone(board);
  b.lanes = b.lanes.filter((l) => l.id !== laneId);
  return b;
}
function moveLane(board, laneId, to) {
  const b = clone(board);
  const from = laneIndex(b, laneId);
  if (from < 0) return b;
  const [lane] = b.lanes.splice(from, 1);
  b.lanes.splice(clamp(to, 0, b.lanes.length), 0, lane);
  return b;
}
function setMarkComplete(board, laneId, on) {
  const b = clone(board);
  const lane = b.lanes[laneIndex(b, laneId)];
  if (!lane) return b;
  lane.markComplete = on;
  if (on) lane.cards.forEach((c) => setDone(c, true));
  return b;
}
function setMaxItems(board, laneId, max) {
  const b = clone(board);
  const lane = b.lanes[laneIndex(b, laneId)];
  if (lane) lane.maxItems = Math.max(0, Math.floor(max) || 0);
  return b;
}
function addCard(board, laneId, text, at) {
  const b = clone(board);
  const lane = b.lanes[laneIndex(b, laneId)];
  if (!lane) return b;
  const card = { id: newId("c"), text: text.trim(), checked: false, checkChar: " " };
  if (lane.markComplete) setDone(card, true);
  lane.cards.splice(clamp(at ?? lane.cards.length, 0, lane.cards.length), 0, card);
  return b;
}
function editCard(board, cardId, text) {
  const b = clone(board);
  const hit = findCard(b, cardId);
  if (hit) hit.list[hit.index].text = text.trim();
  return b;
}
function deleteCard(board, cardId) {
  const b = clone(board);
  const hit = findCard(b, cardId);
  if (hit) hit.list.splice(hit.index, 1);
  return b;
}
function toggleCard(board, cardId) {
  const b = clone(board);
  const hit = findCard(b, cardId);
  if (hit) {
    const card = hit.list[hit.index];
    setDone(card, !card.checked);
  }
  return b;
}
function moveCard(board, cardId, toLaneId, to) {
  const b = clone(board);
  const hit = findCard(b, cardId);
  const dest = b.lanes[laneIndex(b, toLaneId)];
  if (!hit || !dest) return b;
  const [card] = hit.list.splice(hit.index, 1);
  const same = hit.list === dest.cards;
  if (dest.markComplete) setDone(card, true);
  else if (hit.lane?.markComplete && !same) setDone(card, false);
  dest.cards.splice(clamp(to, 0, dest.cards.length), 0, card);
  return b;
}
function archiveCard(board, cardId) {
  const b = clone(board);
  const hit = findCard(b, cardId);
  if (!hit || !hit.lane) return b;
  const [card] = hit.list.splice(hit.index, 1);
  b.archive.push(card);
  return b;
}
function restoreCard(board, cardId, laneId) {
  const b = clone(board);
  const index = b.archive.findIndex((c) => c.id === cardId);
  const lane = b.lanes[laneIndex(b, laneId)];
  if (index < 0 || !lane) return b;
  const [card] = b.archive.splice(index, 1);
  if (lane.markComplete) setDone(card, true);
  lane.cards.push(card);
  return b;
}
function archiveDone(board, laneId) {
  const b = clone(board);
  const lane = b.lanes[laneIndex(b, laneId)];
  if (!lane) return b;
  b.archive.push(...lane.cards.filter((c) => c.checked));
  lane.cards = lane.cards.filter((c) => !c.checked);
  return b;
}

// src/view.ts
var VIEW_TYPE = "helenite-kanban";
var toPrompt = (text) => text.replace(/\r?\n/g, "<br>");
var fromPrompt = (text) => text.replace(/<br>/g, "\n");
var firstLine = (text) => text.split("\n")[0] || "(empty card)";
var required = (what) => (v) => v.trim() ? null : `Enter a ${what}.`;
function unwrapParagraph(el) {
  const only = el.children.length === 1 ? el.firstElementChild : null;
  if (only?.tagName === "P") only.replaceWith(...Array.from(only.childNodes));
}
var KanbanView = class extends import_obsidian.TextFileView {
  constructor(leaf, host) {
    super(leaf);
    this.host = host;
  }
  host;
  board = parseBoard("");
  /** Only an edit made here rewrites the note; just viewing a hand-written board leaves its layout alone. */
  dirty = false;
  /** While a card is dragged the board is not redrawn; a redraw asked for meanwhile runs when the drag ends. */
  dragging = false;
  pending = false;
  getViewType() {
    return VIEW_TYPE;
  }
  getIcon() {
    return "square-kanban";
  }
  async onOpen() {
    this.addAction("file-text", "Open as markdown", () => this.host.openAsMarkdown(this.leaf));
  }
  getViewData() {
    if (!this.dirty) return this.data;
    const useTab = this.app.vault.getConfig?.("useTab") !== false;
    return serializeBoard(this.board, { useTab });
  }
  setViewData(data, clear) {
    if (clear) {
      this.contentEl.empty();
      this.dragging = this.pending = false;
    }
    this.data = data;
    this.dirty = false;
    this.board = parseBoard(data);
    this.render();
  }
  clear() {
    this.board = parseBoard("");
    this.dirty = false;
  }
  /** Writes only after an edit here, never for a board that is still loading or was only viewed. */
  async save(clear) {
    if (this.dirty) await super.save(clear);
  }
  /** Apply an edit, redraw and save. */
  update(next) {
    this.board = next;
    this.dirty = true;
    this.render();
    void this.save();
  }
  render() {
    if (this.dragging) {
      this.pending = true;
      return;
    }
    const root = this.contentEl;
    const scroll = this.scrollPositions();
    root.empty();
    root.addClass("hel-board-page");
    const bar = import_helenite.ui.toolbar(root, { label: "Board" });
    import_helenite.ui.button(bar, { text: "Add list", icon: "plus", onClick: () => this.addLane() });
    if (this.board.archive.length) {
      import_helenite.ui.button(bar, { text: `Archived cards (${this.board.archive.length})`, icon: "archive", onClick: () => this.restoreFromArchive() });
    }
    if (!this.board.lanes.length) {
      import_helenite.ui.emptyState(root, "No lists yet. Add a list to start the board.");
      return;
    }
    const shown = this.board;
    const board = import_helenite.ui.board(root, {
      label: "Lists",
      onDragStart: () => {
        this.dragging = true;
      },
      onDragEnd: () => this.endDrag(),
      // The note was read again mid-drag: these ids belong to the board that was replaced, so nothing is written.
      onDrop: (id, lane, at) => {
        if (this.board === shown) this.update(moveCard(shown, id, lane, at));
      }
    });
    const drawn = this.board.lanes.flatMap((lane, i) => this.renderLane(board, lane, i));
    this.restoreScroll(scroll);
    void Promise.allSettled(drawn).then(() => {
      if (board.el.parentElement === root) this.restoreScroll(scroll);
    });
  }
  /** Returns when each card's markdown is drawn. */
  renderLane(board, lane, index) {
    const title = lane.title || "Untitled list";
    const { head, list, card } = board.lane({ id: lane.id, label: title });
    import_helenite.ui.statusText(head, title).addEventListener("dblclick", () => void this.renameLane(lane));
    const count = lane.maxItems ? `${lane.cards.length}/${lane.maxItems}` : String(lane.cards.length);
    import_helenite.ui.badge(head, count, lane.maxItems && lane.cards.length > lane.maxItems ? "danger" : lane.markComplete ? "success" : "default");
    import_helenite.ui.moreButton(head, () => this.laneMenu(lane, index), "List options").el.classList.add("hel-toolbar-end");
    if (!lane.cards.length) import_helenite.ui.emptyState(list, "No cards", { variant: "inline" });
    const drawn = lane.cards.map((c) => this.renderCard(card({ id: c.id, tone: c.checked ? "muted" : "default" }).head, c, lane));
    import_helenite.ui.button(list, { text: "Add a card", icon: "plus", variant: "link", onClick: () => this.addCard(lane) });
    return drawn;
  }
  /** The done checkbox, the card's markdown and its menu, side by side in the card's head (a part for this: HELENITE-185). */
  renderCard(row, card, lane) {
    const check = row.createDiv().createEl("input", { cls: "task-list-item-checkbox", type: "checkbox" });
    check.checked = card.checked;
    check.setAttribute("aria-label", card.checked ? "Mark card as not done" : "Mark card as done");
    check.addEventListener("click", (e) => {
      e.stopPropagation();
      this.update(toggleCard(this.board, card.id));
    });
    const body = row.createDiv({ cls: "markdown-rendered" });
    const drawn = import_obsidian.MarkdownRenderer.render(this.app, card.text, body, this.file?.path ?? "", this).then(() => unwrapParagraph(body));
    body.addEventListener("dblclick", () => void this.editCard(card));
    import_helenite.ui.moreButton(row, () => this.cardMenu(card, lane), "Card options");
    return drawn;
  }
  endDrag() {
    this.dragging = false;
    if (this.pending) {
      this.pending = false;
      this.render();
    }
  }
  /** How far the row of lists and each list are scrolled, so an edit's redraw leaves the board where it was. */
  scrollPositions() {
    return {
      x: this.contentEl.querySelector(".hel-board")?.scrollLeft ?? 0,
      lists: Array.from(this.contentEl.querySelectorAll(".hel-board-lane"), (l) => ({
        lane: l.dataset.lane,
        top: l.querySelector(".hel-board-list")?.scrollTop ?? 0
      }))
    };
  }
  restoreScroll(p) {
    const row = this.contentEl.querySelector(".hel-board");
    if (row) row.scrollLeft = p.x;
    const lanes = Array.from(this.contentEl.querySelectorAll(".hel-board-lane"));
    const kept = lanes.some((l) => p.lists.some((s) => s.lane === l.dataset.lane));
    lanes.forEach((l, i) => {
      const saved = kept ? p.lists.find((s) => s.lane === l.dataset.lane) : p.lists[i];
      const list = l.querySelector(".hel-board-list");
      if (list && saved?.top) list.scrollTop = saved.top;
    });
  }
  laneMenu(lane, index) {
    const last = this.board.lanes.length - 1;
    return [
      { title: "Rename list", icon: "pencil", onClick: () => this.renameLane(lane) },
      { title: "Add a card at the top", icon: "plus", onClick: () => this.addCard(lane, 0) },
      { title: "Set card limit", icon: "hash", onClick: () => this.setLimit(lane) },
      {
        title: lane.markComplete ? "Stop marking cards as done" : "Mark cards in this list as done",
        icon: "check-square",
        onClick: () => this.update(setMarkComplete(this.board, lane.id, !lane.markComplete))
      },
      { title: "Archive done cards", icon: "archive", disabled: !lane.cards.some((c) => c.checked), onClick: () => this.update(archiveDone(this.board, lane.id)) },
      "separator",
      { title: "Move list left", icon: "arrow-left", disabled: index === 0, onClick: () => this.update(moveLane(this.board, lane.id, index - 1)) },
      { title: "Move list right", icon: "arrow-right", disabled: index === last, onClick: () => this.update(moveLane(this.board, lane.id, index + 1)) },
      "separator",
      { title: "Delete list", icon: "trash-2", danger: true, onClick: () => this.deleteLane(lane) }
    ];
  }
  cardMenu(card, lane) {
    const at = lane.cards.findIndex((c) => c.id === card.id);
    return [
      { title: "Edit card", icon: "pencil", onClick: () => this.editCard(card) },
      { title: "Move card to list", icon: "arrow-right-left", disabled: this.board.lanes.length < 2, onClick: () => this.moveToLane(card, lane) },
      { title: "Move to top", icon: "arrow-up-to-line", disabled: at === 0, onClick: () => this.update(moveCard(this.board, card.id, lane.id, 0)) },
      { title: "Move to bottom", icon: "arrow-down-to-line", disabled: at === lane.cards.length - 1, onClick: () => this.update(moveCard(this.board, card.id, lane.id, lane.cards.length)) },
      "separator",
      { title: "Archive card", icon: "archive", onClick: () => this.update(archiveCard(this.board, card.id)) },
      { title: "Delete card", icon: "trash-2", danger: true, onClick: () => this.deleteCard(card) }
    ];
  }
  async addLane() {
    const title = await import_helenite.ui.prompt(this.app, { title: "Add list", label: "Name", placeholder: "To do", action: "Add list", validate: required("name") });
    if (title) this.update(addLane(this.board, title));
  }
  async renameLane(lane) {
    const title = await import_helenite.ui.prompt(this.app, { title: "Rename list", label: "Name", value: lane.title, action: "Rename", validate: required("name") });
    if (title && title.trim() !== lane.title) this.update(renameLane(this.board, lane.id, title));
  }
  async setLimit(lane) {
    const v = await import_helenite.ui.prompt(this.app, {
      title: "Set card limit",
      label: "Most cards in this list (0 for no limit)",
      value: String(lane.maxItems),
      action: "Set limit",
      validate: (s) => /^\d+$/.test(s.trim()) ? null : "Enter a whole number."
    });
    if (v !== null) this.update(setMaxItems(this.board, lane.id, Number(v.trim())));
  }
  async deleteLane(lane) {
    const n = lane.cards.length;
    const ok = await import_helenite.ui.confirm(this.app, {
      title: "Delete list",
      message: `Delete ${lane.title || "this list"}${n ? ` and its ${n} card${n === 1 ? "" : "s"}` : ""}? This cannot be undone.`,
      action: "Delete",
      danger: true
    });
    if (ok) this.update(deleteLane(this.board, lane.id));
  }
  async addCard(lane, at) {
    const text = await import_helenite.ui.prompt(this.app, { title: "Add card", label: "Card", placeholder: "What needs doing?", action: "Add card", validate: required("card") });
    if (text) this.update(addCard(this.board, lane.id, fromPrompt(text), at));
  }
  async editCard(card) {
    const text = await import_helenite.ui.prompt(this.app, { title: "Edit card", label: "Card (<br> starts a new line)", value: toPrompt(card.text), action: "Save", validate: required("card") });
    if (text !== null && fromPrompt(text).trim() !== card.text) this.update(editCard(this.board, card.id, fromPrompt(text)));
  }
  async deleteCard(card) {
    const ok = await import_helenite.ui.confirm(this.app, { title: "Delete card", message: `Delete "${firstLine(card.text)}"? This cannot be undone.`, action: "Delete", danger: true });
    if (ok) this.update(deleteCard(this.board, card.id));
  }
  async moveToLane(card, from) {
    const options = this.board.lanes.map((l) => ({ value: l.id, text: l.title || "Untitled list", disabled: l.id === from.id }));
    const to = await import_helenite.ui.choose(this.app, { title: "Move card to list", options });
    if (to) this.update(moveCard(this.board, card.id, to, Number.MAX_SAFE_INTEGER));
  }
  async restoreFromArchive() {
    const first = this.board.lanes[0];
    if (!first) {
      import_helenite.ui.notice("Add a list first, then restore cards into it.");
      return;
    }
    const id = await import_helenite.ui.choose(this.app, {
      title: `Restore a card to ${first.title || "the first list"}`,
      options: this.board.archive.map((c) => ({ value: c.id, text: firstLine(c.text) }))
    });
    if (!id) return;
    this.update(restoreCard(this.board, id, first.id));
    import_helenite.ui.notice("Card restored", { kind: "success" });
  }
};

// src/main.ts
var KanbanPlugin = class extends import_obsidian2.Plugin {
  /** Leaves the user switched to markdown, with the note they did it for. They stay markdown until the note changes. */
  asMarkdown = /* @__PURE__ */ new WeakMap();
  async onload() {
    this.registerView(VIEW_TYPE, (leaf) => new KanbanView(leaf, this));
    this.addRibbonIcon("square-kanban", "New board", () => void this.createBoard());
    this.addCommand({ id: "create-board", name: "New board", callback: () => void this.createBoard() });
    this.addCommand({
      id: "toggle-view",
      name: "Switch between board and markdown",
      checkCallback: (checking) => {
        const leaf = this.app.workspace.activeLeaf ?? this.app.workspace.getMostRecentLeaf();
        const view = leaf?.view;
        if (view instanceof KanbanView) {
          if (!checking) this.openAsMarkdown(leaf);
          return true;
        }
        if (view instanceof import_obsidian2.MarkdownView && view.file && this.isBoard(view.file)) {
          if (!checking) void this.openAsBoard(leaf, view.file);
          return true;
        }
        return false;
      }
    });
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file, _source, leaf) => {
        if (file instanceof import_obsidian2.TFolder) {
          menu.addItem((i) => i.setTitle("New board").setIcon("square-kanban").onClick(() => void this.createBoard(file)));
        } else if (file instanceof import_obsidian2.TFile && leaf?.view instanceof import_obsidian2.MarkdownView && this.isBoard(file)) {
          menu.addItem((i) => i.setTitle("Open as board").setIcon("square-kanban").onClick(() => void this.openAsBoard(leaf, file)));
        }
      })
    );
    this.registerEvent(this.app.workspace.on("file-open", () => void this.switchActiveLeaf()));
    this.app.workspace.onLayoutReady(() => {
      this.app.workspace.iterateRootLeaves?.((leaf) => void this.maybeSwitch(leaf));
    });
  }
  /** True when the note is a board, by its cached frontmatter. */
  isBoard(file) {
    return isBoardFrontmatter(this.app.metadataCache.getFileCache(file)?.frontmatter);
  }
  async switchActiveLeaf() {
    const leaf = this.app.workspace.activeLeaf ?? this.app.workspace.getMostRecentLeaf();
    if (leaf) await this.maybeSwitch(leaf);
  }
  async maybeSwitch(leaf) {
    const view = leaf.view;
    if (!(view instanceof import_obsidian2.MarkdownView) || !view.file) return;
    const file = view.file;
    const pinned = this.asMarkdown.get(leaf);
    if (pinned === file.path) return;
    if (pinned) this.asMarkdown.delete(leaf);
    const board = this.app.metadataCache.getFileCache(file) ? this.isBoard(file) : isBoardMarkdown(await this.app.vault.cachedRead(file));
    if (board) await this.openAsBoard(leaf, file);
  }
  async openAsBoard(leaf, file) {
    this.asMarkdown.delete(leaf);
    await leaf.setViewState({ type: VIEW_TYPE, state: { file: file.path }, active: true });
  }
  openAsMarkdown(leaf) {
    const file = leaf.view.file;
    if (!file) return;
    this.asMarkdown.set(leaf, file.path);
    void leaf.setViewState({ type: "markdown", state: { file: file.path }, active: true });
  }
  /** Create "Untitled Kanban.md" (or the next free name) in `folder`, or where new notes go, and open it. */
  async createBoard(folder) {
    const parent = folder ?? this.app.fileManager.getNewFileParent(this.app.workspace.getActiveFile()?.path ?? "");
    const dir = parent && !parent.isRoot() ? `${parent.path}/` : "";
    let path = `${dir}Untitled Kanban.md`;
    for (let n = 1; this.app.vault.getAbstractFileByPath(path); n++) path = `${dir}Untitled Kanban ${n}.md`;
    try {
      const file = await this.app.vault.create(path, newBoardMarkdown());
      await this.openAsBoard(this.app.workspace.getLeaf(false), file);
    } catch (e) {
      import_helenite2.ui.notice(`Could not create the board: ${e instanceof Error ? e.message : String(e)}`, { kind: "error" });
    }
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL21haW4udHMiLCAiLi4vc3JjL2JvYXJkLnRzIiwgIi4uL3NyYy92aWV3LnRzIiwgIi4uL3NyYy9vcHMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8vIEthbmJhbjogZmlyc3QtcGFydHkgSGVsZW5pdGUgcG9ydCBvZiB0aGUgT2JzaWRpYW4gS2FuYmFuIHBsdWdpbiAob2JzaWRpYW4ta2FuYmFuKS4gQm9hcmQgbm90ZXMgYXJlIHBsYWluIG1hcmtkb3duIGluXG4vLyB0aGF0IHBsdWdpbidzIGZvcm1hdCAoc2VlIGJvYXJkLnRzKSwgc28gdGhlIHNhbWUgZmlsZXMgd29yayBpbiBib3RoIGFwcHMuXG5pbXBvcnQgeyBNYXJrZG93blZpZXcsIFBsdWdpbiwgVEZpbGUsIFRGb2xkZXIsIHR5cGUgV29ya3NwYWNlTGVhZiB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IHVpIH0gZnJvbSAnaGVsZW5pdGUnO1xuaW1wb3J0IHsgaXNCb2FyZEZyb250bWF0dGVyLCBpc0JvYXJkTWFya2Rvd24sIG5ld0JvYXJkTWFya2Rvd24gfSBmcm9tICcuL2JvYXJkJztcbmltcG9ydCB7IEthbmJhblZpZXcsIFZJRVdfVFlQRSwgdHlwZSBLYW5iYW5Ib3N0IH0gZnJvbSAnLi92aWV3JztcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgS2FuYmFuUGx1Z2luIGV4dGVuZHMgUGx1Z2luIGltcGxlbWVudHMgS2FuYmFuSG9zdCB7XG4gIC8qKiBMZWF2ZXMgdGhlIHVzZXIgc3dpdGNoZWQgdG8gbWFya2Rvd24sIHdpdGggdGhlIG5vdGUgdGhleSBkaWQgaXQgZm9yLiBUaGV5IHN0YXkgbWFya2Rvd24gdW50aWwgdGhlIG5vdGUgY2hhbmdlcy4gKi9cbiAgcHJpdmF0ZSBhc01hcmtkb3duID0gbmV3IFdlYWtNYXA8V29ya3NwYWNlTGVhZiwgc3RyaW5nPigpO1xuXG4gIGFzeW5jIG9ubG9hZCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLnJlZ2lzdGVyVmlldyhWSUVXX1RZUEUsIChsZWFmOiBXb3Jrc3BhY2VMZWFmKSA9PiBuZXcgS2FuYmFuVmlldyhsZWFmLCB0aGlzKSk7XG4gICAgdGhpcy5hZGRSaWJib25JY29uKCdzcXVhcmUta2FuYmFuJywgJ05ldyBib2FyZCcsICgpID0+IHZvaWQgdGhpcy5jcmVhdGVCb2FyZCgpKTtcbiAgICB0aGlzLmFkZENvbW1hbmQoeyBpZDogJ2NyZWF0ZS1ib2FyZCcsIG5hbWU6ICdOZXcgYm9hcmQnLCBjYWxsYmFjazogKCkgPT4gdm9pZCB0aGlzLmNyZWF0ZUJvYXJkKCkgfSk7XG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiAndG9nZ2xlLXZpZXcnLFxuICAgICAgbmFtZTogJ1N3aXRjaCBiZXR3ZWVuIGJvYXJkIGFuZCBtYXJrZG93bicsXG4gICAgICBjaGVja0NhbGxiYWNrOiAoY2hlY2tpbmc6IGJvb2xlYW4pID0+IHtcbiAgICAgICAgY29uc3QgbGVhZiA9IHRoaXMuYXBwLndvcmtzcGFjZS5hY3RpdmVMZWFmID8/IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRNb3N0UmVjZW50TGVhZigpO1xuICAgICAgICBjb25zdCB2aWV3ID0gbGVhZj8udmlldztcbiAgICAgICAgaWYgKHZpZXcgaW5zdGFuY2VvZiBLYW5iYW5WaWV3KSB7XG4gICAgICAgICAgaWYgKCFjaGVja2luZykgdGhpcy5vcGVuQXNNYXJrZG93bihsZWFmISk7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHZpZXcgaW5zdGFuY2VvZiBNYXJrZG93blZpZXcgJiYgdmlldy5maWxlICYmIHRoaXMuaXNCb2FyZCh2aWV3LmZpbGUpKSB7XG4gICAgICAgICAgaWYgKCFjaGVja2luZykgdm9pZCB0aGlzLm9wZW5Bc0JvYXJkKGxlYWYhLCB2aWV3LmZpbGUpO1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KFxuICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9uKCdmaWxlLW1lbnUnLCAobWVudTogYW55LCBmaWxlOiBhbnksIF9zb3VyY2U6IHN0cmluZywgbGVhZj86IFdvcmtzcGFjZUxlYWYpID0+IHtcbiAgICAgICAgaWYgKGZpbGUgaW5zdGFuY2VvZiBURm9sZGVyKSB7XG4gICAgICAgICAgbWVudS5hZGRJdGVtKChpOiBhbnkpID0+IGkuc2V0VGl0bGUoJ05ldyBib2FyZCcpLnNldEljb24oJ3NxdWFyZS1rYW5iYW4nKS5vbkNsaWNrKCgpID0+IHZvaWQgdGhpcy5jcmVhdGVCb2FyZChmaWxlKSkpO1xuICAgICAgICB9IGVsc2UgaWYgKGZpbGUgaW5zdGFuY2VvZiBURmlsZSAmJiBsZWFmPy52aWV3IGluc3RhbmNlb2YgTWFya2Rvd25WaWV3ICYmIHRoaXMuaXNCb2FyZChmaWxlKSkge1xuICAgICAgICAgIG1lbnUuYWRkSXRlbSgoaTogYW55KSA9PiBpLnNldFRpdGxlKCdPcGVuIGFzIGJvYXJkJykuc2V0SWNvbignc3F1YXJlLWthbmJhbicpLm9uQ2xpY2soKCkgPT4gdm9pZCB0aGlzLm9wZW5Bc0JvYXJkKGxlYWYsIGZpbGUpKSk7XG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgICk7XG4gICAgLy8gQSBib2FyZCBub3RlIG9wZW5zIGFzIGEgYm9hcmQsIHVubGVzcyB0aGUgdXNlciBhc2tlZCBmb3IgbWFya2Rvd24gaW4gdGhhdCB0YWIuXG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KHRoaXMuYXBwLndvcmtzcGFjZS5vbignZmlsZS1vcGVuJywgKCkgPT4gdm9pZCB0aGlzLnN3aXRjaEFjdGl2ZUxlYWYoKSkpO1xuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbkxheW91dFJlYWR5KCgpID0+IHtcbiAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5pdGVyYXRlUm9vdExlYXZlcz8uKChsZWFmOiBXb3Jrc3BhY2VMZWFmKSA9PiB2b2lkIHRoaXMubWF5YmVTd2l0Y2gobGVhZikpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqIFRydWUgd2hlbiB0aGUgbm90ZSBpcyBhIGJvYXJkLCBieSBpdHMgY2FjaGVkIGZyb250bWF0dGVyLiAqL1xuICBpc0JvYXJkKGZpbGU6IFRGaWxlKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGlzQm9hcmRGcm9udG1hdHRlcih0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShmaWxlKT8uZnJvbnRtYXR0ZXIpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBzd2l0Y2hBY3RpdmVMZWFmKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuYWN0aXZlTGVhZiA/PyB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TW9zdFJlY2VudExlYWYoKTtcbiAgICBpZiAobGVhZikgYXdhaXQgdGhpcy5tYXliZVN3aXRjaChsZWFmKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgbWF5YmVTd2l0Y2gobGVhZjogV29ya3NwYWNlTGVhZik6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHZpZXcgPSBsZWFmLnZpZXc7XG4gICAgaWYgKCEodmlldyBpbnN0YW5jZW9mIE1hcmtkb3duVmlldykgfHwgIXZpZXcuZmlsZSkgcmV0dXJuO1xuICAgIGNvbnN0IGZpbGUgPSB2aWV3LmZpbGU7XG4gICAgY29uc3QgcGlubmVkID0gdGhpcy5hc01hcmtkb3duLmdldChsZWFmKTtcbiAgICBpZiAocGlubmVkID09PSBmaWxlLnBhdGgpIHJldHVybjtcbiAgICBpZiAocGlubmVkKSB0aGlzLmFzTWFya2Rvd24uZGVsZXRlKGxlYWYpO1xuICAgIC8vIFRoZSBjYWNoZSBtYXkgbm90IGhhdmUgdGhlIG5vdGUgeWV0IHJpZ2h0IGFmdGVyIGl0IHdhcyBjcmVhdGVkOyBmYWxsIGJhY2sgdG8gcmVhZGluZyBpdC5cbiAgICBjb25zdCBib2FyZCA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGZpbGUpID8gdGhpcy5pc0JvYXJkKGZpbGUpIDogaXNCb2FyZE1hcmtkb3duKGF3YWl0IHRoaXMuYXBwLnZhdWx0LmNhY2hlZFJlYWQoZmlsZSkpO1xuICAgIGlmIChib2FyZCkgYXdhaXQgdGhpcy5vcGVuQXNCb2FyZChsZWFmLCBmaWxlKTtcbiAgfVxuXG4gIGFzeW5jIG9wZW5Bc0JvYXJkKGxlYWY6IFdvcmtzcGFjZUxlYWYsIGZpbGU6IFRGaWxlKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5hc01hcmtkb3duLmRlbGV0ZShsZWFmKTtcbiAgICBhd2FpdCBsZWFmLnNldFZpZXdTdGF0ZSh7IHR5cGU6IFZJRVdfVFlQRSwgc3RhdGU6IHsgZmlsZTogZmlsZS5wYXRoIH0sIGFjdGl2ZTogdHJ1ZSB9IGFzIGFueSk7XG4gIH1cblxuICBvcGVuQXNNYXJrZG93bihsZWFmOiBXb3Jrc3BhY2VMZWFmKTogdm9pZCB7XG4gICAgY29uc3QgZmlsZSA9IChsZWFmLnZpZXcgYXMgS2FuYmFuVmlldykuZmlsZTtcbiAgICBpZiAoIWZpbGUpIHJldHVybjtcbiAgICB0aGlzLmFzTWFya2Rvd24uc2V0KGxlYWYsIGZpbGUucGF0aCk7XG4gICAgdm9pZCBsZWFmLnNldFZpZXdTdGF0ZSh7IHR5cGU6ICdtYXJrZG93bicsIHN0YXRlOiB7IGZpbGU6IGZpbGUucGF0aCB9LCBhY3RpdmU6IHRydWUgfSBhcyBhbnkpO1xuICB9XG5cbiAgLyoqIENyZWF0ZSBcIlVudGl0bGVkIEthbmJhbi5tZFwiIChvciB0aGUgbmV4dCBmcmVlIG5hbWUpIGluIGBmb2xkZXJgLCBvciB3aGVyZSBuZXcgbm90ZXMgZ28sIGFuZCBvcGVuIGl0LiAqL1xuICBhc3luYyBjcmVhdGVCb2FyZChmb2xkZXI/OiBURm9sZGVyKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgcGFyZW50ID0gZm9sZGVyID8/IHRoaXMuYXBwLmZpbGVNYW5hZ2VyLmdldE5ld0ZpbGVQYXJlbnQodGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKT8ucGF0aCA/PyAnJyk7XG4gICAgY29uc3QgZGlyID0gcGFyZW50ICYmICFwYXJlbnQuaXNSb290KCkgPyBgJHtwYXJlbnQucGF0aH0vYCA6ICcnO1xuICAgIGxldCBwYXRoID0gYCR7ZGlyfVVudGl0bGVkIEthbmJhbi5tZGA7XG4gICAgZm9yIChsZXQgbiA9IDE7IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChwYXRoKTsgbisrKSBwYXRoID0gYCR7ZGlyfVVudGl0bGVkIEthbmJhbiAke259Lm1kYDtcbiAgICB0cnkge1xuICAgICAgY29uc3QgZmlsZSA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmNyZWF0ZShwYXRoLCBuZXdCb2FyZE1hcmtkb3duKCkpO1xuICAgICAgYXdhaXQgdGhpcy5vcGVuQXNCb2FyZCh0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhZihmYWxzZSksIGZpbGUpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHVpLm5vdGljZShgQ291bGQgbm90IGNyZWF0ZSB0aGUgYm9hcmQ6ICR7ZSBpbnN0YW5jZW9mIEVycm9yID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpfWAsIHsga2luZDogJ2Vycm9yJyB9KTtcbiAgICB9XG4gIH1cbn1cbiIsICIvLyBSZWFkcyBhbmQgd3JpdGVzIEthbmJhbiBib2FyZCBub3RlcyBpbiB0aGUgZm9ybWF0IE9ic2lkaWFuJ3MgS2FuYmFuIHBsdWdpbiB1c2VzIChtZ21leWVycy9vYnNpZGlhbi1rYW5iYW4sIGxpc3Rcbi8vIGZvcm1hdCksIHNvIGEgYm9hcmQgZWRpdGVkIGhlcmUgb3BlbnMgdW5jaGFuZ2VkIHRoZXJlIGFuZCB0aGUgb3RoZXIgd2F5IHJvdW5kLiBQdXJlOiBubyBET00sIG5vIE9ic2lkaWFuIEFQSS5cbi8vXG4vLyBBIGJvYXJkIG5vdGUgbG9va3MgbGlrZSB0aGlzOlxuLy9cbi8vICAgLS0tXG4vL1xuLy8gICBrYW5iYW4tcGx1Z2luOiBib2FyZFxuLy9cbi8vICAgLS0tXG4vL1xuLy8gICAjIyBUbyBkb1xuLy9cbi8vICAgLSBbIF0gQSBjYXJkXG4vLyAgIFx0YSBzZWNvbmQgbGluZSwgaW5kZW50ZWRcbi8vXG4vL1xuLy8gICAjIyBEb25lXG4vL1xuLy8gICAqKkNvbXBsZXRlKipcbi8vICAgLSBbeF0gRG9uZSBjYXJkXG4vL1xuLy9cbi8vICAgKioqXG4vL1xuLy8gICAjIyBBcmNoaXZlXG4vL1xuLy8gICAtIFt4XSBPbGQgY2FyZFxuLy9cbi8vICAgJSUga2FuYmFuOnNldHRpbmdzXG4vLyAgIGBgYFxuLy8gICB7XCJrYW5iYW4tcGx1Z2luXCI6XCJib2FyZFwifVxuLy8gICBgYGBcbi8vICAgJSVcblxuZXhwb3J0IGNvbnN0IEZST05UTUFUVEVSX0tFWSA9ICdrYW5iYW4tcGx1Z2luJztcblxuZXhwb3J0IGludGVyZmFjZSBDYXJkIHtcbiAgaWQ6IHN0cmluZztcbiAgLyoqIFRoZSBjYXJkJ3MgbWFya2Rvd24sIHdpdGhvdXQgdGhlIGNoZWNrYm94LCBibG9jayBpZCBvciBsaW5lIGluZGVudGF0aW9uLiBNYXkgc3BhbiBzZXZlcmFsIGxpbmVzLiAqL1xuICB0ZXh0OiBzdHJpbmc7XG4gIGNoZWNrZWQ6IGJvb2xlYW47XG4gIC8qKiBUaGUgY2hhcmFjdGVyIGJldHdlZW4gdGhlIGJyYWNrZXRzOiAnICcgZm9yIGFuIG9wZW4gY2FyZCwgdXN1YWxseSAneCcgZm9yIGEgZG9uZSBvbmUuICovXG4gIGNoZWNrQ2hhcjogc3RyaW5nO1xuICAvKiogQSB0cmFpbGluZyBgXmlkYCBvbiB0aGUgY2FyZCdzIGZpcnN0IGxpbmUsIGtlcHQgc28gbGlua3MgdG8gdGhlIGNhcmQgc3Vydml2ZSBhIHJld3JpdGUuICovXG4gIGJsb2NrSWQ/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTGFuZSB7XG4gIGlkOiBzdHJpbmc7XG4gIHRpdGxlOiBzdHJpbmc7XG4gIC8qKiBUaGUgY2FyZCBsaW1pdCB3cml0dGVuIGFzIGAjIyBUaXRsZSAoNSlgOyAwIHdoZW4gdGhlcmUgaXMgbm9uZS4gKi9cbiAgbWF4SXRlbXM6IG51bWJlcjtcbiAgLyoqIEEgYCoqQ29tcGxldGUqKmAgbGluZSB1bmRlciB0aGUgaGVhZGluZzogY2FyZHMgbW92ZWQgaGVyZSBhcmUgY2hlY2tlZCBvZmYuICovXG4gIG1hcmtDb21wbGV0ZTogYm9vbGVhbjtcbiAgY2FyZHM6IENhcmRbXTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBCb2FyZCB7XG4gIC8qKiBUaGUgWUFNTCBiZXR3ZWVuIHRoZSBmcm9udG1hdHRlciBmZW5jZXMsIHRyaW1tZWQuIEtlcHQgYXMgd3JpdHRlbi4gKi9cbiAgZnJvbnRtYXR0ZXI6IHN0cmluZztcbiAgbGFuZXM6IExhbmVbXTtcbiAgYXJjaGl2ZTogQ2FyZFtdO1xuICAvKiogVGhlIEpTT04gaW4gdGhlIGAlJSBrYW5iYW46c2V0dGluZ3NgIGZvb3Rlciwgd2l0aCBga2FuYmFuLXBsdWdpbmAgY29waWVkIGluIGZyb20gdGhlIGZyb250bWF0dGVyLiAqL1xuICBzZXR0aW5nczogUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2VyaWFsaXplT3B0aW9ucyB7XG4gIC8qKiBPYnNpZGlhbidzIFwiSW5kZW50IHVzaW5nIHRhYnNcIiAob24gYnkgZGVmYXVsdCkuIE9mZiBpbmRlbnRzIGEgY2FyZCdzIGV4dHJhIGxpbmVzIHdpdGggZm91ciBzcGFjZXMuICovXG4gIHVzZVRhYj86IGJvb2xlYW47XG59XG5cbmxldCBuZXh0SWQgPSAwO1xuZXhwb3J0IGNvbnN0IG5ld0lkID0gKHByZWZpeDogc3RyaW5nKTogc3RyaW5nID0+IGAke3ByZWZpeH0keysrbmV4dElkfWA7XG5cbmNvbnN0IEZST05UTUFUVEVSID0gL14tLS1bIFxcdF0qXFxyP1xcbihbXFxzXFxTXSo/KVxccj9cXG4tLS1bIFxcdF0qKD86XFxyP1xcbnwkKS87XG5jb25zdCBTRVRUSU5HU19GT09URVIgPSAvKD86XFxyP1xcbikqJSUga2FuYmFuOnNldHRpbmdzWyBcXHRdKlxccj9cXG5gYGBbXlxcbl0qXFxyP1xcbihbXFxzXFxTXSo/KVxccj9cXG5gYGBbIFxcdF0qXFxyP1xcbiUlXFxzKiQvO1xuY29uc3QgSEVBRElORyA9IC9eIHswLDN9KCN7MSw2fSlbIFxcdF0rKC4qPylbIFxcdF0qJC87XG5jb25zdCBUSEVNQVRJQ19CUkVBSyA9IC9eIHswLDN9KFstKl9dKSg/OlsgXFx0XSpcXDEpezIsfVsgXFx0XSokLztcbmNvbnN0IExJU1RfSVRFTSA9IC9eIHswLDN9KD86Wy0qK118XFxkezEsOX1bLildKSg/OlsgXFx0XSsoLiopKT8kLztcbmNvbnN0IFRBU0sgPSAvXlxcWyguKVxcXSg/OlsgXFx0XSsoW1xcc1xcU10qKSk/JC87XG5jb25zdCBCTE9DS19JRCA9IC9cXHMrXFxeKFthLXpBLVowLTktXSspJC87XG5jb25zdCBDT01QTEVURSA9ICcqKkNvbXBsZXRlKionO1xuY29uc3QgQVJDSElWRV9CUkVBSyA9ICcqKionO1xuY29uc3QgQVJDSElWRV9USVRMRSA9ICdBcmNoaXZlJztcblxuLyoqIFRydWUgd2hlbiB0aGUgbm90ZSdzIGZyb250bWF0dGVyIG1hcmtzIGl0IGFzIGEgYm9hcmQgKGBrYW5iYW4tcGx1Z2luOiBib2FyZGAsIG9yIHRoZSBvbGQgYGJhc2ljYCkuICovXG5leHBvcnQgZnVuY3Rpb24gaXNCb2FyZE1hcmtkb3duKG1kOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgY29uc3QgZm0gPSBGUk9OVE1BVFRFUi5leGVjKG1kKTtcbiAgcmV0dXJuICEhZm0gJiYgYm9hcmRLaW5kKGZtWzFdKSAhPT0gbnVsbDtcbn1cblxuLyoqIFRydWUgZm9yIGEgZnJvbnRtYXR0ZXIgb2JqZWN0IChmcm9tIHRoZSBtZXRhZGF0YSBjYWNoZSkgdGhhdCBtYXJrcyBhIGJvYXJkLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzQm9hcmRGcm9udG1hdHRlcihmbTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gfCB1bmRlZmluZWQgfCBudWxsKTogYm9vbGVhbiB7XG4gIGNvbnN0IHYgPSBmbT8uW0ZST05UTUFUVEVSX0tFWV07XG4gIHJldHVybiB2ID09PSAnYm9hcmQnIHx8IHYgPT09ICdiYXNpYyc7XG59XG5cbmZ1bmN0aW9uIGJvYXJkS2luZCh5YW1sOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgY29uc3QgbSA9IC9ea2FuYmFuLXBsdWdpbjpbIFxcdF0qW1wiJ10/KFteXCInXFxzI10rKVtcIiddP1sgXFx0XSooPzojLiopPyQvbS5leGVjKHlhbWwpO1xuICByZXR1cm4gbSA/IG1bMV0gOiBudWxsO1xufVxuXG4vKiogYFRvIGRvICg1KWAgXHUyMTkyIHRpdGxlIGFuZCBjYXJkIGxpbWl0OyBgPGJyPmAgaW4gYSBoZWFkaW5nIGlzIGEgbGluZSBicmVhaywgYXMgT2JzaWRpYW4ncyBLYW5iYW4gd3JpdGVzIGl0LiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlTGFuZVRpdGxlKHJhdzogc3RyaW5nKTogeyB0aXRsZTogc3RyaW5nOyBtYXhJdGVtczogbnVtYmVyIH0ge1xuICBjb25zdCBzdHIgPSByYXcucmVwbGFjZSgvPGJyPi9nLCAnXFxuJykudHJpbSgpO1xuICBjb25zdCBtID0gL14oLio/KVxccypcXCgoXFxkKylcXCkkLy5leGVjKHN0cik7XG4gIHJldHVybiBtID8geyB0aXRsZTogbVsxXSwgbWF4SXRlbXM6IE51bWJlcihtWzJdKSB9IDogeyB0aXRsZTogc3RyLCBtYXhJdGVtczogMCB9O1xufVxuXG5mdW5jdGlvbiBsYW5lSGVhZGluZyhsYW5lOiBMYW5lKTogc3RyaW5nIHtcbiAgY29uc3QgdCA9IGxhbmUubWF4SXRlbXMgPyBgJHtsYW5lLnRpdGxlfSAoJHtsYW5lLm1heEl0ZW1zfSlgIDogbGFuZS50aXRsZTtcbiAgcmV0dXJuIHQudHJpbSgpLnJlcGxhY2UoL1xccj9cXG4vZywgJzxicj4nKTtcbn1cblxuLyoqIEEgY2FyZCdzIHNvdXJjZSBsaW5lcyAoZmlyc3QgbGluZSBhZnRlciB0aGUgbWFya2VyLCB0aGVuIGl0cyBjb250aW51YXRpb24gbGluZXMgYXMgd3JpdHRlbikgXHUyMTkyIGEgQ2FyZC4gKi9cbmZ1bmN0aW9uIHRvQ2FyZChmaXJzdDogc3RyaW5nLCByZXN0OiBzdHJpbmdbXSk6IENhcmQge1xuICBsZXQgY2hlY2tDaGFyID0gJyAnO1xuICBsZXQgaGVhZCA9IGZpcnN0O1xuICBjb25zdCB0YXNrID0gVEFTSy5leGVjKGZpcnN0KTtcbiAgaWYgKHRhc2spIHtcbiAgICBjaGVja0NoYXIgPSB0YXNrWzFdO1xuICAgIGhlYWQgPSB0YXNrWzJdID8/ICcnO1xuICB9XG4gIC8vIE9ic2lkaWFuJ3MgS2FuYmFuIHN0cmlwcyBvbmUgaW5kZW50IGxldmVsIGZyb20gY29udGludWF0aW9uIGxpbmVzLCB0aGVuIHR1cm5zIDxicj4gaW50byBsaW5lIGJyZWFrcy5cbiAgbGV0IHRleHQgPSBbaGVhZCwgLi4ucmVzdF0uam9pbignXFxuJykudHJpbSgpLnJlcGxhY2UoL1xccj9cXG4oPzogezR9fFxcdCkvZywgJ1xcbicpLnJlcGxhY2UoLzxicj4vZywgJ1xcbicpLnRyaW0oKTtcbiAgY29uc3QgbGluZXMgPSB0ZXh0LnNwbGl0KCdcXG4nKTtcbiAgbGV0IGJsb2NrSWQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgY29uc3QgYmlkID0gQkxPQ0tfSUQuZXhlYyhsaW5lc1swXSk7XG4gIGlmIChiaWQpIHtcbiAgICBibG9ja0lkID0gYmlkWzFdO1xuICAgIGxpbmVzWzBdID0gbGluZXNbMF0uc2xpY2UoMCwgYmlkLmluZGV4KTtcbiAgICB0ZXh0ID0gbGluZXMuam9pbignXFxuJyk7XG4gIH1cbiAgY29uc3QgY2FyZDogQ2FyZCA9IHsgaWQ6IG5ld0lkKCdjJyksIHRleHQsIGNoZWNrZWQ6IGNoZWNrQ2hhciAhPT0gJyAnLCBjaGVja0NoYXIgfTtcbiAgaWYgKGJsb2NrSWQpIGNhcmQuYmxvY2tJZCA9IGJsb2NrSWQ7XG4gIHJldHVybiBjYXJkO1xufVxuXG4vKiogUGFyc2UgYSBib2FyZCBub3RlLiBBbnl0aGluZyBvdXRzaWRlIGxhbmVzICh0ZXh0IGJlZm9yZSB0aGUgZmlyc3QgaGVhZGluZywgc3RyYXkgcGFyYWdyYXBocykgaXMgZHJvcHBlZCBvbiB3cml0ZSxcbiAqICBhcyBpdCBpcyBpbiBPYnNpZGlhbidzIEthbmJhbi4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUJvYXJkKG1kOiBzdHJpbmcpOiBCb2FyZCB7XG4gIGxldCBib2R5ID0gbWQ7XG4gIGxldCBmcm9udG1hdHRlciA9ICcnO1xuICBjb25zdCBmbSA9IEZST05UTUFUVEVSLmV4ZWMobWQpO1xuICBpZiAoZm0pIHtcbiAgICBmcm9udG1hdHRlciA9IGZtWzFdLnRyaW0oKTtcbiAgICBib2R5ID0gbWQuc2xpY2UoZm1bMF0ubGVuZ3RoKTtcbiAgfVxuXG4gIGxldCBzZXR0aW5nczogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7fTtcbiAgY29uc3QgZm9vdGVyID0gU0VUVElOR1NfRk9PVEVSLmV4ZWMoYm9keSk7XG4gIGlmIChmb290ZXIpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShmb290ZXJbMV0udHJpbSgpKTtcbiAgICAgIGlmIChwYXJzZWQgJiYgdHlwZW9mIHBhcnNlZCA9PT0gJ29iamVjdCcgJiYgIUFycmF5LmlzQXJyYXkocGFyc2VkKSkgc2V0dGluZ3MgPSBwYXJzZWQ7XG4gICAgfSBjYXRjaCB7XG4gICAgICAvLyBBbiB1bnJlYWRhYmxlIGZvb3RlciBpcyByZXBsYWNlZCBieSBhIGZyZXNoIG9uZSBvbiB3cml0ZS5cbiAgICB9XG4gICAgYm9keSA9IGJvZHkuc2xpY2UoMCwgZm9vdGVyLmluZGV4KTtcbiAgfVxuICBjb25zdCBraW5kID0gYm9hcmRLaW5kKGZyb250bWF0dGVyKTtcbiAgaWYgKGtpbmQpIHNldHRpbmdzW0ZST05UTUFUVEVSX0tFWV0gPSBraW5kID09PSAnYmFzaWMnID8gJ2JvYXJkJyA6IGtpbmQ7XG5cbiAgY29uc3QgYm9hcmQ6IEJvYXJkID0geyBmcm9udG1hdHRlciwgbGFuZXM6IFtdLCBhcmNoaXZlOiBbXSwgc2V0dGluZ3MgfTtcbiAgbGV0IHRhcmdldDogQ2FyZFtdIHwgbnVsbCA9IG51bGw7XG4gIGxldCBsYW5lOiBMYW5lIHwgbnVsbCA9IG51bGw7XG4gIGxldCBhZnRlckJyZWFrID0gZmFsc2U7XG4gIGxldCBpdGVtOiB7IGZpcnN0OiBzdHJpbmc7IHJlc3Q6IHN0cmluZ1tdOyBibGFua3M6IG51bWJlciB9IHwgbnVsbCA9IG51bGw7XG5cbiAgY29uc3QgZmx1c2ggPSAoKSA9PiB7XG4gICAgaWYgKGl0ZW0gJiYgdGFyZ2V0KSB0YXJnZXQucHVzaCh0b0NhcmQoaXRlbS5maXJzdCwgaXRlbS5yZXN0KSk7XG4gICAgaXRlbSA9IG51bGw7XG4gIH07XG5cbiAgZm9yIChjb25zdCBsaW5lIG9mIGJvZHkuc3BsaXQoL1xccj9cXG4vKSkge1xuICAgIGNvbnN0IGhlYWRpbmcgPSBIRUFESU5HLmV4ZWMobGluZSk7XG4gICAgaWYgKGhlYWRpbmcpIHtcbiAgICAgIGZsdXNoKCk7XG4gICAgICBpZiAoYWZ0ZXJCcmVhaykge1xuICAgICAgICB0YXJnZXQgPSBib2FyZC5hcmNoaXZlO1xuICAgICAgICBsYW5lID0gbnVsbDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxhbmUgPSB7IGlkOiBuZXdJZCgnbCcpLCAuLi5wYXJzZUxhbmVUaXRsZShoZWFkaW5nWzJdKSwgbWFya0NvbXBsZXRlOiBmYWxzZSwgY2FyZHM6IFtdIH07XG4gICAgICAgIGJvYXJkLmxhbmVzLnB1c2gobGFuZSk7XG4gICAgICAgIHRhcmdldCA9IGxhbmUuY2FyZHM7XG4gICAgICB9XG4gICAgICBhZnRlckJyZWFrID0gZmFsc2U7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKFRIRU1BVElDX0JSRUFLLnRlc3QobGluZSkgJiYgIShpdGVtICYmIC9eXFxzLy50ZXN0KGxpbmUpKSkge1xuICAgICAgZmx1c2goKTtcbiAgICAgIGFmdGVyQnJlYWsgPSB0cnVlO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmICghbGluZS50cmltKCkpIHtcbiAgICAgIGlmIChpdGVtKSBpdGVtLmJsYW5rcysrO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGNvbnN0IGxpID0gTElTVF9JVEVNLmV4ZWMobGluZSk7XG4gICAgaWYgKGxpICYmIHRhcmdldCkge1xuICAgICAgZmx1c2goKTtcbiAgICAgIGl0ZW0gPSB7IGZpcnN0OiBsaVsxXSA/PyAnJywgcmVzdDogW10sIGJsYW5rczogMCB9O1xuICAgICAgYWZ0ZXJCcmVhayA9IGZhbHNlO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmIChpdGVtICYmICgvXlxccy8udGVzdChsaW5lKSB8fCBpdGVtLmJsYW5rcyA9PT0gMCkpIHtcbiAgICAgIC8vIEFuIGluZGVudGVkIGxpbmUsIG9yIGEgbGF6eSBjb250aW51YXRpb24gcmlnaHQgdW5kZXIgdGhlIGl0ZW0sIGJlbG9uZ3MgdG8gdGhlIGNhcmQuXG4gICAgICBmb3IgKDsgaXRlbS5ibGFua3MgPiAwOyBpdGVtLmJsYW5rcy0tKSBpdGVtLnJlc3QucHVzaCgnJyk7XG4gICAgICBpdGVtLnJlc3QucHVzaChsaW5lKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBmbHVzaCgpO1xuICAgIGFmdGVyQnJlYWsgPSBmYWxzZTtcbiAgICBpZiAobGFuZSAmJiBsaW5lLnRyaW0oKSA9PT0gQ09NUExFVEUgJiYgbGFuZS5jYXJkcy5sZW5ndGggPT09IDApIGxhbmUubWFya0NvbXBsZXRlID0gdHJ1ZTtcbiAgfVxuICBmbHVzaCgpO1xuICByZXR1cm4gYm9hcmQ7XG59XG5cbmZ1bmN0aW9uIGNhcmRUb01kKGNhcmQ6IENhcmQsIGluZGVudDogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3QgbGluZXMgPSBjYXJkLnRleHQudHJpbSgpLnJlcGxhY2UoL1xccj9cXG4vZywgYFxcbiR7aW5kZW50fWApLnNwbGl0KCdcXG4nKTtcbiAgaWYgKGNhcmQuYmxvY2tJZCkgbGluZXNbMF0gKz0gYCBeJHtjYXJkLmJsb2NrSWR9YDtcbiAgcmV0dXJuIGAtIFske2NhcmQuY2hlY2tDaGFyfV0gJHtsaW5lcy5qb2luKCdcXG4nKX1gO1xufVxuXG4vKiogV3JpdGUgYSBib2FyZCBiYWNrIGluIE9ic2lkaWFuJ3MgS2FuYmFuIGxheW91dCwgYnl0ZSBmb3IgYnl0ZSB3aGF0IHRoYXQgcGx1Z2luIHdyaXRlcyBmb3IgdGhlIHNhbWUgYm9hcmQuICovXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplQm9hcmQoYm9hcmQ6IEJvYXJkLCBvOiBTZXJpYWxpemVPcHRpb25zID0ge30pOiBzdHJpbmcge1xuICBjb25zdCBpbmRlbnQgPSBvLnVzZVRhYiA9PT0gZmFsc2UgPyAnICAgICcgOiAnXFx0JztcbiAgY29uc3QgeWFtbCA9IGJvYXJkLmZyb250bWF0dGVyLnRyaW0oKSB8fCBgJHtGUk9OVE1BVFRFUl9LRVl9OiBib2FyZGA7XG4gIGxldCBvdXQgPSBbJy0tLScsICcnLCBgJHt5YW1sfVxcbmAsICctLS0nLCAnJywgJyddLmpvaW4oJ1xcbicpO1xuICBmb3IgKGNvbnN0IGxhbmUgb2YgYm9hcmQubGFuZXMpIHtcbiAgICBjb25zdCBsaW5lcyA9IFtgIyMgJHtsYW5lSGVhZGluZyhsYW5lKX1gLCAnJ107XG4gICAgaWYgKGxhbmUubWFya0NvbXBsZXRlKSBsaW5lcy5wdXNoKENPTVBMRVRFKTtcbiAgICBmb3IgKGNvbnN0IGMgb2YgbGFuZS5jYXJkcykgbGluZXMucHVzaChjYXJkVG9NZChjLCBpbmRlbnQpKTtcbiAgICBsaW5lcy5wdXNoKCcnLCAnJywgJycpO1xuICAgIG91dCArPSBsaW5lcy5qb2luKCdcXG4nKTtcbiAgfVxuICBpZiAoYm9hcmQuYXJjaGl2ZS5sZW5ndGgpIHtcbiAgICBvdXQgKz0gW0FSQ0hJVkVfQlJFQUssICcnLCBgIyMgJHtBUkNISVZFX1RJVExFfWAsICcnLCAuLi5ib2FyZC5hcmNoaXZlLm1hcCgoYykgPT4gY2FyZFRvTWQoYywgaW5kZW50KSldLmpvaW4oJ1xcbicpO1xuICB9XG4gIGNvbnN0IHNldHRpbmdzID0geyAuLi5ib2FyZC5zZXR0aW5ncyB9O1xuICBpZiAoIShGUk9OVE1BVFRFUl9LRVkgaW4gc2V0dGluZ3MpKSBzZXR0aW5nc1tGUk9OVE1BVFRFUl9LRVldID0gYm9hcmRLaW5kKHlhbWwpID8/ICdib2FyZCc7XG4gIG91dCArPSBbJycsICcnLCAnJSUga2FuYmFuOnNldHRpbmdzJywgJ2BgYCcsIEpTT04uc3RyaW5naWZ5KHNldHRpbmdzKSwgJ2BgYCcsICclJSddLmpvaW4oJ1xcbicpO1xuICByZXR1cm4gb3V0O1xufVxuXG4vKiogQSBuZXcgYm9hcmQgbm90ZSB3aXRoIHRoZSBnaXZlbiBsYW5lcy4gKi9cbmV4cG9ydCBmdW5jdGlvbiBuZXdCb2FyZE1hcmtkb3duKGxhbmVzOiBzdHJpbmdbXSA9IFsnVG8gZG8nLCAnRG9pbmcnLCAnRG9uZSddKTogc3RyaW5nIHtcbiAgcmV0dXJuIHNlcmlhbGl6ZUJvYXJkKHtcbiAgICBmcm9udG1hdHRlcjogYCR7RlJPTlRNQVRURVJfS0VZfTogYm9hcmRgLFxuICAgIGxhbmVzOiBsYW5lcy5tYXAoKHRpdGxlLCBpKSA9PiAoeyBpZDogbmV3SWQoJ2wnKSwgdGl0bGUsIG1heEl0ZW1zOiAwLCBtYXJrQ29tcGxldGU6IGkgPT09IGxhbmVzLmxlbmd0aCAtIDEgJiYgbGFuZXMubGVuZ3RoID4gMSwgY2FyZHM6IFtdIH0pKSxcbiAgICBhcmNoaXZlOiBbXSxcbiAgICBzZXR0aW5nczogeyBbRlJPTlRNQVRURVJfS0VZXTogJ2JvYXJkJyB9LFxuICB9KTtcbn1cbiIsICIvLyBUaGUgYm9hcmQgdmlldzogYSBUZXh0RmlsZVZpZXcgb3ZlciBhIGJvYXJkIG5vdGUuIEVkaXRzIGdvIHRocm91Z2ggb3BzLnRzIGFuZCBhcmUgd3JpdHRlbiBzdHJhaWdodCBiYWNrIHRvIHRoZSBub3RlLlxuaW1wb3J0IHsgTWFya2Rvd25SZW5kZXJlciwgVGV4dEZpbGVWaWV3LCB0eXBlIFdvcmtzcGFjZUxlYWYgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyB1aSwgdHlwZSBCb2FyZEhhbmRsZSwgdHlwZSBNZW51SXRlbVNwZWMgfSBmcm9tICdoZWxlbml0ZSc7XG5pbXBvcnQgeyBwYXJzZUJvYXJkLCBzZXJpYWxpemVCb2FyZCwgdHlwZSBCb2FyZCwgdHlwZSBDYXJkLCB0eXBlIExhbmUgfSBmcm9tICcuL2JvYXJkJztcbmltcG9ydCAqIGFzIG9wcyBmcm9tICcuL29wcyc7XG5cbmV4cG9ydCBjb25zdCBWSUVXX1RZUEUgPSAnaGVsZW5pdGUta2FuYmFuJztcblxuLyoqIEluIGEgcHJvbXB0LCBhIGNhcmQncyBsaW5lIGJyZWFrcyBhcmUgc2hvd24gYXMgPGJyPiAodGhlIGJvYXJkIGZvcm1hdCByZWFkcyA8YnI+IGJhY2sgYXMgYSBsaW5lIGJyZWFrKS4gKi9cbmNvbnN0IHRvUHJvbXB0ID0gKHRleHQ6IHN0cmluZyk6IHN0cmluZyA9PiB0ZXh0LnJlcGxhY2UoL1xccj9cXG4vZywgJzxicj4nKTtcbmNvbnN0IGZyb21Qcm9tcHQgPSAodGV4dDogc3RyaW5nKTogc3RyaW5nID0+IHRleHQucmVwbGFjZSgvPGJyPi9nLCAnXFxuJyk7XG5jb25zdCBmaXJzdExpbmUgPSAodGV4dDogc3RyaW5nKTogc3RyaW5nID0+IHRleHQuc3BsaXQoJ1xcbicpWzBdIHx8ICcoZW1wdHkgY2FyZCknO1xuY29uc3QgcmVxdWlyZWQgPSAod2hhdDogc3RyaW5nKSA9PiAodjogc3RyaW5nKSA9PiAodi50cmltKCkgPyBudWxsIDogYEVudGVyIGEgJHt3aGF0fS5gKTtcblxuLyoqIEEgY2FyZCBvZiBvbmUgcGFyYWdyYXBoIGlzIHNob3duIHdpdGhvdXQgdGhlIHBhcmFncmFwaCdzIG1hcmdpbnMsIHNvIGl0IGlzIG5vIHRhbGxlciB0aGFuIGl0cyB0ZXh0LiAqL1xuZnVuY3Rpb24gdW53cmFwUGFyYWdyYXBoKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICBjb25zdCBvbmx5ID0gZWwuY2hpbGRyZW4ubGVuZ3RoID09PSAxID8gZWwuZmlyc3RFbGVtZW50Q2hpbGQhIDogbnVsbDtcbiAgaWYgKG9ubHk/LnRhZ05hbWUgPT09ICdQJykgb25seS5yZXBsYWNlV2l0aCguLi5BcnJheS5mcm9tKG9ubHkuY2hpbGROb2RlcykpO1xufVxuXG5pbnRlcmZhY2UgU2Nyb2xsIHtcbiAgeDogbnVtYmVyO1xuICBsaXN0czogeyBsYW5lOiBzdHJpbmcgfCB1bmRlZmluZWQ7IHRvcDogbnVtYmVyIH1bXTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBLYW5iYW5Ib3N0IHtcbiAgLyoqIFJlb3BlbiB0aGUgbGVhZiBhcyBhIHBsYWluIG1hcmtkb3duIG5vdGUuICovXG4gIG9wZW5Bc01hcmtkb3duKGxlYWY6IFdvcmtzcGFjZUxlYWYpOiB2b2lkO1xufVxuXG5leHBvcnQgY2xhc3MgS2FuYmFuVmlldyBleHRlbmRzIFRleHRGaWxlVmlldyB7XG4gIGJvYXJkOiBCb2FyZCA9IHBhcnNlQm9hcmQoJycpO1xuICAvKiogT25seSBhbiBlZGl0IG1hZGUgaGVyZSByZXdyaXRlcyB0aGUgbm90ZTsganVzdCB2aWV3aW5nIGEgaGFuZC13cml0dGVuIGJvYXJkIGxlYXZlcyBpdHMgbGF5b3V0IGFsb25lLiAqL1xuICBwcml2YXRlIGRpcnR5ID0gZmFsc2U7XG4gIC8qKiBXaGlsZSBhIGNhcmQgaXMgZHJhZ2dlZCB0aGUgYm9hcmQgaXMgbm90IHJlZHJhd247IGEgcmVkcmF3IGFza2VkIGZvciBtZWFud2hpbGUgcnVucyB3aGVuIHRoZSBkcmFnIGVuZHMuICovXG4gIHByaXZhdGUgZHJhZ2dpbmcgPSBmYWxzZTtcbiAgcHJpdmF0ZSBwZW5kaW5nID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IobGVhZjogV29ya3NwYWNlTGVhZiwgcHJpdmF0ZSBob3N0OiBLYW5iYW5Ib3N0KSB7XG4gICAgc3VwZXIobGVhZik7XG4gIH1cblxuICBnZXRWaWV3VHlwZSgpOiBzdHJpbmcge1xuICAgIHJldHVybiBWSUVXX1RZUEU7XG4gIH1cblxuICBnZXRJY29uKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuICdzcXVhcmUta2FuYmFuJztcbiAgfVxuXG4gIGFzeW5jIG9uT3BlbigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLmFkZEFjdGlvbignZmlsZS10ZXh0JywgJ09wZW4gYXMgbWFya2Rvd24nLCAoKSA9PiB0aGlzLmhvc3Qub3BlbkFzTWFya2Rvd24odGhpcy5sZWFmKSk7XG4gIH1cblxuICBnZXRWaWV3RGF0YSgpOiBzdHJpbmcge1xuICAgIGlmICghdGhpcy5kaXJ0eSkgcmV0dXJuIHRoaXMuZGF0YTtcbiAgICBjb25zdCB1c2VUYWIgPSAodGhpcy5hcHAudmF1bHQgYXMgYW55KS5nZXRDb25maWc/LigndXNlVGFiJykgIT09IGZhbHNlO1xuICAgIHJldHVybiBzZXJpYWxpemVCb2FyZCh0aGlzLmJvYXJkLCB7IHVzZVRhYiB9KTtcbiAgfVxuXG4gIHNldFZpZXdEYXRhKGRhdGE6IHN0cmluZywgY2xlYXI6IGJvb2xlYW4pOiB2b2lkIHtcbiAgICAvLyBBbm90aGVyIG5vdGU6IGl0cyBib2FyZCBzdGFydHMgYXQgdGhlIHRvcCwgbm90IHdoZXJlIHRoZSBsYXN0IG9uZSB3YXMgc2Nyb2xsZWQgdG8uIEEgY2FyZCBkcmFnZ2VkIGZyb20gdGhlIGxhc3Qgb25lXG4gICAgLy8gaXMgZ29uZSB3aXRoIGl0LCBzbyBpdHMgZHJhZ2VuZCBtYXkgbmV2ZXIgY29tZS5cbiAgICBpZiAoY2xlYXIpIHtcbiAgICAgIHRoaXMuY29udGVudEVsLmVtcHR5KCk7XG4gICAgICB0aGlzLmRyYWdnaW5nID0gdGhpcy5wZW5kaW5nID0gZmFsc2U7XG4gICAgfVxuICAgIHRoaXMuZGF0YSA9IGRhdGE7XG4gICAgdGhpcy5kaXJ0eSA9IGZhbHNlO1xuICAgIHRoaXMuYm9hcmQgPSBwYXJzZUJvYXJkKGRhdGEpO1xuICAgIHRoaXMucmVuZGVyKCk7XG4gIH1cblxuICBjbGVhcigpOiB2b2lkIHtcbiAgICB0aGlzLmJvYXJkID0gcGFyc2VCb2FyZCgnJyk7XG4gICAgdGhpcy5kaXJ0eSA9IGZhbHNlO1xuICB9XG5cbiAgLyoqIFdyaXRlcyBvbmx5IGFmdGVyIGFuIGVkaXQgaGVyZSwgbmV2ZXIgZm9yIGEgYm9hcmQgdGhhdCBpcyBzdGlsbCBsb2FkaW5nIG9yIHdhcyBvbmx5IHZpZXdlZC4gKi9cbiAgYXN5bmMgc2F2ZShjbGVhcj86IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAodGhpcy5kaXJ0eSkgYXdhaXQgc3VwZXIuc2F2ZShjbGVhcik7XG4gIH1cblxuICAvKiogQXBwbHkgYW4gZWRpdCwgcmVkcmF3IGFuZCBzYXZlLiAqL1xuICB1cGRhdGUobmV4dDogQm9hcmQpOiB2b2lkIHtcbiAgICB0aGlzLmJvYXJkID0gbmV4dDtcbiAgICB0aGlzLmRpcnR5ID0gdHJ1ZTtcbiAgICB0aGlzLnJlbmRlcigpO1xuICAgIHZvaWQgdGhpcy5zYXZlKCk7XG4gIH1cblxuICByZW5kZXIoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuZHJhZ2dpbmcpIHtcbiAgICAgIHRoaXMucGVuZGluZyA9IHRydWU7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHJvb3QgPSB0aGlzLmNvbnRlbnRFbDtcbiAgICBjb25zdCBzY3JvbGwgPSB0aGlzLnNjcm9sbFBvc2l0aW9ucygpO1xuICAgIHJvb3QuZW1wdHkoKTtcbiAgICByb290LmFkZENsYXNzKCdoZWwtYm9hcmQtcGFnZScpO1xuICAgIGNvbnN0IGJhciA9IHVpLnRvb2xiYXIocm9vdCwgeyBsYWJlbDogJ0JvYXJkJyB9KTtcbiAgICB1aS5idXR0b24oYmFyLCB7IHRleHQ6ICdBZGQgbGlzdCcsIGljb246ICdwbHVzJywgb25DbGljazogKCkgPT4gdGhpcy5hZGRMYW5lKCkgfSk7XG4gICAgaWYgKHRoaXMuYm9hcmQuYXJjaGl2ZS5sZW5ndGgpIHtcbiAgICAgIHVpLmJ1dHRvbihiYXIsIHsgdGV4dDogYEFyY2hpdmVkIGNhcmRzICgke3RoaXMuYm9hcmQuYXJjaGl2ZS5sZW5ndGh9KWAsIGljb246ICdhcmNoaXZlJywgb25DbGljazogKCkgPT4gdGhpcy5yZXN0b3JlRnJvbUFyY2hpdmUoKSB9KTtcbiAgICB9XG4gICAgaWYgKCF0aGlzLmJvYXJkLmxhbmVzLmxlbmd0aCkge1xuICAgICAgdWkuZW1wdHlTdGF0ZShyb290LCAnTm8gbGlzdHMgeWV0LiBBZGQgYSBsaXN0IHRvIHN0YXJ0IHRoZSBib2FyZC4nKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3Qgc2hvd24gPSB0aGlzLmJvYXJkO1xuICAgIGNvbnN0IGJvYXJkID0gdWkuYm9hcmQocm9vdCwge1xuICAgICAgbGFiZWw6ICdMaXN0cycsXG4gICAgICBvbkRyYWdTdGFydDogKCkgPT4geyB0aGlzLmRyYWdnaW5nID0gdHJ1ZTsgfSxcbiAgICAgIG9uRHJhZ0VuZDogKCkgPT4gdGhpcy5lbmREcmFnKCksXG4gICAgICAvLyBUaGUgbm90ZSB3YXMgcmVhZCBhZ2FpbiBtaWQtZHJhZzogdGhlc2UgaWRzIGJlbG9uZyB0byB0aGUgYm9hcmQgdGhhdCB3YXMgcmVwbGFjZWQsIHNvIG5vdGhpbmcgaXMgd3JpdHRlbi5cbiAgICAgIG9uRHJvcDogKGlkLCBsYW5lLCBhdCkgPT4geyBpZiAodGhpcy5ib2FyZCA9PT0gc2hvd24pIHRoaXMudXBkYXRlKG9wcy5tb3ZlQ2FyZChzaG93biwgaWQsIGxhbmUsIGF0KSk7IH0sXG4gICAgfSk7XG4gICAgY29uc3QgZHJhd24gPSB0aGlzLmJvYXJkLmxhbmVzLmZsYXRNYXAoKGxhbmUsIGkpID0+IHRoaXMucmVuZGVyTGFuZShib2FyZCwgbGFuZSwgaSkpO1xuICAgIHRoaXMucmVzdG9yZVNjcm9sbChzY3JvbGwpO1xuICAgIC8vIEFnYWluIG9uY2UgdGhlIGNhcmRzIGhhdmUgdGhlaXIgdGV4dDogdW50aWwgdGhlbiBhIGxpc3QgbWF5IGJlIHRvbyBzaG9ydCB0byBzY3JvbGwgdGhhdCBmYXIuXG4gICAgdm9pZCBQcm9taXNlLmFsbFNldHRsZWQoZHJhd24pLnRoZW4oKCkgPT4ge1xuICAgICAgaWYgKGJvYXJkLmVsLnBhcmVudEVsZW1lbnQgPT09IHJvb3QpIHRoaXMucmVzdG9yZVNjcm9sbChzY3JvbGwpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqIFJldHVybnMgd2hlbiBlYWNoIGNhcmQncyBtYXJrZG93biBpcyBkcmF3bi4gKi9cbiAgcHJpdmF0ZSByZW5kZXJMYW5lKGJvYXJkOiBCb2FyZEhhbmRsZSwgbGFuZTogTGFuZSwgaW5kZXg6IG51bWJlcik6IFByb21pc2U8dm9pZD5bXSB7XG4gICAgY29uc3QgdGl0bGUgPSBsYW5lLnRpdGxlIHx8ICdVbnRpdGxlZCBsaXN0JztcbiAgICBjb25zdCB7IGhlYWQsIGxpc3QsIGNhcmQgfSA9IGJvYXJkLmxhbmUoeyBpZDogbGFuZS5pZCwgbGFiZWw6IHRpdGxlIH0pO1xuICAgIHVpLnN0YXR1c1RleHQoaGVhZCwgdGl0bGUpLmFkZEV2ZW50TGlzdGVuZXIoJ2RibGNsaWNrJywgKCkgPT4gdm9pZCB0aGlzLnJlbmFtZUxhbmUobGFuZSkpO1xuICAgIGNvbnN0IGNvdW50ID0gbGFuZS5tYXhJdGVtcyA/IGAke2xhbmUuY2FyZHMubGVuZ3RofS8ke2xhbmUubWF4SXRlbXN9YCA6IFN0cmluZyhsYW5lLmNhcmRzLmxlbmd0aCk7XG4gICAgdWkuYmFkZ2UoaGVhZCwgY291bnQsIGxhbmUubWF4SXRlbXMgJiYgbGFuZS5jYXJkcy5sZW5ndGggPiBsYW5lLm1heEl0ZW1zID8gJ2RhbmdlcicgOiBsYW5lLm1hcmtDb21wbGV0ZSA/ICdzdWNjZXNzJyA6ICdkZWZhdWx0Jyk7XG4gICAgdWkubW9yZUJ1dHRvbihoZWFkLCAoKSA9PiB0aGlzLmxhbmVNZW51KGxhbmUsIGluZGV4KSwgJ0xpc3Qgb3B0aW9ucycpLmVsLmNsYXNzTGlzdC5hZGQoJ2hlbC10b29sYmFyLWVuZCcpO1xuXG4gICAgaWYgKCFsYW5lLmNhcmRzLmxlbmd0aCkgdWkuZW1wdHlTdGF0ZShsaXN0LCAnTm8gY2FyZHMnLCB7IHZhcmlhbnQ6ICdpbmxpbmUnIH0pO1xuICAgIGNvbnN0IGRyYXduID0gbGFuZS5jYXJkcy5tYXAoKGMpID0+IHRoaXMucmVuZGVyQ2FyZChjYXJkKHsgaWQ6IGMuaWQsIHRvbmU6IGMuY2hlY2tlZCA/ICdtdXRlZCcgOiAnZGVmYXVsdCcgfSkuaGVhZCwgYywgbGFuZSkpO1xuICAgIHVpLmJ1dHRvbihsaXN0LCB7IHRleHQ6ICdBZGQgYSBjYXJkJywgaWNvbjogJ3BsdXMnLCB2YXJpYW50OiAnbGluaycsIG9uQ2xpY2s6ICgpID0+IHRoaXMuYWRkQ2FyZChsYW5lKSB9KTtcbiAgICByZXR1cm4gZHJhd247XG4gIH1cblxuICAvKiogVGhlIGRvbmUgY2hlY2tib3gsIHRoZSBjYXJkJ3MgbWFya2Rvd24gYW5kIGl0cyBtZW51LCBzaWRlIGJ5IHNpZGUgaW4gdGhlIGNhcmQncyBoZWFkIChhIHBhcnQgZm9yIHRoaXM6IEhFTEVOSVRFLTE4NSkuICovXG4gIHByaXZhdGUgcmVuZGVyQ2FyZChyb3c6IEhUTUxFbGVtZW50LCBjYXJkOiBDYXJkLCBsYW5lOiBMYW5lKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgLy8gSW4gYSBib3ggb2YgaXRzIG93biwgb3IgbG9uZyB0ZXh0IGJlc2lkZSBpdCBzcXVlZXplcyB0aGUgY2hlY2tib3guXG4gICAgY29uc3QgY2hlY2sgPSByb3cuY3JlYXRlRGl2KCkuY3JlYXRlRWwoJ2lucHV0JywgeyBjbHM6ICd0YXNrLWxpc3QtaXRlbS1jaGVja2JveCcsIHR5cGU6ICdjaGVja2JveCcgfSk7XG4gICAgY2hlY2suY2hlY2tlZCA9IGNhcmQuY2hlY2tlZDtcbiAgICBjaGVjay5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCBjYXJkLmNoZWNrZWQgPyAnTWFyayBjYXJkIGFzIG5vdCBkb25lJyA6ICdNYXJrIGNhcmQgYXMgZG9uZScpO1xuICAgIGNoZWNrLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICB0aGlzLnVwZGF0ZShvcHMudG9nZ2xlQ2FyZCh0aGlzLmJvYXJkLCBjYXJkLmlkKSk7XG4gICAgfSk7XG4gICAgY29uc3QgYm9keSA9IHJvdy5jcmVhdGVEaXYoeyBjbHM6ICdtYXJrZG93bi1yZW5kZXJlZCcgfSk7XG4gICAgY29uc3QgZHJhd24gPSBNYXJrZG93blJlbmRlcmVyLnJlbmRlcih0aGlzLmFwcCwgY2FyZC50ZXh0LCBib2R5LCB0aGlzLmZpbGU/LnBhdGggPz8gJycsIHRoaXMpLnRoZW4oKCkgPT4gdW53cmFwUGFyYWdyYXBoKGJvZHkpKTtcbiAgICBib2R5LmFkZEV2ZW50TGlzdGVuZXIoJ2RibGNsaWNrJywgKCkgPT4gdm9pZCB0aGlzLmVkaXRDYXJkKGNhcmQpKTtcbiAgICB1aS5tb3JlQnV0dG9uKHJvdywgKCkgPT4gdGhpcy5jYXJkTWVudShjYXJkLCBsYW5lKSwgJ0NhcmQgb3B0aW9ucycpO1xuICAgIHJldHVybiBkcmF3bjtcbiAgfVxuXG4gIHByaXZhdGUgZW5kRHJhZygpOiB2b2lkIHtcbiAgICB0aGlzLmRyYWdnaW5nID0gZmFsc2U7XG4gICAgaWYgKHRoaXMucGVuZGluZykge1xuICAgICAgdGhpcy5wZW5kaW5nID0gZmFsc2U7XG4gICAgICB0aGlzLnJlbmRlcigpO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBIb3cgZmFyIHRoZSByb3cgb2YgbGlzdHMgYW5kIGVhY2ggbGlzdCBhcmUgc2Nyb2xsZWQsIHNvIGFuIGVkaXQncyByZWRyYXcgbGVhdmVzIHRoZSBib2FyZCB3aGVyZSBpdCB3YXMuICovXG4gIHByaXZhdGUgc2Nyb2xsUG9zaXRpb25zKCk6IFNjcm9sbCB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHg6IHRoaXMuY29udGVudEVsLnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KCcuaGVsLWJvYXJkJyk/LnNjcm9sbExlZnQgPz8gMCxcbiAgICAgIGxpc3RzOiBBcnJheS5mcm9tKHRoaXMuY29udGVudEVsLnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KCcuaGVsLWJvYXJkLWxhbmUnKSwgKGwpID0+ICh7XG4gICAgICAgIGxhbmU6IGwuZGF0YXNldC5sYW5lLFxuICAgICAgICB0b3A6IGwucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJy5oZWwtYm9hcmQtbGlzdCcpPy5zY3JvbGxUb3AgPz8gMCxcbiAgICAgIH0pKSxcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSByZXN0b3JlU2Nyb2xsKHA6IFNjcm9sbCk6IHZvaWQge1xuICAgIGNvbnN0IHJvdyA9IHRoaXMuY29udGVudEVsLnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KCcuaGVsLWJvYXJkJyk7XG4gICAgaWYgKHJvdykgcm93LnNjcm9sbExlZnQgPSBwLng7XG4gICAgY29uc3QgbGFuZXMgPSBBcnJheS5mcm9tKHRoaXMuY29udGVudEVsLnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KCcuaGVsLWJvYXJkLWxhbmUnKSk7XG4gICAgLy8gQSBsaXN0IGtlZXBzIGl0cyBwbGFjZSB3aGVuIGxpc3RzIG1vdmUgb3IgZ28uIEFmdGVyIHRoZSBub3RlIGlzIHJlYWQgYWdhaW4gdGhlIGlkcyBhcmUgbmV3OiB0aGVuIGdvIGJ5IHBvc2l0aW9uLlxuICAgIGNvbnN0IGtlcHQgPSBsYW5lcy5zb21lKChsKSA9PiBwLmxpc3RzLnNvbWUoKHMpID0+IHMubGFuZSA9PT0gbC5kYXRhc2V0LmxhbmUpKTtcbiAgICBsYW5lcy5mb3JFYWNoKChsLCBpKSA9PiB7XG4gICAgICBjb25zdCBzYXZlZCA9IGtlcHQgPyBwLmxpc3RzLmZpbmQoKHMpID0+IHMubGFuZSA9PT0gbC5kYXRhc2V0LmxhbmUpIDogcC5saXN0c1tpXTtcbiAgICAgIGNvbnN0IGxpc3QgPSBsLnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KCcuaGVsLWJvYXJkLWxpc3QnKTtcbiAgICAgIGlmIChsaXN0ICYmIHNhdmVkPy50b3ApIGxpc3Quc2Nyb2xsVG9wID0gc2F2ZWQudG9wO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBsYW5lTWVudShsYW5lOiBMYW5lLCBpbmRleDogbnVtYmVyKTogTWVudUl0ZW1TcGVjW10ge1xuICAgIGNvbnN0IGxhc3QgPSB0aGlzLmJvYXJkLmxhbmVzLmxlbmd0aCAtIDE7XG4gICAgcmV0dXJuIFtcbiAgICAgIHsgdGl0bGU6ICdSZW5hbWUgbGlzdCcsIGljb246ICdwZW5jaWwnLCBvbkNsaWNrOiAoKSA9PiB0aGlzLnJlbmFtZUxhbmUobGFuZSkgfSxcbiAgICAgIHsgdGl0bGU6ICdBZGQgYSBjYXJkIGF0IHRoZSB0b3AnLCBpY29uOiAncGx1cycsIG9uQ2xpY2s6ICgpID0+IHRoaXMuYWRkQ2FyZChsYW5lLCAwKSB9LFxuICAgICAgeyB0aXRsZTogJ1NldCBjYXJkIGxpbWl0JywgaWNvbjogJ2hhc2gnLCBvbkNsaWNrOiAoKSA9PiB0aGlzLnNldExpbWl0KGxhbmUpIH0sXG4gICAgICB7XG4gICAgICAgIHRpdGxlOiBsYW5lLm1hcmtDb21wbGV0ZSA/ICdTdG9wIG1hcmtpbmcgY2FyZHMgYXMgZG9uZScgOiAnTWFyayBjYXJkcyBpbiB0aGlzIGxpc3QgYXMgZG9uZScsXG4gICAgICAgIGljb246ICdjaGVjay1zcXVhcmUnLFxuICAgICAgICBvbkNsaWNrOiAoKSA9PiB0aGlzLnVwZGF0ZShvcHMuc2V0TWFya0NvbXBsZXRlKHRoaXMuYm9hcmQsIGxhbmUuaWQsICFsYW5lLm1hcmtDb21wbGV0ZSkpLFxuICAgICAgfSxcbiAgICAgIHsgdGl0bGU6ICdBcmNoaXZlIGRvbmUgY2FyZHMnLCBpY29uOiAnYXJjaGl2ZScsIGRpc2FibGVkOiAhbGFuZS5jYXJkcy5zb21lKChjKSA9PiBjLmNoZWNrZWQpLCBvbkNsaWNrOiAoKSA9PiB0aGlzLnVwZGF0ZShvcHMuYXJjaGl2ZURvbmUodGhpcy5ib2FyZCwgbGFuZS5pZCkpIH0sXG4gICAgICAnc2VwYXJhdG9yJyxcbiAgICAgIHsgdGl0bGU6ICdNb3ZlIGxpc3QgbGVmdCcsIGljb246ICdhcnJvdy1sZWZ0JywgZGlzYWJsZWQ6IGluZGV4ID09PSAwLCBvbkNsaWNrOiAoKSA9PiB0aGlzLnVwZGF0ZShvcHMubW92ZUxhbmUodGhpcy5ib2FyZCwgbGFuZS5pZCwgaW5kZXggLSAxKSkgfSxcbiAgICAgIHsgdGl0bGU6ICdNb3ZlIGxpc3QgcmlnaHQnLCBpY29uOiAnYXJyb3ctcmlnaHQnLCBkaXNhYmxlZDogaW5kZXggPT09IGxhc3QsIG9uQ2xpY2s6ICgpID0+IHRoaXMudXBkYXRlKG9wcy5tb3ZlTGFuZSh0aGlzLmJvYXJkLCBsYW5lLmlkLCBpbmRleCArIDEpKSB9LFxuICAgICAgJ3NlcGFyYXRvcicsXG4gICAgICB7IHRpdGxlOiAnRGVsZXRlIGxpc3QnLCBpY29uOiAndHJhc2gtMicsIGRhbmdlcjogdHJ1ZSwgb25DbGljazogKCkgPT4gdGhpcy5kZWxldGVMYW5lKGxhbmUpIH0sXG4gICAgXTtcbiAgfVxuXG4gIHByaXZhdGUgY2FyZE1lbnUoY2FyZDogQ2FyZCwgbGFuZTogTGFuZSk6IE1lbnVJdGVtU3BlY1tdIHtcbiAgICBjb25zdCBhdCA9IGxhbmUuY2FyZHMuZmluZEluZGV4KChjKSA9PiBjLmlkID09PSBjYXJkLmlkKTtcbiAgICByZXR1cm4gW1xuICAgICAgeyB0aXRsZTogJ0VkaXQgY2FyZCcsIGljb246ICdwZW5jaWwnLCBvbkNsaWNrOiAoKSA9PiB0aGlzLmVkaXRDYXJkKGNhcmQpIH0sXG4gICAgICB7IHRpdGxlOiAnTW92ZSBjYXJkIHRvIGxpc3QnLCBpY29uOiAnYXJyb3ctcmlnaHQtbGVmdCcsIGRpc2FibGVkOiB0aGlzLmJvYXJkLmxhbmVzLmxlbmd0aCA8IDIsIG9uQ2xpY2s6ICgpID0+IHRoaXMubW92ZVRvTGFuZShjYXJkLCBsYW5lKSB9LFxuICAgICAgeyB0aXRsZTogJ01vdmUgdG8gdG9wJywgaWNvbjogJ2Fycm93LXVwLXRvLWxpbmUnLCBkaXNhYmxlZDogYXQgPT09IDAsIG9uQ2xpY2s6ICgpID0+IHRoaXMudXBkYXRlKG9wcy5tb3ZlQ2FyZCh0aGlzLmJvYXJkLCBjYXJkLmlkLCBsYW5lLmlkLCAwKSkgfSxcbiAgICAgIHsgdGl0bGU6ICdNb3ZlIHRvIGJvdHRvbScsIGljb246ICdhcnJvdy1kb3duLXRvLWxpbmUnLCBkaXNhYmxlZDogYXQgPT09IGxhbmUuY2FyZHMubGVuZ3RoIC0gMSwgb25DbGljazogKCkgPT4gdGhpcy51cGRhdGUob3BzLm1vdmVDYXJkKHRoaXMuYm9hcmQsIGNhcmQuaWQsIGxhbmUuaWQsIGxhbmUuY2FyZHMubGVuZ3RoKSkgfSxcbiAgICAgICdzZXBhcmF0b3InLFxuICAgICAgeyB0aXRsZTogJ0FyY2hpdmUgY2FyZCcsIGljb246ICdhcmNoaXZlJywgb25DbGljazogKCkgPT4gdGhpcy51cGRhdGUob3BzLmFyY2hpdmVDYXJkKHRoaXMuYm9hcmQsIGNhcmQuaWQpKSB9LFxuICAgICAgeyB0aXRsZTogJ0RlbGV0ZSBjYXJkJywgaWNvbjogJ3RyYXNoLTInLCBkYW5nZXI6IHRydWUsIG9uQ2xpY2s6ICgpID0+IHRoaXMuZGVsZXRlQ2FyZChjYXJkKSB9LFxuICAgIF07XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGFkZExhbmUoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgdGl0bGUgPSBhd2FpdCB1aS5wcm9tcHQodGhpcy5hcHAsIHsgdGl0bGU6ICdBZGQgbGlzdCcsIGxhYmVsOiAnTmFtZScsIHBsYWNlaG9sZGVyOiAnVG8gZG8nLCBhY3Rpb246ICdBZGQgbGlzdCcsIHZhbGlkYXRlOiByZXF1aXJlZCgnbmFtZScpIH0pO1xuICAgIGlmICh0aXRsZSkgdGhpcy51cGRhdGUob3BzLmFkZExhbmUodGhpcy5ib2FyZCwgdGl0bGUpKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcmVuYW1lTGFuZShsYW5lOiBMYW5lKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgdGl0bGUgPSBhd2FpdCB1aS5wcm9tcHQodGhpcy5hcHAsIHsgdGl0bGU6ICdSZW5hbWUgbGlzdCcsIGxhYmVsOiAnTmFtZScsIHZhbHVlOiBsYW5lLnRpdGxlLCBhY3Rpb246ICdSZW5hbWUnLCB2YWxpZGF0ZTogcmVxdWlyZWQoJ25hbWUnKSB9KTtcbiAgICBpZiAodGl0bGUgJiYgdGl0bGUudHJpbSgpICE9PSBsYW5lLnRpdGxlKSB0aGlzLnVwZGF0ZShvcHMucmVuYW1lTGFuZSh0aGlzLmJvYXJkLCBsYW5lLmlkLCB0aXRsZSkpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBzZXRMaW1pdChsYW5lOiBMYW5lKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgdiA9IGF3YWl0IHVpLnByb21wdCh0aGlzLmFwcCwge1xuICAgICAgdGl0bGU6ICdTZXQgY2FyZCBsaW1pdCcsXG4gICAgICBsYWJlbDogJ01vc3QgY2FyZHMgaW4gdGhpcyBsaXN0ICgwIGZvciBubyBsaW1pdCknLFxuICAgICAgdmFsdWU6IFN0cmluZyhsYW5lLm1heEl0ZW1zKSxcbiAgICAgIGFjdGlvbjogJ1NldCBsaW1pdCcsXG4gICAgICB2YWxpZGF0ZTogKHMpID0+ICgvXlxcZCskLy50ZXN0KHMudHJpbSgpKSA/IG51bGwgOiAnRW50ZXIgYSB3aG9sZSBudW1iZXIuJyksXG4gICAgfSk7XG4gICAgaWYgKHYgIT09IG51bGwpIHRoaXMudXBkYXRlKG9wcy5zZXRNYXhJdGVtcyh0aGlzLmJvYXJkLCBsYW5lLmlkLCBOdW1iZXIodi50cmltKCkpKSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGRlbGV0ZUxhbmUobGFuZTogTGFuZSk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IG4gPSBsYW5lLmNhcmRzLmxlbmd0aDtcbiAgICBjb25zdCBvayA9IGF3YWl0IHVpLmNvbmZpcm0odGhpcy5hcHAsIHtcbiAgICAgIHRpdGxlOiAnRGVsZXRlIGxpc3QnLFxuICAgICAgbWVzc2FnZTogYERlbGV0ZSAke2xhbmUudGl0bGUgfHwgJ3RoaXMgbGlzdCd9JHtuID8gYCBhbmQgaXRzICR7bn0gY2FyZCR7biA9PT0gMSA/ICcnIDogJ3MnfWAgOiAnJ30/IFRoaXMgY2Fubm90IGJlIHVuZG9uZS5gLFxuICAgICAgYWN0aW9uOiAnRGVsZXRlJyxcbiAgICAgIGRhbmdlcjogdHJ1ZSxcbiAgICB9KTtcbiAgICBpZiAob2spIHRoaXMudXBkYXRlKG9wcy5kZWxldGVMYW5lKHRoaXMuYm9hcmQsIGxhbmUuaWQpKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgYWRkQ2FyZChsYW5lOiBMYW5lLCBhdD86IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHRleHQgPSBhd2FpdCB1aS5wcm9tcHQodGhpcy5hcHAsIHsgdGl0bGU6ICdBZGQgY2FyZCcsIGxhYmVsOiAnQ2FyZCcsIHBsYWNlaG9sZGVyOiAnV2hhdCBuZWVkcyBkb2luZz8nLCBhY3Rpb246ICdBZGQgY2FyZCcsIHZhbGlkYXRlOiByZXF1aXJlZCgnY2FyZCcpIH0pO1xuICAgIGlmICh0ZXh0KSB0aGlzLnVwZGF0ZShvcHMuYWRkQ2FyZCh0aGlzLmJvYXJkLCBsYW5lLmlkLCBmcm9tUHJvbXB0KHRleHQpLCBhdCkpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBlZGl0Q2FyZChjYXJkOiBDYXJkKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgdGV4dCA9IGF3YWl0IHVpLnByb21wdCh0aGlzLmFwcCwgeyB0aXRsZTogJ0VkaXQgY2FyZCcsIGxhYmVsOiAnQ2FyZCAoPGJyPiBzdGFydHMgYSBuZXcgbGluZSknLCB2YWx1ZTogdG9Qcm9tcHQoY2FyZC50ZXh0KSwgYWN0aW9uOiAnU2F2ZScsIHZhbGlkYXRlOiByZXF1aXJlZCgnY2FyZCcpIH0pO1xuICAgIGlmICh0ZXh0ICE9PSBudWxsICYmIGZyb21Qcm9tcHQodGV4dCkudHJpbSgpICE9PSBjYXJkLnRleHQpIHRoaXMudXBkYXRlKG9wcy5lZGl0Q2FyZCh0aGlzLmJvYXJkLCBjYXJkLmlkLCBmcm9tUHJvbXB0KHRleHQpKSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGRlbGV0ZUNhcmQoY2FyZDogQ2FyZCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IG9rID0gYXdhaXQgdWkuY29uZmlybSh0aGlzLmFwcCwgeyB0aXRsZTogJ0RlbGV0ZSBjYXJkJywgbWVzc2FnZTogYERlbGV0ZSBcIiR7Zmlyc3RMaW5lKGNhcmQudGV4dCl9XCI/IFRoaXMgY2Fubm90IGJlIHVuZG9uZS5gLCBhY3Rpb246ICdEZWxldGUnLCBkYW5nZXI6IHRydWUgfSk7XG4gICAgaWYgKG9rKSB0aGlzLnVwZGF0ZShvcHMuZGVsZXRlQ2FyZCh0aGlzLmJvYXJkLCBjYXJkLmlkKSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIG1vdmVUb0xhbmUoY2FyZDogQ2FyZCwgZnJvbTogTGFuZSk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLmJvYXJkLmxhbmVzLm1hcCgobCkgPT4gKHsgdmFsdWU6IGwuaWQsIHRleHQ6IGwudGl0bGUgfHwgJ1VudGl0bGVkIGxpc3QnLCBkaXNhYmxlZDogbC5pZCA9PT0gZnJvbS5pZCB9KSk7XG4gICAgY29uc3QgdG8gPSBhd2FpdCB1aS5jaG9vc2UodGhpcy5hcHAsIHsgdGl0bGU6ICdNb3ZlIGNhcmQgdG8gbGlzdCcsIG9wdGlvbnMgfSk7XG4gICAgaWYgKHRvKSB0aGlzLnVwZGF0ZShvcHMubW92ZUNhcmQodGhpcy5ib2FyZCwgY2FyZC5pZCwgdG8sIE51bWJlci5NQVhfU0FGRV9JTlRFR0VSKSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHJlc3RvcmVGcm9tQXJjaGl2ZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBmaXJzdCA9IHRoaXMuYm9hcmQubGFuZXNbMF07XG4gICAgaWYgKCFmaXJzdCkge1xuICAgICAgdWkubm90aWNlKCdBZGQgYSBsaXN0IGZpcnN0LCB0aGVuIHJlc3RvcmUgY2FyZHMgaW50byBpdC4nKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgaWQgPSBhd2FpdCB1aS5jaG9vc2UodGhpcy5hcHAsIHtcbiAgICAgIHRpdGxlOiBgUmVzdG9yZSBhIGNhcmQgdG8gJHtmaXJzdC50aXRsZSB8fCAndGhlIGZpcnN0IGxpc3QnfWAsXG4gICAgICBvcHRpb25zOiB0aGlzLmJvYXJkLmFyY2hpdmUubWFwKChjKSA9PiAoeyB2YWx1ZTogYy5pZCwgdGV4dDogZmlyc3RMaW5lKGMudGV4dCkgfSkpLFxuICAgIH0pO1xuICAgIGlmICghaWQpIHJldHVybjtcbiAgICB0aGlzLnVwZGF0ZShvcHMucmVzdG9yZUNhcmQodGhpcy5ib2FyZCwgaWQsIGZpcnN0LmlkKSk7XG4gICAgdWkubm90aWNlKCdDYXJkIHJlc3RvcmVkJywgeyBraW5kOiAnc3VjY2VzcycgfSk7XG4gIH1cbn1cbiIsICIvLyBCb2FyZCBlZGl0cy4gRWFjaCB0YWtlcyBhIGJvYXJkIGFuZCByZXR1cm5zIGEgbmV3IG9uZTsgdGhlIGlucHV0IGlzIGxlZnQgYXMgaXQgd2FzLiBQdXJlLCBzbyB0aGUgdmlldyBzdGF5cyB0aGluLlxuaW1wb3J0IHsgbmV3SWQsIHR5cGUgQm9hcmQsIHR5cGUgQ2FyZCwgdHlwZSBMYW5lIH0gZnJvbSAnLi9ib2FyZCc7XG5cbmNvbnN0IGNsb25lID0gKGI6IEJvYXJkKTogQm9hcmQgPT4gc3RydWN0dXJlZENsb25lKGIpO1xuXG5mdW5jdGlvbiBmaW5kQ2FyZChiOiBCb2FyZCwgY2FyZElkOiBzdHJpbmcpOiB7IGxpc3Q6IENhcmRbXTsgaW5kZXg6IG51bWJlcjsgbGFuZTogTGFuZSB8IG51bGwgfSB8IG51bGwge1xuICBmb3IgKGNvbnN0IGxhbmUgb2YgYi5sYW5lcykge1xuICAgIGNvbnN0IGluZGV4ID0gbGFuZS5jYXJkcy5maW5kSW5kZXgoKGMpID0+IGMuaWQgPT09IGNhcmRJZCk7XG4gICAgaWYgKGluZGV4ID49IDApIHJldHVybiB7IGxpc3Q6IGxhbmUuY2FyZHMsIGluZGV4LCBsYW5lIH07XG4gIH1cbiAgY29uc3QgaW5kZXggPSBiLmFyY2hpdmUuZmluZEluZGV4KChjKSA9PiBjLmlkID09PSBjYXJkSWQpO1xuICByZXR1cm4gaW5kZXggPj0gMCA/IHsgbGlzdDogYi5hcmNoaXZlLCBpbmRleCwgbGFuZTogbnVsbCB9IDogbnVsbDtcbn1cblxuY29uc3QgbGFuZUluZGV4ID0gKGI6IEJvYXJkLCBsYW5lSWQ6IHN0cmluZyk6IG51bWJlciA9PiBiLmxhbmVzLmZpbmRJbmRleCgobCkgPT4gbC5pZCA9PT0gbGFuZUlkKTtcbmNvbnN0IGNsYW1wID0gKG46IG51bWJlciwgbG86IG51bWJlciwgaGk6IG51bWJlcik6IG51bWJlciA9PiBNYXRoLm1heChsbywgTWF0aC5taW4oaGksIG4pKTtcblxuZnVuY3Rpb24gc2V0RG9uZShjYXJkOiBDYXJkLCBkb25lOiBib29sZWFuKTogdm9pZCB7XG4gIGNhcmQuY2hlY2tlZCA9IGRvbmU7XG4gIGNhcmQuY2hlY2tDaGFyID0gZG9uZSA/IChjYXJkLmNoZWNrQ2hhciAhPT0gJyAnID8gY2FyZC5jaGVja0NoYXIgOiAneCcpIDogJyAnO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYWRkTGFuZShib2FyZDogQm9hcmQsIHRpdGxlOiBzdHJpbmcsIGF0ID0gYm9hcmQubGFuZXMubGVuZ3RoKTogQm9hcmQge1xuICBjb25zdCBiID0gY2xvbmUoYm9hcmQpO1xuICBiLmxhbmVzLnNwbGljZShjbGFtcChhdCwgMCwgYi5sYW5lcy5sZW5ndGgpLCAwLCB7IGlkOiBuZXdJZCgnbCcpLCB0aXRsZTogdGl0bGUudHJpbSgpLCBtYXhJdGVtczogMCwgbWFya0NvbXBsZXRlOiBmYWxzZSwgY2FyZHM6IFtdIH0pO1xuICByZXR1cm4gYjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlbmFtZUxhbmUoYm9hcmQ6IEJvYXJkLCBsYW5lSWQ6IHN0cmluZywgdGl0bGU6IHN0cmluZyk6IEJvYXJkIHtcbiAgY29uc3QgYiA9IGNsb25lKGJvYXJkKTtcbiAgY29uc3QgbGFuZSA9IGIubGFuZXNbbGFuZUluZGV4KGIsIGxhbmVJZCldO1xuICBpZiAobGFuZSkgbGFuZS50aXRsZSA9IHRpdGxlLnRyaW0oKTtcbiAgcmV0dXJuIGI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWxldGVMYW5lKGJvYXJkOiBCb2FyZCwgbGFuZUlkOiBzdHJpbmcpOiBCb2FyZCB7XG4gIGNvbnN0IGIgPSBjbG9uZShib2FyZCk7XG4gIGIubGFuZXMgPSBiLmxhbmVzLmZpbHRlcigobCkgPT4gbC5pZCAhPT0gbGFuZUlkKTtcbiAgcmV0dXJuIGI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtb3ZlTGFuZShib2FyZDogQm9hcmQsIGxhbmVJZDogc3RyaW5nLCB0bzogbnVtYmVyKTogQm9hcmQge1xuICBjb25zdCBiID0gY2xvbmUoYm9hcmQpO1xuICBjb25zdCBmcm9tID0gbGFuZUluZGV4KGIsIGxhbmVJZCk7XG4gIGlmIChmcm9tIDwgMCkgcmV0dXJuIGI7XG4gIGNvbnN0IFtsYW5lXSA9IGIubGFuZXMuc3BsaWNlKGZyb20sIDEpO1xuICBiLmxhbmVzLnNwbGljZShjbGFtcCh0bywgMCwgYi5sYW5lcy5sZW5ndGgpLCAwLCBsYW5lKTtcbiAgcmV0dXJuIGI7XG59XG5cbi8qKiBUdXJuIFwiTWFyayBjYXJkcyBpbiB0aGlzIGxpc3QgYXMgY29tcGxldGVcIiBvbiBvciBvZmYuIFR1cm5pbmcgaXQgb24gY2hlY2tzIG9mZiB0aGUgY2FyZHMgYWxyZWFkeSB0aGVyZS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzZXRNYXJrQ29tcGxldGUoYm9hcmQ6IEJvYXJkLCBsYW5lSWQ6IHN0cmluZywgb246IGJvb2xlYW4pOiBCb2FyZCB7XG4gIGNvbnN0IGIgPSBjbG9uZShib2FyZCk7XG4gIGNvbnN0IGxhbmUgPSBiLmxhbmVzW2xhbmVJbmRleChiLCBsYW5lSWQpXTtcbiAgaWYgKCFsYW5lKSByZXR1cm4gYjtcbiAgbGFuZS5tYXJrQ29tcGxldGUgPSBvbjtcbiAgaWYgKG9uKSBsYW5lLmNhcmRzLmZvckVhY2goKGMpID0+IHNldERvbmUoYywgdHJ1ZSkpO1xuICByZXR1cm4gYjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNldE1heEl0ZW1zKGJvYXJkOiBCb2FyZCwgbGFuZUlkOiBzdHJpbmcsIG1heDogbnVtYmVyKTogQm9hcmQge1xuICBjb25zdCBiID0gY2xvbmUoYm9hcmQpO1xuICBjb25zdCBsYW5lID0gYi5sYW5lc1tsYW5lSW5kZXgoYiwgbGFuZUlkKV07XG4gIGlmIChsYW5lKSBsYW5lLm1heEl0ZW1zID0gTWF0aC5tYXgoMCwgTWF0aC5mbG9vcihtYXgpIHx8IDApO1xuICByZXR1cm4gYjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFkZENhcmQoYm9hcmQ6IEJvYXJkLCBsYW5lSWQ6IHN0cmluZywgdGV4dDogc3RyaW5nLCBhdD86IG51bWJlcik6IEJvYXJkIHtcbiAgY29uc3QgYiA9IGNsb25lKGJvYXJkKTtcbiAgY29uc3QgbGFuZSA9IGIubGFuZXNbbGFuZUluZGV4KGIsIGxhbmVJZCldO1xuICBpZiAoIWxhbmUpIHJldHVybiBiO1xuICBjb25zdCBjYXJkOiBDYXJkID0geyBpZDogbmV3SWQoJ2MnKSwgdGV4dDogdGV4dC50cmltKCksIGNoZWNrZWQ6IGZhbHNlLCBjaGVja0NoYXI6ICcgJyB9O1xuICBpZiAobGFuZS5tYXJrQ29tcGxldGUpIHNldERvbmUoY2FyZCwgdHJ1ZSk7XG4gIGxhbmUuY2FyZHMuc3BsaWNlKGNsYW1wKGF0ID8/IGxhbmUuY2FyZHMubGVuZ3RoLCAwLCBsYW5lLmNhcmRzLmxlbmd0aCksIDAsIGNhcmQpO1xuICByZXR1cm4gYjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVkaXRDYXJkKGJvYXJkOiBCb2FyZCwgY2FyZElkOiBzdHJpbmcsIHRleHQ6IHN0cmluZyk6IEJvYXJkIHtcbiAgY29uc3QgYiA9IGNsb25lKGJvYXJkKTtcbiAgY29uc3QgaGl0ID0gZmluZENhcmQoYiwgY2FyZElkKTtcbiAgaWYgKGhpdCkgaGl0Lmxpc3RbaGl0LmluZGV4XS50ZXh0ID0gdGV4dC50cmltKCk7XG4gIHJldHVybiBiO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVsZXRlQ2FyZChib2FyZDogQm9hcmQsIGNhcmRJZDogc3RyaW5nKTogQm9hcmQge1xuICBjb25zdCBiID0gY2xvbmUoYm9hcmQpO1xuICBjb25zdCBoaXQgPSBmaW5kQ2FyZChiLCBjYXJkSWQpO1xuICBpZiAoaGl0KSBoaXQubGlzdC5zcGxpY2UoaGl0LmluZGV4LCAxKTtcbiAgcmV0dXJuIGI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0b2dnbGVDYXJkKGJvYXJkOiBCb2FyZCwgY2FyZElkOiBzdHJpbmcpOiBCb2FyZCB7XG4gIGNvbnN0IGIgPSBjbG9uZShib2FyZCk7XG4gIGNvbnN0IGhpdCA9IGZpbmRDYXJkKGIsIGNhcmRJZCk7XG4gIGlmIChoaXQpIHtcbiAgICBjb25zdCBjYXJkID0gaGl0Lmxpc3RbaGl0LmluZGV4XTtcbiAgICBzZXREb25lKGNhcmQsICFjYXJkLmNoZWNrZWQpO1xuICB9XG4gIHJldHVybiBiO1xufVxuXG4vKiogTW92ZSBhIGNhcmQgYmVmb3JlIHRoZSBgdG9gdGggY2FyZCBvZiBhIGxhbmUsIG5vdCBjb3VudGluZyB0aGUgY2FyZCBpdHNlbGYuIEludG8gYSBcImNvbXBsZXRlXCIgbGFuZSBjaGVja3MgaXQgb2ZmOyBvdXQgb2Ygb25lIHJlb3BlbnMgaXQuICovXG5leHBvcnQgZnVuY3Rpb24gbW92ZUNhcmQoYm9hcmQ6IEJvYXJkLCBjYXJkSWQ6IHN0cmluZywgdG9MYW5lSWQ6IHN0cmluZywgdG86IG51bWJlcik6IEJvYXJkIHtcbiAgY29uc3QgYiA9IGNsb25lKGJvYXJkKTtcbiAgY29uc3QgaGl0ID0gZmluZENhcmQoYiwgY2FyZElkKTtcbiAgY29uc3QgZGVzdCA9IGIubGFuZXNbbGFuZUluZGV4KGIsIHRvTGFuZUlkKV07XG4gIGlmICghaGl0IHx8ICFkZXN0KSByZXR1cm4gYjtcbiAgY29uc3QgW2NhcmRdID0gaGl0Lmxpc3Quc3BsaWNlKGhpdC5pbmRleCwgMSk7XG4gIGNvbnN0IHNhbWUgPSBoaXQubGlzdCA9PT0gZGVzdC5jYXJkcztcbiAgaWYgKGRlc3QubWFya0NvbXBsZXRlKSBzZXREb25lKGNhcmQsIHRydWUpO1xuICBlbHNlIGlmIChoaXQubGFuZT8ubWFya0NvbXBsZXRlICYmICFzYW1lKSBzZXREb25lKGNhcmQsIGZhbHNlKTtcbiAgZGVzdC5jYXJkcy5zcGxpY2UoY2xhbXAodG8sIDAsIGRlc3QuY2FyZHMubGVuZ3RoKSwgMCwgY2FyZCk7XG4gIHJldHVybiBiO1xufVxuXG4vKiogTW92ZSBhIGNhcmQgdG8gdGhlIGFyY2hpdmUgc2VjdGlvbiAodGhlIGVuZCBvZiB0aGUgbm90ZSwgdW5kZXIgYCoqKmAgYW5kIGAjIyBBcmNoaXZlYCkuICovXG5leHBvcnQgZnVuY3Rpb24gYXJjaGl2ZUNhcmQoYm9hcmQ6IEJvYXJkLCBjYXJkSWQ6IHN0cmluZyk6IEJvYXJkIHtcbiAgY29uc3QgYiA9IGNsb25lKGJvYXJkKTtcbiAgY29uc3QgaGl0ID0gZmluZENhcmQoYiwgY2FyZElkKTtcbiAgaWYgKCFoaXQgfHwgIWhpdC5sYW5lKSByZXR1cm4gYjtcbiAgY29uc3QgW2NhcmRdID0gaGl0Lmxpc3Quc3BsaWNlKGhpdC5pbmRleCwgMSk7XG4gIGIuYXJjaGl2ZS5wdXNoKGNhcmQpO1xuICByZXR1cm4gYjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlc3RvcmVDYXJkKGJvYXJkOiBCb2FyZCwgY2FyZElkOiBzdHJpbmcsIGxhbmVJZDogc3RyaW5nKTogQm9hcmQge1xuICBjb25zdCBiID0gY2xvbmUoYm9hcmQpO1xuICBjb25zdCBpbmRleCA9IGIuYXJjaGl2ZS5maW5kSW5kZXgoKGMpID0+IGMuaWQgPT09IGNhcmRJZCk7XG4gIGNvbnN0IGxhbmUgPSBiLmxhbmVzW2xhbmVJbmRleChiLCBsYW5lSWQpXTtcbiAgaWYgKGluZGV4IDwgMCB8fCAhbGFuZSkgcmV0dXJuIGI7XG4gIGNvbnN0IFtjYXJkXSA9IGIuYXJjaGl2ZS5zcGxpY2UoaW5kZXgsIDEpO1xuICBpZiAobGFuZS5tYXJrQ29tcGxldGUpIHNldERvbmUoY2FyZCwgdHJ1ZSk7XG4gIGxhbmUuY2FyZHMucHVzaChjYXJkKTtcbiAgcmV0dXJuIGI7XG59XG5cbi8qKiBBcmNoaXZlIGV2ZXJ5IGNoZWNrZWQgY2FyZCBpbiBhIGxhbmUuICovXG5leHBvcnQgZnVuY3Rpb24gYXJjaGl2ZURvbmUoYm9hcmQ6IEJvYXJkLCBsYW5lSWQ6IHN0cmluZyk6IEJvYXJkIHtcbiAgY29uc3QgYiA9IGNsb25lKGJvYXJkKTtcbiAgY29uc3QgbGFuZSA9IGIubGFuZXNbbGFuZUluZGV4KGIsIGxhbmVJZCldO1xuICBpZiAoIWxhbmUpIHJldHVybiBiO1xuICBiLmFyY2hpdmUucHVzaCguLi5sYW5lLmNhcmRzLmZpbHRlcigoYykgPT4gYy5jaGVja2VkKSk7XG4gIGxhbmUuY2FyZHMgPSBsYW5lLmNhcmRzLmZpbHRlcigoYykgPT4gIWMuY2hlY2tlZCk7XG4gIHJldHVybiBiO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBRUEsSUFBQUEsbUJBQXlFO0FBQ3pFLElBQUFDLG1CQUFtQjs7O0FDZ0NaLElBQU0sa0JBQWtCO0FBcUMvQixJQUFJLFNBQVM7QUFDTixJQUFNLFFBQVEsQ0FBQyxXQUEyQixHQUFHLE1BQU0sR0FBRyxFQUFFLE1BQU07QUFFckUsSUFBTSxjQUFjO0FBQ3BCLElBQU0sa0JBQWtCO0FBQ3hCLElBQU0sVUFBVTtBQUNoQixJQUFNLGlCQUFpQjtBQUN2QixJQUFNLFlBQVk7QUFDbEIsSUFBTSxPQUFPO0FBQ2IsSUFBTSxXQUFXO0FBQ2pCLElBQU0sV0FBVztBQUNqQixJQUFNLGdCQUFnQjtBQUN0QixJQUFNLGdCQUFnQjtBQUdmLFNBQVMsZ0JBQWdCLElBQXFCO0FBQ25ELFFBQU0sS0FBSyxZQUFZLEtBQUssRUFBRTtBQUM5QixTQUFPLENBQUMsQ0FBQyxNQUFNLFVBQVUsR0FBRyxDQUFDLENBQUMsTUFBTTtBQUN0QztBQUdPLFNBQVMsbUJBQW1CLElBQXlEO0FBQzFGLFFBQU0sSUFBSSxLQUFLLGVBQWU7QUFDOUIsU0FBTyxNQUFNLFdBQVcsTUFBTTtBQUNoQztBQUVBLFNBQVMsVUFBVSxNQUE2QjtBQUM5QyxRQUFNLElBQUksNkRBQTZELEtBQUssSUFBSTtBQUNoRixTQUFPLElBQUksRUFBRSxDQUFDLElBQUk7QUFDcEI7QUFHTyxTQUFTLGVBQWUsS0FBa0Q7QUFDL0UsUUFBTSxNQUFNLElBQUksUUFBUSxTQUFTLElBQUksRUFBRSxLQUFLO0FBQzVDLFFBQU0sSUFBSSxzQkFBc0IsS0FBSyxHQUFHO0FBQ3hDLFNBQU8sSUFBSSxFQUFFLE9B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QUFNO0FBQzFCLFFBQUksT0FBUSxNQUFLLFdBQVcsT0FBTyxJQUFJO0FBRXZDLFVBQU0sUUFBUSxLQUFLLElBQUksY0FBYyxhQUFhLElBQUksSUFBSSxLQUFLLFFBQVEsSUFBSSxJQUFJLGdCQUFnQixNQUFNLEtBQUssSUFBSSxNQUFNLFdBQVcsSUFBSSxDQUFDO0FBQ3BJLFFBQUksTUFBTyxPQUFNLEtBQUssWUFBWSxNQUFNLElBQUk7QUFBQSxFQUM5QztBQUFBLEVBRUEsTUFBTSxZQUFZLE1BQXFCLE1BQTRCO0FBQ2pFLFNBQUssV0FBVyxPQUFPLElBQUk7QUFDM0IsVUFBTSxLQUFLLGFBQWEsRUFBRSxNQUFNLFdBQVcsT0FBTyxFQUFFLE1BQU0sS0FBSyxLQUFLLEdBQUcsUUFBUSxLQUFLLENBQVE7QUFBQSxFQUM5RjtBQUFBLEVBRUEsZUFBZSxNQUEyQjtBQUN4QyxVQUFNLE9BQVEsS0FBSyxLQUFvQjtBQUN2QyxRQUFJLENBQUMsS0FBTTtBQUNYLFNBQUssV0FBVyxJQUFJLE1BQU0sS0FBSyxJQUFJO0FBQ25DLFNBQUssS0FBSyxhQUFhLEVBQUUsTUFBTSxZQUFZLE9BQU8sRUFBRSxNQUFNLEtBQUssS0FBSyxHQUFHLFFBQVEsS0FBSyxDQUFRO0FBQUEsRUFDOUY7QUFBQTtBQUFBLEVBR0EsTUFBTSxZQUFZLFFBQWlDO0FBQ2pELFVBQU0sU0FBUyxVQUFVLEtBQUssSUFBSSxZQUFZLGlCQUFpQixLQUFLLElBQUksVUFBVSxjQUFjLEdBQUcsUUFBUSxFQUFFO0FBQzdHLFVBQU0sTUFBTSxVQUFVLENBQUMsT0FBTyxPQUFPLElBQUksR0FBRyxPQUFPLElBQUksTUFBTTtBQUM3RCxRQUFJLE9BQU8sR0FBRyxHQUFHO0FBQ2pCLGFBQVMsSUFBSSxHQUFHLEtBQUssSUFBSSxNQUFNLHNCQUFzQixJQUFJLEdBQUcsSUFBSyxRQUFPLEdBQUcsR0FBRyxtQkFBbUIsQ0FBQztBQUNsRyxRQUFJO0FBQ0YsWUFBTSxPQUFPLE1BQU0sS0FBSyxJQUFJLE1BQU0sT0FBTyxNQUFNLGlCQUFpQixDQUFDO0FBQ2pFLFlBQU0sS0FBSyxZQUFZLEtBQUssSUFBSSxVQUFVLFFBQVEsS0FBSyxHQUFHLElBQUk7QUFBQSxJQUNoRSxTQUFTLEdBQUc7QUFDViwwQkFBRyxPQUFPLCtCQUErQixhQUFhLFFBQVEsRUFBRSxVQUFVLE9BQU8sQ0FBQyxDQUFDLElBQUksRUFBRSxNQUFNLFFBQVEsQ0FBQztBQUFBLElBQzFHO0FBQUEsRUFDRjtBQUNGOyIsCiAgIm5hbWVzIjogWyJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X2hlbGVuaXRlIiwgImluZGV4Il0KfQo=
