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

// catalog/plugins/helenite-kanban/src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => KanbanPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian2 = require("obsidian");
var import_helenite2 = require("helenite");

// catalog/plugins/helenite-kanban/src/board.ts
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

// catalog/plugins/helenite-kanban/src/view.ts
var import_obsidian = require("obsidian");
var import_helenite = require("helenite");

// catalog/plugins/helenite-kanban/src/ops.ts
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
  const index = same && to > hit.index ? to - 1 : to;
  if (dest.markComplete) setDone(card, true);
  else if (hit.lane?.markComplete && !same) setDone(card, false);
  dest.cards.splice(clamp(index, 0, dest.cards.length), 0, card);
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

// catalog/plugins/helenite-kanban/src/view.ts
var VIEW_TYPE = "helenite-kanban";
var toPrompt = (text) => text.replace(/\r?\n/g, "<br>");
var fromPrompt = (text) => text.replace(/<br>/g, "\n");
var firstLine = (text) => text.split("\n")[0] || "(empty card)";
var required = (what) => (v) => v.trim() ? null : `Enter a ${what}.`;
var KanbanView = class extends import_obsidian.TextFileView {
  constructor(leaf, host) {
    super(leaf);
    this.host = host;
  }
  host;
  board = parseBoard("");
  /** Only an edit made here rewrites the note; just viewing a hand-written board leaves its layout alone. */
  dirty = false;
  dragId = null;
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
  setViewData(data, _clear) {
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
    const root = this.contentEl;
    root.empty();
    root.addClass("helenite-kanban-view");
    const bar = root.createDiv({ cls: "helenite-kanban-toolbar" });
    import_helenite.ui.button(bar, { text: "Add list", icon: "plus", onClick: () => this.addLane() });
    if (this.board.archive.length) {
      import_helenite.ui.button(bar, { text: `Archived cards (${this.board.archive.length})`, icon: "archive", onClick: () => this.restoreFromArchive() });
    }
    const lanes = root.createDiv({ cls: "helenite-kanban-lanes" });
    if (!this.board.lanes.length) {
      import_helenite.ui.emptyState(lanes, "No lists yet. Add a list to start the board.");
      return;
    }
    this.board.lanes.forEach((lane, i) => this.renderLane(lanes, lane, i));
  }
  renderLane(parent, lane, index) {
    const el = parent.createDiv({ cls: "helenite-kanban-lane" });
    el.dataset.laneId = lane.id;
    const head = el.createDiv({ cls: "helenite-kanban-lane-header" });
    const title = head.createDiv({ cls: "helenite-kanban-lane-title", text: lane.title || "Untitled list" });
    title.setAttribute("role", "button");
    title.tabIndex = 0;
    title.addEventListener("click", () => void this.renameLane(lane));
    const count = lane.maxItems ? `${lane.cards.length}/${lane.maxItems}` : String(lane.cards.length);
    import_helenite.ui.badge(head, count, lane.maxItems && lane.cards.length > lane.maxItems ? "danger" : lane.markComplete ? "success" : "default");
    import_helenite.ui.moreButton(head, () => this.laneMenu(lane, index), "List options");
    const cards = el.createDiv({ cls: "helenite-kanban-cards" });
    this.wireDrop(cards, lane);
    if (!lane.cards.length) cards.createDiv({ cls: "helenite-kanban-placeholder", text: "No cards" });
    for (const card of lane.cards) this.renderCard(cards, card, lane);
    import_helenite.ui.button(el, { text: "Add a card", icon: "plus", variant: "link", onClick: () => this.addCard(lane) });
  }
  renderCard(parent, card, lane) {
    const el = parent.createDiv({ cls: "helenite-kanban-card" });
    el.toggleClass("is-done", card.checked);
    el.dataset.cardId = card.id;
    el.draggable = true;
    el.addEventListener("dragstart", (e) => {
      this.dragId = card.id;
      e.dataTransfer?.setData("text/plain", card.id);
      el.addClass("is-dragging");
    });
    el.addEventListener("dragend", () => {
      this.dragId = null;
      el.removeClass("is-dragging");
    });
    const check = el.createEl("input", { cls: "task-list-item-checkbox helenite-kanban-check", type: "checkbox" });
    check.checked = card.checked;
    check.setAttribute("aria-label", card.checked ? "Mark card as not done" : "Mark card as done");
    check.addEventListener("click", (e) => {
      e.stopPropagation();
      this.update(toggleCard(this.board, card.id));
    });
    const body = el.createDiv({ cls: "helenite-kanban-card-text" });
    void import_obsidian.MarkdownRenderer.render(this.app, card.text, body, this.file?.path ?? "", this);
    body.addEventListener("dblclick", () => void this.editCard(card));
    import_helenite.ui.moreButton(el, () => this.cardMenu(card, lane), "Card options");
  }
  /** Cards can be dropped anywhere in a lane; the drop position is the first card whose middle is below the pointer. */
  wireDrop(cards, lane) {
    cards.addEventListener("dragover", (e) => {
      if (!this.dragId) return;
      e.preventDefault();
      cards.addClass("is-drop-target");
    });
    cards.addEventListener("dragleave", () => cards.removeClass("is-drop-target"));
    cards.addEventListener("drop", (e) => {
      cards.removeClass("is-drop-target");
      const id = this.dragId ?? e.dataTransfer?.getData("text/plain");
      if (!id) return;
      e.preventDefault();
      const items = Array.from(cards.querySelectorAll(".helenite-kanban-card"));
      let to = items.findIndex((c) => {
        const r = c.getBoundingClientRect();
        return e.clientY < r.top + r.height / 2;
      });
      if (to < 0) to = items.length;
      this.update(moveCard(this.board, id, lane.id, to));
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

// catalog/plugins/helenite-kanban/src/main.ts
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL21haW4udHMiLCAiLi4vc3JjL2JvYXJkLnRzIiwgIi4uL3NyYy92aWV3LnRzIiwgIi4uL3NyYy9vcHMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8vIEthbmJhbjogZmlyc3QtcGFydHkgSGVsZW5pdGUgcG9ydCBvZiB0aGUgT2JzaWRpYW4gS2FuYmFuIHBsdWdpbiAob2JzaWRpYW4ta2FuYmFuKS4gQm9hcmQgbm90ZXMgYXJlIHBsYWluIG1hcmtkb3duIGluXG4vLyB0aGF0IHBsdWdpbidzIGZvcm1hdCAoc2VlIGJvYXJkLnRzKSwgc28gdGhlIHNhbWUgZmlsZXMgd29yayBpbiBib3RoIGFwcHMuXG5pbXBvcnQgeyBNYXJrZG93blZpZXcsIFBsdWdpbiwgVEZpbGUsIFRGb2xkZXIsIHR5cGUgV29ya3NwYWNlTGVhZiB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IHVpIH0gZnJvbSAnaGVsZW5pdGUnO1xuaW1wb3J0IHsgaXNCb2FyZEZyb250bWF0dGVyLCBpc0JvYXJkTWFya2Rvd24sIG5ld0JvYXJkTWFya2Rvd24gfSBmcm9tICcuL2JvYXJkJztcbmltcG9ydCB7IEthbmJhblZpZXcsIFZJRVdfVFlQRSwgdHlwZSBLYW5iYW5Ib3N0IH0gZnJvbSAnLi92aWV3JztcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgS2FuYmFuUGx1Z2luIGV4dGVuZHMgUGx1Z2luIGltcGxlbWVudHMgS2FuYmFuSG9zdCB7XG4gIC8qKiBMZWF2ZXMgdGhlIHVzZXIgc3dpdGNoZWQgdG8gbWFya2Rvd24sIHdpdGggdGhlIG5vdGUgdGhleSBkaWQgaXQgZm9yLiBUaGV5IHN0YXkgbWFya2Rvd24gdW50aWwgdGhlIG5vdGUgY2hhbmdlcy4gKi9cbiAgcHJpdmF0ZSBhc01hcmtkb3duID0gbmV3IFdlYWtNYXA8V29ya3NwYWNlTGVhZiwgc3RyaW5nPigpO1xuXG4gIGFzeW5jIG9ubG9hZCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLnJlZ2lzdGVyVmlldyhWSUVXX1RZUEUsIChsZWFmOiBXb3Jrc3BhY2VMZWFmKSA9PiBuZXcgS2FuYmFuVmlldyhsZWFmLCB0aGlzKSk7XG4gICAgdGhpcy5hZGRSaWJib25JY29uKCdzcXVhcmUta2FuYmFuJywgJ05ldyBib2FyZCcsICgpID0+IHZvaWQgdGhpcy5jcmVhdGVCb2FyZCgpKTtcbiAgICB0aGlzLmFkZENvbW1hbmQoeyBpZDogJ2NyZWF0ZS1ib2FyZCcsIG5hbWU6ICdOZXcgYm9hcmQnLCBjYWxsYmFjazogKCkgPT4gdm9pZCB0aGlzLmNyZWF0ZUJvYXJkKCkgfSk7XG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiAndG9nZ2xlLXZpZXcnLFxuICAgICAgbmFtZTogJ1N3aXRjaCBiZXR3ZWVuIGJvYXJkIGFuZCBtYXJrZG93bicsXG4gICAgICBjaGVja0NhbGxiYWNrOiAoY2hlY2tpbmc6IGJvb2xlYW4pID0+IHtcbiAgICAgICAgY29uc3QgbGVhZiA9IHRoaXMuYXBwLndvcmtzcGFjZS5hY3RpdmVMZWFmID8/IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRNb3N0UmVjZW50TGVhZigpO1xuICAgICAgICBjb25zdCB2aWV3ID0gbGVhZj8udmlldztcbiAgICAgICAgaWYgKHZpZXcgaW5zdGFuY2VvZiBLYW5iYW5WaWV3KSB7XG4gICAgICAgICAgaWYgKCFjaGVja2luZykgdGhpcy5vcGVuQXNNYXJrZG93bihsZWFmISk7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHZpZXcgaW5zdGFuY2VvZiBNYXJrZG93blZpZXcgJiYgdmlldy5maWxlICYmIHRoaXMuaXNCb2FyZCh2aWV3LmZpbGUpKSB7XG4gICAgICAgICAgaWYgKCFjaGVja2luZykgdm9pZCB0aGlzLm9wZW5Bc0JvYXJkKGxlYWYhLCB2aWV3LmZpbGUpO1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KFxuICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9uKCdmaWxlLW1lbnUnLCAobWVudTogYW55LCBmaWxlOiBhbnksIF9zb3VyY2U6IHN0cmluZywgbGVhZj86IFdvcmtzcGFjZUxlYWYpID0+IHtcbiAgICAgICAgaWYgKGZpbGUgaW5zdGFuY2VvZiBURm9sZGVyKSB7XG4gICAgICAgICAgbWVudS5hZGRJdGVtKChpOiBhbnkpID0+IGkuc2V0VGl0bGUoJ05ldyBib2FyZCcpLnNldEljb24oJ3NxdWFyZS1rYW5iYW4nKS5vbkNsaWNrKCgpID0+IHZvaWQgdGhpcy5jcmVhdGVCb2FyZChmaWxlKSkpO1xuICAgICAgICB9IGVsc2UgaWYgKGZpbGUgaW5zdGFuY2VvZiBURmlsZSAmJiBsZWFmPy52aWV3IGluc3RhbmNlb2YgTWFya2Rvd25WaWV3ICYmIHRoaXMuaXNCb2FyZChmaWxlKSkge1xuICAgICAgICAgIG1lbnUuYWRkSXRlbSgoaTogYW55KSA9PiBpLnNldFRpdGxlKCdPcGVuIGFzIGJvYXJkJykuc2V0SWNvbignc3F1YXJlLWthbmJhbicpLm9uQ2xpY2soKCkgPT4gdm9pZCB0aGlzLm9wZW5Bc0JvYXJkKGxlYWYsIGZpbGUpKSk7XG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgICk7XG4gICAgLy8gQSBib2FyZCBub3RlIG9wZW5zIGFzIGEgYm9hcmQsIHVubGVzcyB0aGUgdXNlciBhc2tlZCBmb3IgbWFya2Rvd24gaW4gdGhhdCB0YWIuXG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KHRoaXMuYXBwLndvcmtzcGFjZS5vbignZmlsZS1vcGVuJywgKCkgPT4gdm9pZCB0aGlzLnN3aXRjaEFjdGl2ZUxlYWYoKSkpO1xuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbkxheW91dFJlYWR5KCgpID0+IHtcbiAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5pdGVyYXRlUm9vdExlYXZlcz8uKChsZWFmOiBXb3Jrc3BhY2VMZWFmKSA9PiB2b2lkIHRoaXMubWF5YmVTd2l0Y2gobGVhZikpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqIFRydWUgd2hlbiB0aGUgbm90ZSBpcyBhIGJvYXJkLCBieSBpdHMgY2FjaGVkIGZyb250bWF0dGVyLiAqL1xuICBpc0JvYXJkKGZpbGU6IFRGaWxlKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGlzQm9hcmRGcm9udG1hdHRlcih0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShmaWxlKT8uZnJvbnRtYXR0ZXIpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBzd2l0Y2hBY3RpdmVMZWFmKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuYWN0aXZlTGVhZiA/PyB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TW9zdFJlY2VudExlYWYoKTtcbiAgICBpZiAobGVhZikgYXdhaXQgdGhpcy5tYXliZVN3aXRjaChsZWFmKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgbWF5YmVTd2l0Y2gobGVhZjogV29ya3NwYWNlTGVhZik6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHZpZXcgPSBsZWFmLnZpZXc7XG4gICAgaWYgKCEodmlldyBpbnN0YW5jZW9mIE1hcmtkb3duVmlldykgfHwgIXZpZXcuZmlsZSkgcmV0dXJuO1xuICAgIGNvbnN0IGZpbGUgPSB2aWV3LmZpbGU7XG4gICAgY29uc3QgcGlubmVkID0gdGhpcy5hc01hcmtkb3duLmdldChsZWFmKTtcbiAgICBpZiAocGlubmVkID09PSBmaWxlLnBhdGgpIHJldHVybjtcbiAgICBpZiAocGlubmVkKSB0aGlzLmFzTWFya2Rvd24uZGVsZXRlKGxlYWYpO1xuICAgIC8vIFRoZSBjYWNoZSBtYXkgbm90IGhhdmUgdGhlIG5vdGUgeWV0IHJpZ2h0IGFmdGVyIGl0IHdhcyBjcmVhdGVkOyBmYWxsIGJhY2sgdG8gcmVhZGluZyBpdC5cbiAgICBjb25zdCBib2FyZCA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGZpbGUpID8gdGhpcy5pc0JvYXJkKGZpbGUpIDogaXNCb2FyZE1hcmtkb3duKGF3YWl0IHRoaXMuYXBwLnZhdWx0LmNhY2hlZFJlYWQoZmlsZSkpO1xuICAgIGlmIChib2FyZCkgYXdhaXQgdGhpcy5vcGVuQXNCb2FyZChsZWFmLCBmaWxlKTtcbiAgfVxuXG4gIGFzeW5jIG9wZW5Bc0JvYXJkKGxlYWY6IFdvcmtzcGFjZUxlYWYsIGZpbGU6IFRGaWxlKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5hc01hcmtkb3duLmRlbGV0ZShsZWFmKTtcbiAgICBhd2FpdCBsZWFmLnNldFZpZXdTdGF0ZSh7IHR5cGU6IFZJRVdfVFlQRSwgc3RhdGU6IHsgZmlsZTogZmlsZS5wYXRoIH0sIGFjdGl2ZTogdHJ1ZSB9IGFzIGFueSk7XG4gIH1cblxuICBvcGVuQXNNYXJrZG93bihsZWFmOiBXb3Jrc3BhY2VMZWFmKTogdm9pZCB7XG4gICAgY29uc3QgZmlsZSA9IChsZWFmLnZpZXcgYXMgS2FuYmFuVmlldykuZmlsZTtcbiAgICBpZiAoIWZpbGUpIHJldHVybjtcbiAgICB0aGlzLmFzTWFya2Rvd24uc2V0KGxlYWYsIGZpbGUucGF0aCk7XG4gICAgdm9pZCBsZWFmLnNldFZpZXdTdGF0ZSh7IHR5cGU6ICdtYXJrZG93bicsIHN0YXRlOiB7IGZpbGU6IGZpbGUucGF0aCB9LCBhY3RpdmU6IHRydWUgfSBhcyBhbnkpO1xuICB9XG5cbiAgLyoqIENyZWF0ZSBcIlVudGl0bGVkIEthbmJhbi5tZFwiIChvciB0aGUgbmV4dCBmcmVlIG5hbWUpIGluIGBmb2xkZXJgLCBvciB3aGVyZSBuZXcgbm90ZXMgZ28sIGFuZCBvcGVuIGl0LiAqL1xuICBhc3luYyBjcmVhdGVCb2FyZChmb2xkZXI/OiBURm9sZGVyKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgcGFyZW50ID0gZm9sZGVyID8/IHRoaXMuYXBwLmZpbGVNYW5hZ2VyLmdldE5ld0ZpbGVQYXJlbnQodGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKT8ucGF0aCA/PyAnJyk7XG4gICAgY29uc3QgZGlyID0gcGFyZW50ICYmICFwYXJlbnQuaXNSb290KCkgPyBgJHtwYXJlbnQucGF0aH0vYCA6ICcnO1xuICAgIGxldCBwYXRoID0gYCR7ZGlyfVVudGl0bGVkIEthbmJhbi5tZGA7XG4gICAgZm9yIChsZXQgbiA9IDE7IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChwYXRoKTsgbisrKSBwYXRoID0gYCR7ZGlyfVVudGl0bGVkIEthbmJhbiAke259Lm1kYDtcbiAgICB0cnkge1xuICAgICAgY29uc3QgZmlsZSA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmNyZWF0ZShwYXRoLCBuZXdCb2FyZE1hcmtkb3duKCkpO1xuICAgICAgYXdhaXQgdGhpcy5vcGVuQXNCb2FyZCh0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhZihmYWxzZSksIGZpbGUpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHVpLm5vdGljZShgQ291bGQgbm90IGNyZWF0ZSB0aGUgYm9hcmQ6ICR7ZSBpbnN0YW5jZW9mIEVycm9yID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpfWAsIHsga2luZDogJ2Vycm9yJyB9KTtcbiAgICB9XG4gIH1cbn1cbiIsICIvLyBSZWFkcyBhbmQgd3JpdGVzIEthbmJhbiBib2FyZCBub3RlcyBpbiB0aGUgZm9ybWF0IE9ic2lkaWFuJ3MgS2FuYmFuIHBsdWdpbiB1c2VzIChtZ21leWVycy9vYnNpZGlhbi1rYW5iYW4sIGxpc3Rcbi8vIGZvcm1hdCksIHNvIGEgYm9hcmQgZWRpdGVkIGhlcmUgb3BlbnMgdW5jaGFuZ2VkIHRoZXJlIGFuZCB0aGUgb3RoZXIgd2F5IHJvdW5kLiBQdXJlOiBubyBET00sIG5vIE9ic2lkaWFuIEFQSS5cbi8vXG4vLyBBIGJvYXJkIG5vdGUgbG9va3MgbGlrZSB0aGlzOlxuLy9cbi8vICAgLS0tXG4vL1xuLy8gICBrYW5iYW4tcGx1Z2luOiBib2FyZFxuLy9cbi8vICAgLS0tXG4vL1xuLy8gICAjIyBUbyBkb1xuLy9cbi8vICAgLSBbIF0gQSBjYXJkXG4vLyAgIFx0YSBzZWNvbmQgbGluZSwgaW5kZW50ZWRcbi8vXG4vL1xuLy8gICAjIyBEb25lXG4vL1xuLy8gICAqKkNvbXBsZXRlKipcbi8vICAgLSBbeF0gRG9uZSBjYXJkXG4vL1xuLy9cbi8vICAgKioqXG4vL1xuLy8gICAjIyBBcmNoaXZlXG4vL1xuLy8gICAtIFt4XSBPbGQgY2FyZFxuLy9cbi8vICAgJSUga2FuYmFuOnNldHRpbmdzXG4vLyAgIGBgYFxuLy8gICB7XCJrYW5iYW4tcGx1Z2luXCI6XCJib2FyZFwifVxuLy8gICBgYGBcbi8vICAgJSVcblxuZXhwb3J0IGNvbnN0IEZST05UTUFUVEVSX0tFWSA9ICdrYW5iYW4tcGx1Z2luJztcblxuZXhwb3J0IGludGVyZmFjZSBDYXJkIHtcbiAgaWQ6IHN0cmluZztcbiAgLyoqIFRoZSBjYXJkJ3MgbWFya2Rvd24sIHdpdGhvdXQgdGhlIGNoZWNrYm94LCBibG9jayBpZCBvciBsaW5lIGluZGVudGF0aW9uLiBNYXkgc3BhbiBzZXZlcmFsIGxpbmVzLiAqL1xuICB0ZXh0OiBzdHJpbmc7XG4gIGNoZWNrZWQ6IGJvb2xlYW47XG4gIC8qKiBUaGUgY2hhcmFjdGVyIGJldHdlZW4gdGhlIGJyYWNrZXRzOiAnICcgZm9yIGFuIG9wZW4gY2FyZCwgdXN1YWxseSAneCcgZm9yIGEgZG9uZSBvbmUuICovXG4gIGNoZWNrQ2hhcjogc3RyaW5nO1xuICAvKiogQSB0cmFpbGluZyBgXmlkYCBvbiB0aGUgY2FyZCdzIGZpcnN0IGxpbmUsIGtlcHQgc28gbGlua3MgdG8gdGhlIGNhcmQgc3Vydml2ZSBhIHJld3JpdGUuICovXG4gIGJsb2NrSWQ/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTGFuZSB7XG4gIGlkOiBzdHJpbmc7XG4gIHRpdGxlOiBzdHJpbmc7XG4gIC8qKiBUaGUgY2FyZCBsaW1pdCB3cml0dGVuIGFzIGAjIyBUaXRsZSAoNSlgOyAwIHdoZW4gdGhlcmUgaXMgbm9uZS4gKi9cbiAgbWF4SXRlbXM6IG51bWJlcjtcbiAgLyoqIEEgYCoqQ29tcGxldGUqKmAgbGluZSB1bmRlciB0aGUgaGVhZGluZzogY2FyZHMgbW92ZWQgaGVyZSBhcmUgY2hlY2tlZCBvZmYuICovXG4gIG1hcmtDb21wbGV0ZTogYm9vbGVhbjtcbiAgY2FyZHM6IENhcmRbXTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBCb2FyZCB7XG4gIC8qKiBUaGUgWUFNTCBiZXR3ZWVuIHRoZSBmcm9udG1hdHRlciBmZW5jZXMsIHRyaW1tZWQuIEtlcHQgYXMgd3JpdHRlbi4gKi9cbiAgZnJvbnRtYXR0ZXI6IHN0cmluZztcbiAgbGFuZXM6IExhbmVbXTtcbiAgYXJjaGl2ZTogQ2FyZFtdO1xuICAvKiogVGhlIEpTT04gaW4gdGhlIGAlJSBrYW5iYW46c2V0dGluZ3NgIGZvb3Rlciwgd2l0aCBga2FuYmFuLXBsdWdpbmAgY29waWVkIGluIGZyb20gdGhlIGZyb250bWF0dGVyLiAqL1xuICBzZXR0aW5nczogUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2VyaWFsaXplT3B0aW9ucyB7XG4gIC8qKiBPYnNpZGlhbidzIFwiSW5kZW50IHVzaW5nIHRhYnNcIiAob24gYnkgZGVmYXVsdCkuIE9mZiBpbmRlbnRzIGEgY2FyZCdzIGV4dHJhIGxpbmVzIHdpdGggZm91ciBzcGFjZXMuICovXG4gIHVzZVRhYj86IGJvb2xlYW47XG59XG5cbmxldCBuZXh0SWQgPSAwO1xuZXhwb3J0IGNvbnN0IG5ld0lkID0gKHByZWZpeDogc3RyaW5nKTogc3RyaW5nID0+IGAke3ByZWZpeH0keysrbmV4dElkfWA7XG5cbmNvbnN0IEZST05UTUFUVEVSID0gL14tLS1bIFxcdF0qXFxyP1xcbihbXFxzXFxTXSo/KVxccj9cXG4tLS1bIFxcdF0qKD86XFxyP1xcbnwkKS87XG5jb25zdCBTRVRUSU5HU19GT09URVIgPSAvKD86XFxyP1xcbikqJSUga2FuYmFuOnNldHRpbmdzWyBcXHRdKlxccj9cXG5gYGBbXlxcbl0qXFxyP1xcbihbXFxzXFxTXSo/KVxccj9cXG5gYGBbIFxcdF0qXFxyP1xcbiUlXFxzKiQvO1xuY29uc3QgSEVBRElORyA9IC9eIHswLDN9KCN7MSw2fSlbIFxcdF0rKC4qPylbIFxcdF0qJC87XG5jb25zdCBUSEVNQVRJQ19CUkVBSyA9IC9eIHswLDN9KFstKl9dKSg/OlsgXFx0XSpcXDEpezIsfVsgXFx0XSokLztcbmNvbnN0IExJU1RfSVRFTSA9IC9eIHswLDN9KD86Wy0qK118XFxkezEsOX1bLildKSg/OlsgXFx0XSsoLiopKT8kLztcbmNvbnN0IFRBU0sgPSAvXlxcWyguKVxcXSg/OlsgXFx0XSsoW1xcc1xcU10qKSk/JC87XG5jb25zdCBCTE9DS19JRCA9IC9cXHMrXFxeKFthLXpBLVowLTktXSspJC87XG5jb25zdCBDT01QTEVURSA9ICcqKkNvbXBsZXRlKionO1xuY29uc3QgQVJDSElWRV9CUkVBSyA9ICcqKionO1xuY29uc3QgQVJDSElWRV9USVRMRSA9ICdBcmNoaXZlJztcblxuLyoqIFRydWUgd2hlbiB0aGUgbm90ZSdzIGZyb250bWF0dGVyIG1hcmtzIGl0IGFzIGEgYm9hcmQgKGBrYW5iYW4tcGx1Z2luOiBib2FyZGAsIG9yIHRoZSBvbGQgYGJhc2ljYCkuICovXG5leHBvcnQgZnVuY3Rpb24gaXNCb2FyZE1hcmtkb3duKG1kOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgY29uc3QgZm0gPSBGUk9OVE1BVFRFUi5leGVjKG1kKTtcbiAgcmV0dXJuICEhZm0gJiYgYm9hcmRLaW5kKGZtWzFdKSAhPT0gbnVsbDtcbn1cblxuLyoqIFRydWUgZm9yIGEgZnJvbnRtYXR0ZXIgb2JqZWN0IChmcm9tIHRoZSBtZXRhZGF0YSBjYWNoZSkgdGhhdCBtYXJrcyBhIGJvYXJkLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzQm9hcmRGcm9udG1hdHRlcihmbTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gfCB1bmRlZmluZWQgfCBudWxsKTogYm9vbGVhbiB7XG4gIGNvbnN0IHYgPSBmbT8uW0ZST05UTUFUVEVSX0tFWV07XG4gIHJldHVybiB2ID09PSAnYm9hcmQnIHx8IHYgPT09ICdiYXNpYyc7XG59XG5cbmZ1bmN0aW9uIGJvYXJkS2luZCh5YW1sOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgY29uc3QgbSA9IC9ea2FuYmFuLXBsdWdpbjpbIFxcdF0qW1wiJ10/KFteXCInXFxzI10rKVtcIiddP1sgXFx0XSooPzojLiopPyQvbS5leGVjKHlhbWwpO1xuICByZXR1cm4gbSA/IG1bMV0gOiBudWxsO1xufVxuXG4vKiogYFRvIGRvICg1KWAgXHUyMTkyIHRpdGxlIGFuZCBjYXJkIGxpbWl0OyBgPGJyPmAgaW4gYSBoZWFkaW5nIGlzIGEgbGluZSBicmVhaywgYXMgT2JzaWRpYW4ncyBLYW5iYW4gd3JpdGVzIGl0LiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlTGFuZVRpdGxlKHJhdzogc3RyaW5nKTogeyB0aXRsZTogc3RyaW5nOyBtYXhJdGVtczogbnVtYmVyIH0ge1xuICBjb25zdCBzdHIgPSByYXcucmVwbGFjZSgvPGJyPi9nLCAnXFxuJykudHJpbSgpO1xuICBjb25zdCBtID0gL14oLio/KVxccypcXCgoXFxkKylcXCkkLy5leGVjKHN0cik7XG4gIHJldHVybiBtID8geyB0aXRsZTogbVsxXSwgbWF4SXRlbXM6IE51bWJlcihtWzJdKSB9IDogeyB0aXRsZTogc3RyLCBtYXhJdGVtczogMCB9O1xufVxuXG5mdW5jdGlvbiBsYW5lSGVhZGluZyhsYW5lOiBMYW5lKTogc3RyaW5nIHtcbiAgY29uc3QgdCA9IGxhbmUubWF4SXRlbXMgPyBgJHtsYW5lLnRpdGxlfSAoJHtsYW5lLm1heEl0ZW1zfSlgIDogbGFuZS50aXRsZTtcbiAgcmV0dXJuIHQudHJpbSgpLnJlcGxhY2UoL1xccj9cXG4vZywgJzxicj4nKTtcbn1cblxuLyoqIEEgY2FyZCdzIHNvdXJjZSBsaW5lcyAoZmlyc3QgbGluZSBhZnRlciB0aGUgbWFya2VyLCB0aGVuIGl0cyBjb250aW51YXRpb24gbGluZXMgYXMgd3JpdHRlbikgXHUyMTkyIGEgQ2FyZC4gKi9cbmZ1bmN0aW9uIHRvQ2FyZChmaXJzdDogc3RyaW5nLCByZXN0OiBzdHJpbmdbXSk6IENhcmQge1xuICBsZXQgY2hlY2tDaGFyID0gJyAnO1xuICBsZXQgaGVhZCA9IGZpcnN0O1xuICBjb25zdCB0YXNrID0gVEFTSy5leGVjKGZpcnN0KTtcbiAgaWYgKHRhc2spIHtcbiAgICBjaGVja0NoYXIgPSB0YXNrWzFdO1xuICAgIGhlYWQgPSB0YXNrWzJdID8/ICcnO1xuICB9XG4gIC8vIE9ic2lkaWFuJ3MgS2FuYmFuIHN0cmlwcyBvbmUgaW5kZW50IGxldmVsIGZyb20gY29udGludWF0aW9uIGxpbmVzLCB0aGVuIHR1cm5zIDxicj4gaW50byBsaW5lIGJyZWFrcy5cbiAgbGV0IHRleHQgPSBbaGVhZCwgLi4ucmVzdF0uam9pbignXFxuJykudHJpbSgpLnJlcGxhY2UoL1xccj9cXG4oPzogezR9fFxcdCkvZywgJ1xcbicpLnJlcGxhY2UoLzxicj4vZywgJ1xcbicpLnRyaW0oKTtcbiAgY29uc3QgbGluZXMgPSB0ZXh0LnNwbGl0KCdcXG4nKTtcbiAgbGV0IGJsb2NrSWQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgY29uc3QgYmlkID0gQkxPQ0tfSUQuZXhlYyhsaW5lc1swXSk7XG4gIGlmIChiaWQpIHtcbiAgICBibG9ja0lkID0gYmlkWzFdO1xuICAgIGxpbmVzWzBdID0gbGluZXNbMF0uc2xpY2UoMCwgYmlkLmluZGV4KTtcbiAgICB0ZXh0ID0gbGluZXMuam9pbignXFxuJyk7XG4gIH1cbiAgY29uc3QgY2FyZDogQ2FyZCA9IHsgaWQ6IG5ld0lkKCdjJyksIHRleHQsIGNoZWNrZWQ6IGNoZWNrQ2hhciAhPT0gJyAnLCBjaGVja0NoYXIgfTtcbiAgaWYgKGJsb2NrSWQpIGNhcmQuYmxvY2tJZCA9IGJsb2NrSWQ7XG4gIHJldHVybiBjYXJkO1xufVxuXG4vKiogUGFyc2UgYSBib2FyZCBub3RlLiBBbnl0aGluZyBvdXRzaWRlIGxhbmVzICh0ZXh0IGJlZm9yZSB0aGUgZmlyc3QgaGVhZGluZywgc3RyYXkgcGFyYWdyYXBocykgaXMgZHJvcHBlZCBvbiB3cml0ZSxcbiAqICBhcyBpdCBpcyBpbiBPYnNpZGlhbidzIEthbmJhbi4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUJvYXJkKG1kOiBzdHJpbmcpOiBCb2FyZCB7XG4gIGxldCBib2R5ID0gbWQ7XG4gIGxldCBmcm9udG1hdHRlciA9ICcnO1xuICBjb25zdCBmbSA9IEZST05UTUFUVEVSLmV4ZWMobWQpO1xuICBpZiAoZm0pIHtcbiAgICBmcm9udG1hdHRlciA9IGZtWzFdLnRyaW0oKTtcbiAgICBib2R5ID0gbWQuc2xpY2UoZm1bMF0ubGVuZ3RoKTtcbiAgfVxuXG4gIGxldCBzZXR0aW5nczogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7fTtcbiAgY29uc3QgZm9vdGVyID0gU0VUVElOR1NfRk9PVEVSLmV4ZWMoYm9keSk7XG4gIGlmIChmb290ZXIpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShmb290ZXJbMV0udHJpbSgpKTtcbiAgICAgIGlmIChwYXJzZWQgJiYgdHlwZW9mIHBhcnNlZCA9PT0gJ29iamVjdCcgJiYgIUFycmF5LmlzQXJyYXkocGFyc2VkKSkgc2V0dGluZ3MgPSBwYXJzZWQ7XG4gICAgfSBjYXRjaCB7XG4gICAgICAvLyBBbiB1bnJlYWRhYmxlIGZvb3RlciBpcyByZXBsYWNlZCBieSBhIGZyZXNoIG9uZSBvbiB3cml0ZS5cbiAgICB9XG4gICAgYm9keSA9IGJvZHkuc2xpY2UoMCwgZm9vdGVyLmluZGV4KTtcbiAgfVxuICBjb25zdCBraW5kID0gYm9hcmRLaW5kKGZyb250bWF0dGVyKTtcbiAgaWYgKGtpbmQpIHNldHRpbmdzW0ZST05UTUFUVEVSX0tFWV0gPSBraW5kID09PSAnYmFzaWMnID8gJ2JvYXJkJyA6IGtpbmQ7XG5cbiAgY29uc3QgYm9hcmQ6IEJvYXJkID0geyBmcm9udG1hdHRlciwgbGFuZXM6IFtdLCBhcmNoaXZlOiBbXSwgc2V0dGluZ3MgfTtcbiAgbGV0IHRhcmdldDogQ2FyZFtdIHwgbnVsbCA9IG51bGw7XG4gIGxldCBsYW5lOiBMYW5lIHwgbnVsbCA9IG51bGw7XG4gIGxldCBhZnRlckJyZWFrID0gZmFsc2U7XG4gIGxldCBpdGVtOiB7IGZpcnN0OiBzdHJpbmc7IHJlc3Q6IHN0cmluZ1tdOyBibGFua3M6IG51bWJlciB9IHwgbnVsbCA9IG51bGw7XG5cbiAgY29uc3QgZmx1c2ggPSAoKSA9PiB7XG4gICAgaWYgKGl0ZW0gJiYgdGFyZ2V0KSB0YXJnZXQucHVzaCh0b0NhcmQoaXRlbS5maXJzdCwgaXRlbS5yZXN0KSk7XG4gICAgaXRlbSA9IG51bGw7XG4gIH07XG5cbiAgZm9yIChjb25zdCBsaW5lIG9mIGJvZHkuc3BsaXQoL1xccj9cXG4vKSkge1xuICAgIGNvbnN0IGhlYWRpbmcgPSBIRUFESU5HLmV4ZWMobGluZSk7XG4gICAgaWYgKGhlYWRpbmcpIHtcbiAgICAgIGZsdXNoKCk7XG4gICAgICBpZiAoYWZ0ZXJCcmVhaykge1xuICAgICAgICB0YXJnZXQgPSBib2FyZC5hcmNoaXZlO1xuICAgICAgICBsYW5lID0gbnVsbDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxhbmUgPSB7IGlkOiBuZXdJZCgnbCcpLCAuLi5wYXJzZUxhbmVUaXRsZShoZWFkaW5nWzJdKSwgbWFya0NvbXBsZXRlOiBmYWxzZSwgY2FyZHM6IFtdIH07XG4gICAgICAgIGJvYXJkLmxhbmVzLnB1c2gobGFuZSk7XG4gICAgICAgIHRhcmdldCA9IGxhbmUuY2FyZHM7XG4gICAgICB9XG4gICAgICBhZnRlckJyZWFrID0gZmFsc2U7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKFRIRU1BVElDX0JSRUFLLnRlc3QobGluZSkgJiYgIShpdGVtICYmIC9eXFxzLy50ZXN0KGxpbmUpKSkge1xuICAgICAgZmx1c2goKTtcbiAgICAgIGFmdGVyQnJlYWsgPSB0cnVlO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmICghbGluZS50cmltKCkpIHtcbiAgICAgIGlmIChpdGVtKSBpdGVtLmJsYW5rcysrO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGNvbnN0IGxpID0gTElTVF9JVEVNLmV4ZWMobGluZSk7XG4gICAgaWYgKGxpICYmIHRhcmdldCkge1xuICAgICAgZmx1c2goKTtcbiAgICAgIGl0ZW0gPSB7IGZpcnN0OiBsaVsxXSA/PyAnJywgcmVzdDogW10sIGJsYW5rczogMCB9O1xuICAgICAgYWZ0ZXJCcmVhayA9IGZhbHNlO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmIChpdGVtICYmICgvXlxccy8udGVzdChsaW5lKSB8fCBpdGVtLmJsYW5rcyA9PT0gMCkpIHtcbiAgICAgIC8vIEFuIGluZGVudGVkIGxpbmUsIG9yIGEgbGF6eSBjb250aW51YXRpb24gcmlnaHQgdW5kZXIgdGhlIGl0ZW0sIGJlbG9uZ3MgdG8gdGhlIGNhcmQuXG4gICAgICBmb3IgKDsgaXRlbS5ibGFua3MgPiAwOyBpdGVtLmJsYW5rcy0tKSBpdGVtLnJlc3QucHVzaCgnJyk7XG4gICAgICBpdGVtLnJlc3QucHVzaChsaW5lKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBmbHVzaCgpO1xuICAgIGFmdGVyQnJlYWsgPSBmYWxzZTtcbiAgICBpZiAobGFuZSAmJiBsaW5lLnRyaW0oKSA9PT0gQ09NUExFVEUgJiYgbGFuZS5jYXJkcy5sZW5ndGggPT09IDApIGxhbmUubWFya0NvbXBsZXRlID0gdHJ1ZTtcbiAgfVxuICBmbHVzaCgpO1xuICByZXR1cm4gYm9hcmQ7XG59XG5cbmZ1bmN0aW9uIGNhcmRUb01kKGNhcmQ6IENhcmQsIGluZGVudDogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3QgbGluZXMgPSBjYXJkLnRleHQudHJpbSgpLnJlcGxhY2UoL1xccj9cXG4vZywgYFxcbiR7aW5kZW50fWApLnNwbGl0KCdcXG4nKTtcbiAgaWYgKGNhcmQuYmxvY2tJZCkgbGluZXNbMF0gKz0gYCBeJHtjYXJkLmJsb2NrSWR9YDtcbiAgcmV0dXJuIGAtIFske2NhcmQuY2hlY2tDaGFyfV0gJHtsaW5lcy5qb2luKCdcXG4nKX1gO1xufVxuXG4vKiogV3JpdGUgYSBib2FyZCBiYWNrIGluIE9ic2lkaWFuJ3MgS2FuYmFuIGxheW91dCwgYnl0ZSBmb3IgYnl0ZSB3aGF0IHRoYXQgcGx1Z2luIHdyaXRlcyBmb3IgdGhlIHNhbWUgYm9hcmQuICovXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplQm9hcmQoYm9hcmQ6IEJvYXJkLCBvOiBTZXJpYWxpemVPcHRpb25zID0ge30pOiBzdHJpbmcge1xuICBjb25zdCBpbmRlbnQgPSBvLnVzZVRhYiA9PT0gZmFsc2UgPyAnICAgICcgOiAnXFx0JztcbiAgY29uc3QgeWFtbCA9IGJvYXJkLmZyb250bWF0dGVyLnRyaW0oKSB8fCBgJHtGUk9OVE1BVFRFUl9LRVl9OiBib2FyZGA7XG4gIGxldCBvdXQgPSBbJy0tLScsICcnLCBgJHt5YW1sfVxcbmAsICctLS0nLCAnJywgJyddLmpvaW4oJ1xcbicpO1xuICBmb3IgKGNvbnN0IGxhbmUgb2YgYm9hcmQubGFuZXMpIHtcbiAgICBjb25zdCBsaW5lcyA9IFtgIyMgJHtsYW5lSGVhZGluZyhsYW5lKX1gLCAnJ107XG4gICAgaWYgKGxhbmUubWFya0NvbXBsZXRlKSBsaW5lcy5wdXNoKENPTVBMRVRFKTtcbiAgICBmb3IgKGNvbnN0IGMgb2YgbGFuZS5jYXJkcykgbGluZXMucHVzaChjYXJkVG9NZChjLCBpbmRlbnQpKTtcbiAgICBsaW5lcy5wdXNoKCcnLCAnJywgJycpO1xuICAgIG91dCArPSBsaW5lcy5qb2luKCdcXG4nKTtcbiAgfVxuICBpZiAoYm9hcmQuYXJjaGl2ZS5sZW5ndGgpIHtcbiAgICBvdXQgKz0gW0FSQ0hJVkVfQlJFQUssICcnLCBgIyMgJHtBUkNISVZFX1RJVExFfWAsICcnLCAuLi5ib2FyZC5hcmNoaXZlLm1hcCgoYykgPT4gY2FyZFRvTWQoYywgaW5kZW50KSldLmpvaW4oJ1xcbicpO1xuICB9XG4gIGNvbnN0IHNldHRpbmdzID0geyAuLi5ib2FyZC5zZXR0aW5ncyB9O1xuICBpZiAoIShGUk9OVE1BVFRFUl9LRVkgaW4gc2V0dGluZ3MpKSBzZXR0aW5nc1tGUk9OVE1BVFRFUl9LRVldID0gYm9hcmRLaW5kKHlhbWwpID8/ICdib2FyZCc7XG4gIG91dCArPSBbJycsICcnLCAnJSUga2FuYmFuOnNldHRpbmdzJywgJ2BgYCcsIEpTT04uc3RyaW5naWZ5KHNldHRpbmdzKSwgJ2BgYCcsICclJSddLmpvaW4oJ1xcbicpO1xuICByZXR1cm4gb3V0O1xufVxuXG4vKiogQSBuZXcgYm9hcmQgbm90ZSB3aXRoIHRoZSBnaXZlbiBsYW5lcy4gKi9cbmV4cG9ydCBmdW5jdGlvbiBuZXdCb2FyZE1hcmtkb3duKGxhbmVzOiBzdHJpbmdbXSA9IFsnVG8gZG8nLCAnRG9pbmcnLCAnRG9uZSddKTogc3RyaW5nIHtcbiAgcmV0dXJuIHNlcmlhbGl6ZUJvYXJkKHtcbiAgICBmcm9udG1hdHRlcjogYCR7RlJPTlRNQVRURVJfS0VZfTogYm9hcmRgLFxuICAgIGxhbmVzOiBsYW5lcy5tYXAoKHRpdGxlLCBpKSA9PiAoeyBpZDogbmV3SWQoJ2wnKSwgdGl0bGUsIG1heEl0ZW1zOiAwLCBtYXJrQ29tcGxldGU6IGkgPT09IGxhbmVzLmxlbmd0aCAtIDEgJiYgbGFuZXMubGVuZ3RoID4gMSwgY2FyZHM6IFtdIH0pKSxcbiAgICBhcmNoaXZlOiBbXSxcbiAgICBzZXR0aW5nczogeyBbRlJPTlRNQVRURVJfS0VZXTogJ2JvYXJkJyB9LFxuICB9KTtcbn1cbiIsICIvLyBUaGUgYm9hcmQgdmlldzogYSBUZXh0RmlsZVZpZXcgb3ZlciBhIGJvYXJkIG5vdGUuIEVkaXRzIGdvIHRocm91Z2ggb3BzLnRzIGFuZCBhcmUgd3JpdHRlbiBzdHJhaWdodCBiYWNrIHRvIHRoZSBub3RlLlxuaW1wb3J0IHsgTWFya2Rvd25SZW5kZXJlciwgVGV4dEZpbGVWaWV3LCB0eXBlIFdvcmtzcGFjZUxlYWYgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyB1aSwgdHlwZSBNZW51SXRlbVNwZWMgfSBmcm9tICdoZWxlbml0ZSc7XG5pbXBvcnQgeyBwYXJzZUJvYXJkLCBzZXJpYWxpemVCb2FyZCwgdHlwZSBCb2FyZCwgdHlwZSBDYXJkLCB0eXBlIExhbmUgfSBmcm9tICcuL2JvYXJkJztcbmltcG9ydCAqIGFzIG9wcyBmcm9tICcuL29wcyc7XG5cbmV4cG9ydCBjb25zdCBWSUVXX1RZUEUgPSAnaGVsZW5pdGUta2FuYmFuJztcblxuLyoqIEluIGEgcHJvbXB0LCBhIGNhcmQncyBsaW5lIGJyZWFrcyBhcmUgc2hvd24gYXMgPGJyPiAodGhlIGJvYXJkIGZvcm1hdCByZWFkcyA8YnI+IGJhY2sgYXMgYSBsaW5lIGJyZWFrKS4gKi9cbmNvbnN0IHRvUHJvbXB0ID0gKHRleHQ6IHN0cmluZyk6IHN0cmluZyA9PiB0ZXh0LnJlcGxhY2UoL1xccj9cXG4vZywgJzxicj4nKTtcbmNvbnN0IGZyb21Qcm9tcHQgPSAodGV4dDogc3RyaW5nKTogc3RyaW5nID0+IHRleHQucmVwbGFjZSgvPGJyPi9nLCAnXFxuJyk7XG5jb25zdCBmaXJzdExpbmUgPSAodGV4dDogc3RyaW5nKTogc3RyaW5nID0+IHRleHQuc3BsaXQoJ1xcbicpWzBdIHx8ICcoZW1wdHkgY2FyZCknO1xuY29uc3QgcmVxdWlyZWQgPSAod2hhdDogc3RyaW5nKSA9PiAodjogc3RyaW5nKSA9PiAodi50cmltKCkgPyBudWxsIDogYEVudGVyIGEgJHt3aGF0fS5gKTtcblxuZXhwb3J0IGludGVyZmFjZSBLYW5iYW5Ib3N0IHtcbiAgLyoqIFJlb3BlbiB0aGUgbGVhZiBhcyBhIHBsYWluIG1hcmtkb3duIG5vdGUuICovXG4gIG9wZW5Bc01hcmtkb3duKGxlYWY6IFdvcmtzcGFjZUxlYWYpOiB2b2lkO1xufVxuXG5leHBvcnQgY2xhc3MgS2FuYmFuVmlldyBleHRlbmRzIFRleHRGaWxlVmlldyB7XG4gIGJvYXJkOiBCb2FyZCA9IHBhcnNlQm9hcmQoJycpO1xuICAvKiogT25seSBhbiBlZGl0IG1hZGUgaGVyZSByZXdyaXRlcyB0aGUgbm90ZTsganVzdCB2aWV3aW5nIGEgaGFuZC13cml0dGVuIGJvYXJkIGxlYXZlcyBpdHMgbGF5b3V0IGFsb25lLiAqL1xuICBwcml2YXRlIGRpcnR5ID0gZmFsc2U7XG4gIHByaXZhdGUgZHJhZ0lkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblxuICBjb25zdHJ1Y3RvcihsZWFmOiBXb3Jrc3BhY2VMZWFmLCBwcml2YXRlIGhvc3Q6IEthbmJhbkhvc3QpIHtcbiAgICBzdXBlcihsZWFmKTtcbiAgfVxuXG4gIGdldFZpZXdUeXBlKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIFZJRVdfVFlQRTtcbiAgfVxuXG4gIGdldEljb24oKTogc3RyaW5nIHtcbiAgICByZXR1cm4gJ3NxdWFyZS1rYW5iYW4nO1xuICB9XG5cbiAgYXN5bmMgb25PcGVuKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuYWRkQWN0aW9uKCdmaWxlLXRleHQnLCAnT3BlbiBhcyBtYXJrZG93bicsICgpID0+IHRoaXMuaG9zdC5vcGVuQXNNYXJrZG93bih0aGlzLmxlYWYpKTtcbiAgfVxuXG4gIGdldFZpZXdEYXRhKCk6IHN0cmluZyB7XG4gICAgaWYgKCF0aGlzLmRpcnR5KSByZXR1cm4gdGhpcy5kYXRhO1xuICAgIGNvbnN0IHVzZVRhYiA9ICh0aGlzLmFwcC52YXVsdCBhcyBhbnkpLmdldENvbmZpZz8uKCd1c2VUYWInKSAhPT0gZmFsc2U7XG4gICAgcmV0dXJuIHNlcmlhbGl6ZUJvYXJkKHRoaXMuYm9hcmQsIHsgdXNlVGFiIH0pO1xuICB9XG5cbiAgc2V0Vmlld0RhdGEoZGF0YTogc3RyaW5nLCBfY2xlYXI6IGJvb2xlYW4pOiB2b2lkIHtcbiAgICB0aGlzLmRhdGEgPSBkYXRhO1xuICAgIHRoaXMuZGlydHkgPSBmYWxzZTtcbiAgICB0aGlzLmJvYXJkID0gcGFyc2VCb2FyZChkYXRhKTtcbiAgICB0aGlzLnJlbmRlcigpO1xuICB9XG5cbiAgY2xlYXIoKTogdm9pZCB7XG4gICAgdGhpcy5ib2FyZCA9IHBhcnNlQm9hcmQoJycpO1xuICAgIHRoaXMuZGlydHkgPSBmYWxzZTtcbiAgfVxuXG4gIC8qKiBXcml0ZXMgb25seSBhZnRlciBhbiBlZGl0IGhlcmUsIG5ldmVyIGZvciBhIGJvYXJkIHRoYXQgaXMgc3RpbGwgbG9hZGluZyBvciB3YXMgb25seSB2aWV3ZWQuICovXG4gIGFzeW5jIHNhdmUoY2xlYXI/OiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKHRoaXMuZGlydHkpIGF3YWl0IHN1cGVyLnNhdmUoY2xlYXIpO1xuICB9XG5cbiAgLyoqIEFwcGx5IGFuIGVkaXQsIHJlZHJhdyBhbmQgc2F2ZS4gKi9cbiAgdXBkYXRlKG5leHQ6IEJvYXJkKTogdm9pZCB7XG4gICAgdGhpcy5ib2FyZCA9IG5leHQ7XG4gICAgdGhpcy5kaXJ0eSA9IHRydWU7XG4gICAgdGhpcy5yZW5kZXIoKTtcbiAgICB2b2lkIHRoaXMuc2F2ZSgpO1xuICB9XG5cbiAgcmVuZGVyKCk6IHZvaWQge1xuICAgIGNvbnN0IHJvb3QgPSB0aGlzLmNvbnRlbnRFbDtcbiAgICByb290LmVtcHR5KCk7XG4gICAgcm9vdC5hZGRDbGFzcygnaGVsZW5pdGUta2FuYmFuLXZpZXcnKTtcbiAgICBjb25zdCBiYXIgPSByb290LmNyZWF0ZURpdih7IGNsczogJ2hlbGVuaXRlLWthbmJhbi10b29sYmFyJyB9KTtcbiAgICB1aS5idXR0b24oYmFyLCB7IHRleHQ6ICdBZGQgbGlzdCcsIGljb246ICdwbHVzJywgb25DbGljazogKCkgPT4gdGhpcy5hZGRMYW5lKCkgfSk7XG4gICAgaWYgKHRoaXMuYm9hcmQuYXJjaGl2ZS5sZW5ndGgpIHtcbiAgICAgIHVpLmJ1dHRvbihiYXIsIHsgdGV4dDogYEFyY2hpdmVkIGNhcmRzICgke3RoaXMuYm9hcmQuYXJjaGl2ZS5sZW5ndGh9KWAsIGljb246ICdhcmNoaXZlJywgb25DbGljazogKCkgPT4gdGhpcy5yZXN0b3JlRnJvbUFyY2hpdmUoKSB9KTtcbiAgICB9XG4gICAgY29uc3QgbGFuZXMgPSByb290LmNyZWF0ZURpdih7IGNsczogJ2hlbGVuaXRlLWthbmJhbi1sYW5lcycgfSk7XG4gICAgaWYgKCF0aGlzLmJvYXJkLmxhbmVzLmxlbmd0aCkge1xuICAgICAgdWkuZW1wdHlTdGF0ZShsYW5lcywgJ05vIGxpc3RzIHlldC4gQWRkIGEgbGlzdCB0byBzdGFydCB0aGUgYm9hcmQuJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRoaXMuYm9hcmQubGFuZXMuZm9yRWFjaCgobGFuZSwgaSkgPT4gdGhpcy5yZW5kZXJMYW5lKGxhbmVzLCBsYW5lLCBpKSk7XG4gIH1cblxuICBwcml2YXRlIHJlbmRlckxhbmUocGFyZW50OiBIVE1MRWxlbWVudCwgbGFuZTogTGFuZSwgaW5kZXg6IG51bWJlcik6IHZvaWQge1xuICAgIGNvbnN0IGVsID0gcGFyZW50LmNyZWF0ZURpdih7IGNsczogJ2hlbGVuaXRlLWthbmJhbi1sYW5lJyB9KTtcbiAgICBlbC5kYXRhc2V0LmxhbmVJZCA9IGxhbmUuaWQ7XG4gICAgY29uc3QgaGVhZCA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2hlbGVuaXRlLWthbmJhbi1sYW5lLWhlYWRlcicgfSk7XG4gICAgY29uc3QgdGl0bGUgPSBoZWFkLmNyZWF0ZURpdih7IGNsczogJ2hlbGVuaXRlLWthbmJhbi1sYW5lLXRpdGxlJywgdGV4dDogbGFuZS50aXRsZSB8fCAnVW50aXRsZWQgbGlzdCcgfSk7XG4gICAgdGl0bGUuc2V0QXR0cmlidXRlKCdyb2xlJywgJ2J1dHRvbicpO1xuICAgIHRpdGxlLnRhYkluZGV4ID0gMDtcbiAgICB0aXRsZS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHZvaWQgdGhpcy5yZW5hbWVMYW5lKGxhbmUpKTtcbiAgICBjb25zdCBjb3VudCA9IGxhbmUubWF4SXRlbXMgPyBgJHtsYW5lLmNhcmRzLmxlbmd0aH0vJHtsYW5lLm1heEl0ZW1zfWAgOiBTdHJpbmcobGFuZS5jYXJkcy5sZW5ndGgpO1xuICAgIHVpLmJhZGdlKGhlYWQsIGNvdW50LCBsYW5lLm1heEl0ZW1zICYmIGxhbmUuY2FyZHMubGVuZ3RoID4gbGFuZS5tYXhJdGVtcyA/ICdkYW5nZXInIDogbGFuZS5tYXJrQ29tcGxldGUgPyAnc3VjY2VzcycgOiAnZGVmYXVsdCcpO1xuICAgIHVpLm1vcmVCdXR0b24oaGVhZCwgKCkgPT4gdGhpcy5sYW5lTWVudShsYW5lLCBpbmRleCksICdMaXN0IG9wdGlvbnMnKTtcblxuICAgIGNvbnN0IGNhcmRzID0gZWwuY3JlYXRlRGl2KHsgY2xzOiAnaGVsZW5pdGUta2FuYmFuLWNhcmRzJyB9KTtcbiAgICB0aGlzLndpcmVEcm9wKGNhcmRzLCBsYW5lKTtcbiAgICBpZiAoIWxhbmUuY2FyZHMubGVuZ3RoKSBjYXJkcy5jcmVhdGVEaXYoeyBjbHM6ICdoZWxlbml0ZS1rYW5iYW4tcGxhY2Vob2xkZXInLCB0ZXh0OiAnTm8gY2FyZHMnIH0pO1xuICAgIGZvciAoY29uc3QgY2FyZCBvZiBsYW5lLmNhcmRzKSB0aGlzLnJlbmRlckNhcmQoY2FyZHMsIGNhcmQsIGxhbmUpO1xuICAgIHVpLmJ1dHRvbihlbCwgeyB0ZXh0OiAnQWRkIGEgY2FyZCcsIGljb246ICdwbHVzJywgdmFyaWFudDogJ2xpbmsnLCBvbkNsaWNrOiAoKSA9PiB0aGlzLmFkZENhcmQobGFuZSkgfSk7XG4gIH1cblxuICBwcml2YXRlIHJlbmRlckNhcmQocGFyZW50OiBIVE1MRWxlbWVudCwgY2FyZDogQ2FyZCwgbGFuZTogTGFuZSk6IHZvaWQge1xuICAgIGNvbnN0IGVsID0gcGFyZW50LmNyZWF0ZURpdih7IGNsczogJ2hlbGVuaXRlLWthbmJhbi1jYXJkJyB9KTtcbiAgICBlbC50b2dnbGVDbGFzcygnaXMtZG9uZScsIGNhcmQuY2hlY2tlZCk7XG4gICAgZWwuZGF0YXNldC5jYXJkSWQgPSBjYXJkLmlkO1xuICAgIGVsLmRyYWdnYWJsZSA9IHRydWU7XG4gICAgZWwuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ3N0YXJ0JywgKGUpID0+IHtcbiAgICAgIHRoaXMuZHJhZ0lkID0gY2FyZC5pZDtcbiAgICAgIGUuZGF0YVRyYW5zZmVyPy5zZXREYXRhKCd0ZXh0L3BsYWluJywgY2FyZC5pZCk7XG4gICAgICBlbC5hZGRDbGFzcygnaXMtZHJhZ2dpbmcnKTtcbiAgICB9KTtcbiAgICBlbC5hZGRFdmVudExpc3RlbmVyKCdkcmFnZW5kJywgKCkgPT4ge1xuICAgICAgdGhpcy5kcmFnSWQgPSBudWxsO1xuICAgICAgZWwucmVtb3ZlQ2xhc3MoJ2lzLWRyYWdnaW5nJyk7XG4gICAgfSk7XG4gICAgY29uc3QgY2hlY2sgPSBlbC5jcmVhdGVFbCgnaW5wdXQnLCB7IGNsczogJ3Rhc2stbGlzdC1pdGVtLWNoZWNrYm94IGhlbGVuaXRlLWthbmJhbi1jaGVjaycsIHR5cGU6ICdjaGVja2JveCcgfSk7XG4gICAgY2hlY2suY2hlY2tlZCA9IGNhcmQuY2hlY2tlZDtcbiAgICBjaGVjay5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCBjYXJkLmNoZWNrZWQgPyAnTWFyayBjYXJkIGFzIG5vdCBkb25lJyA6ICdNYXJrIGNhcmQgYXMgZG9uZScpO1xuICAgIGNoZWNrLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICB0aGlzLnVwZGF0ZShvcHMudG9nZ2xlQ2FyZCh0aGlzLmJvYXJkLCBjYXJkLmlkKSk7XG4gICAgfSk7XG4gICAgY29uc3QgYm9keSA9IGVsLmNyZWF0ZURpdih7IGNsczogJ2hlbGVuaXRlLWthbmJhbi1jYXJkLXRleHQnIH0pO1xuICAgIHZvaWQgTWFya2Rvd25SZW5kZXJlci5yZW5kZXIodGhpcy5hcHAsIGNhcmQudGV4dCwgYm9keSwgdGhpcy5maWxlPy5wYXRoID8/ICcnLCB0aGlzKTtcbiAgICBib2R5LmFkZEV2ZW50TGlzdGVuZXIoJ2RibGNsaWNrJywgKCkgPT4gdm9pZCB0aGlzLmVkaXRDYXJkKGNhcmQpKTtcbiAgICB1aS5tb3JlQnV0dG9uKGVsLCAoKSA9PiB0aGlzLmNhcmRNZW51KGNhcmQsIGxhbmUpLCAnQ2FyZCBvcHRpb25zJyk7XG4gIH1cblxuICAvKiogQ2FyZHMgY2FuIGJlIGRyb3BwZWQgYW55d2hlcmUgaW4gYSBsYW5lOyB0aGUgZHJvcCBwb3NpdGlvbiBpcyB0aGUgZmlyc3QgY2FyZCB3aG9zZSBtaWRkbGUgaXMgYmVsb3cgdGhlIHBvaW50ZXIuICovXG4gIHByaXZhdGUgd2lyZURyb3AoY2FyZHM6IEhUTUxFbGVtZW50LCBsYW5lOiBMYW5lKTogdm9pZCB7XG4gICAgY2FyZHMuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ292ZXInLCAoZSkgPT4ge1xuICAgICAgaWYgKCF0aGlzLmRyYWdJZCkgcmV0dXJuO1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgY2FyZHMuYWRkQ2xhc3MoJ2lzLWRyb3AtdGFyZ2V0Jyk7XG4gICAgfSk7XG4gICAgY2FyZHMuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ2xlYXZlJywgKCkgPT4gY2FyZHMucmVtb3ZlQ2xhc3MoJ2lzLWRyb3AtdGFyZ2V0JykpO1xuICAgIGNhcmRzLmFkZEV2ZW50TGlzdGVuZXIoJ2Ryb3AnLCAoZSkgPT4ge1xuICAgICAgY2FyZHMucmVtb3ZlQ2xhc3MoJ2lzLWRyb3AtdGFyZ2V0Jyk7XG4gICAgICBjb25zdCBpZCA9IHRoaXMuZHJhZ0lkID8/IGUuZGF0YVRyYW5zZmVyPy5nZXREYXRhKCd0ZXh0L3BsYWluJyk7XG4gICAgICBpZiAoIWlkKSByZXR1cm47XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBjb25zdCBpdGVtcyA9IEFycmF5LmZyb20oY2FyZHMucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4oJy5oZWxlbml0ZS1rYW5iYW4tY2FyZCcpKTtcbiAgICAgIGxldCB0byA9IGl0ZW1zLmZpbmRJbmRleCgoYykgPT4ge1xuICAgICAgICBjb25zdCByID0gYy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICAgICAgcmV0dXJuIGUuY2xpZW50WSA8IHIudG9wICsgci5oZWlnaHQgLyAyO1xuICAgICAgfSk7XG4gICAgICBpZiAodG8gPCAwKSB0byA9IGl0ZW1zLmxlbmd0aDtcbiAgICAgIHRoaXMudXBkYXRlKG9wcy5tb3ZlQ2FyZCh0aGlzLmJvYXJkLCBpZCwgbGFuZS5pZCwgdG8pKTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgbGFuZU1lbnUobGFuZTogTGFuZSwgaW5kZXg6IG51bWJlcik6IE1lbnVJdGVtU3BlY1tdIHtcbiAgICBjb25zdCBsYXN0ID0gdGhpcy5ib2FyZC5sYW5lcy5sZW5ndGggLSAxO1xuICAgIHJldHVybiBbXG4gICAgICB7IHRpdGxlOiAnUmVuYW1lIGxpc3QnLCBpY29uOiAncGVuY2lsJywgb25DbGljazogKCkgPT4gdGhpcy5yZW5hbWVMYW5lKGxhbmUpIH0sXG4gICAgICB7IHRpdGxlOiAnQWRkIGEgY2FyZCBhdCB0aGUgdG9wJywgaWNvbjogJ3BsdXMnLCBvbkNsaWNrOiAoKSA9PiB0aGlzLmFkZENhcmQobGFuZSwgMCkgfSxcbiAgICAgIHsgdGl0bGU6ICdTZXQgY2FyZCBsaW1pdCcsIGljb246ICdoYXNoJywgb25DbGljazogKCkgPT4gdGhpcy5zZXRMaW1pdChsYW5lKSB9LFxuICAgICAge1xuICAgICAgICB0aXRsZTogbGFuZS5tYXJrQ29tcGxldGUgPyAnU3RvcCBtYXJraW5nIGNhcmRzIGFzIGRvbmUnIDogJ01hcmsgY2FyZHMgaW4gdGhpcyBsaXN0IGFzIGRvbmUnLFxuICAgICAgICBpY29uOiAnY2hlY2stc3F1YXJlJyxcbiAgICAgICAgb25DbGljazogKCkgPT4gdGhpcy51cGRhdGUob3BzLnNldE1hcmtDb21wbGV0ZSh0aGlzLmJvYXJkLCBsYW5lLmlkLCAhbGFuZS5tYXJrQ29tcGxldGUpKSxcbiAgICAgIH0sXG4gICAgICB7IHRpdGxlOiAnQXJjaGl2ZSBkb25lIGNhcmRzJywgaWNvbjogJ2FyY2hpdmUnLCBkaXNhYmxlZDogIWxhbmUuY2FyZHMuc29tZSgoYykgPT4gYy5jaGVja2VkKSwgb25DbGljazogKCkgPT4gdGhpcy51cGRhdGUob3BzLmFyY2hpdmVEb25lKHRoaXMuYm9hcmQsIGxhbmUuaWQpKSB9LFxuICAgICAgJ3NlcGFyYXRvcicsXG4gICAgICB7IHRpdGxlOiAnTW92ZSBsaXN0IGxlZnQnLCBpY29uOiAnYXJyb3ctbGVmdCcsIGRpc2FibGVkOiBpbmRleCA9PT0gMCwgb25DbGljazogKCkgPT4gdGhpcy51cGRhdGUob3BzLm1vdmVMYW5lKHRoaXMuYm9hcmQsIGxhbmUuaWQsIGluZGV4IC0gMSkpIH0sXG4gICAgICB7IHRpdGxlOiAnTW92ZSBsaXN0IHJpZ2h0JywgaWNvbjogJ2Fycm93LXJpZ2h0JywgZGlzYWJsZWQ6IGluZGV4ID09PSBsYXN0LCBvbkNsaWNrOiAoKSA9PiB0aGlzLnVwZGF0ZShvcHMubW92ZUxhbmUodGhpcy5ib2FyZCwgbGFuZS5pZCwgaW5kZXggKyAxKSkgfSxcbiAgICAgICdzZXBhcmF0b3InLFxuICAgICAgeyB0aXRsZTogJ0RlbGV0ZSBsaXN0JywgaWNvbjogJ3RyYXNoLTInLCBkYW5nZXI6IHRydWUsIG9uQ2xpY2s6ICgpID0+IHRoaXMuZGVsZXRlTGFuZShsYW5lKSB9LFxuICAgIF07XG4gIH1cblxuICBwcml2YXRlIGNhcmRNZW51KGNhcmQ6IENhcmQsIGxhbmU6IExhbmUpOiBNZW51SXRlbVNwZWNbXSB7XG4gICAgY29uc3QgYXQgPSBsYW5lLmNhcmRzLmZpbmRJbmRleCgoYykgPT4gYy5pZCA9PT0gY2FyZC5pZCk7XG4gICAgcmV0dXJuIFtcbiAgICAgIHsgdGl0bGU6ICdFZGl0IGNhcmQnLCBpY29uOiAncGVuY2lsJywgb25DbGljazogKCkgPT4gdGhpcy5lZGl0Q2FyZChjYXJkKSB9LFxuICAgICAgeyB0aXRsZTogJ01vdmUgY2FyZCB0byBsaXN0JywgaWNvbjogJ2Fycm93LXJpZ2h0LWxlZnQnLCBkaXNhYmxlZDogdGhpcy5ib2FyZC5sYW5lcy5sZW5ndGggPCAyLCBvbkNsaWNrOiAoKSA9PiB0aGlzLm1vdmVUb0xhbmUoY2FyZCwgbGFuZSkgfSxcbiAgICAgIHsgdGl0bGU6ICdNb3ZlIHRvIHRvcCcsIGljb246ICdhcnJvdy11cC10by1saW5lJywgZGlzYWJsZWQ6IGF0ID09PSAwLCBvbkNsaWNrOiAoKSA9PiB0aGlzLnVwZGF0ZShvcHMubW92ZUNhcmQodGhpcy5ib2FyZCwgY2FyZC5pZCwgbGFuZS5pZCwgMCkpIH0sXG4gICAgICB7IHRpdGxlOiAnTW92ZSB0byBib3R0b20nLCBpY29uOiAnYXJyb3ctZG93bi10by1saW5lJywgZGlzYWJsZWQ6IGF0ID09PSBsYW5lLmNhcmRzLmxlbmd0aCAtIDEsIG9uQ2xpY2s6ICgpID0+IHRoaXMudXBkYXRlKG9wcy5tb3ZlQ2FyZCh0aGlzLmJvYXJkLCBjYXJkLmlkLCBsYW5lLmlkLCBsYW5lLmNhcmRzLmxlbmd0aCkpIH0sXG4gICAgICAnc2VwYXJhdG9yJyxcbiAgICAgIHsgdGl0bGU6ICdBcmNoaXZlIGNhcmQnLCBpY29uOiAnYXJjaGl2ZScsIG9uQ2xpY2s6ICgpID0+IHRoaXMudXBkYXRlKG9wcy5hcmNoaXZlQ2FyZCh0aGlzLmJvYXJkLCBjYXJkLmlkKSkgfSxcbiAgICAgIHsgdGl0bGU6ICdEZWxldGUgY2FyZCcsIGljb246ICd0cmFzaC0yJywgZGFuZ2VyOiB0cnVlLCBvbkNsaWNrOiAoKSA9PiB0aGlzLmRlbGV0ZUNhcmQoY2FyZCkgfSxcbiAgICBdO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBhZGRMYW5lKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHRpdGxlID0gYXdhaXQgdWkucHJvbXB0KHRoaXMuYXBwLCB7IHRpdGxlOiAnQWRkIGxpc3QnLCBsYWJlbDogJ05hbWUnLCBwbGFjZWhvbGRlcjogJ1RvIGRvJywgYWN0aW9uOiAnQWRkIGxpc3QnLCB2YWxpZGF0ZTogcmVxdWlyZWQoJ25hbWUnKSB9KTtcbiAgICBpZiAodGl0bGUpIHRoaXMudXBkYXRlKG9wcy5hZGRMYW5lKHRoaXMuYm9hcmQsIHRpdGxlKSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHJlbmFtZUxhbmUobGFuZTogTGFuZSk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHRpdGxlID0gYXdhaXQgdWkucHJvbXB0KHRoaXMuYXBwLCB7IHRpdGxlOiAnUmVuYW1lIGxpc3QnLCBsYWJlbDogJ05hbWUnLCB2YWx1ZTogbGFuZS50aXRsZSwgYWN0aW9uOiAnUmVuYW1lJywgdmFsaWRhdGU6IHJlcXVpcmVkKCduYW1lJykgfSk7XG4gICAgaWYgKHRpdGxlICYmIHRpdGxlLnRyaW0oKSAhPT0gbGFuZS50aXRsZSkgdGhpcy51cGRhdGUob3BzLnJlbmFtZUxhbmUodGhpcy5ib2FyZCwgbGFuZS5pZCwgdGl0bGUpKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgc2V0TGltaXQobGFuZTogTGFuZSk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHYgPSBhd2FpdCB1aS5wcm9tcHQodGhpcy5hcHAsIHtcbiAgICAgIHRpdGxlOiAnU2V0IGNhcmQgbGltaXQnLFxuICAgICAgbGFiZWw6ICdNb3N0IGNhcmRzIGluIHRoaXMgbGlzdCAoMCBmb3Igbm8gbGltaXQpJyxcbiAgICAgIHZhbHVlOiBTdHJpbmcobGFuZS5tYXhJdGVtcyksXG4gICAgICBhY3Rpb246ICdTZXQgbGltaXQnLFxuICAgICAgdmFsaWRhdGU6IChzKSA9PiAoL15cXGQrJC8udGVzdChzLnRyaW0oKSkgPyBudWxsIDogJ0VudGVyIGEgd2hvbGUgbnVtYmVyLicpLFxuICAgIH0pO1xuICAgIGlmICh2ICE9PSBudWxsKSB0aGlzLnVwZGF0ZShvcHMuc2V0TWF4SXRlbXModGhpcy5ib2FyZCwgbGFuZS5pZCwgTnVtYmVyKHYudHJpbSgpKSkpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBkZWxldGVMYW5lKGxhbmU6IExhbmUpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBuID0gbGFuZS5jYXJkcy5sZW5ndGg7XG4gICAgY29uc3Qgb2sgPSBhd2FpdCB1aS5jb25maXJtKHRoaXMuYXBwLCB7XG4gICAgICB0aXRsZTogJ0RlbGV0ZSBsaXN0JyxcbiAgICAgIG1lc3NhZ2U6IGBEZWxldGUgJHtsYW5lLnRpdGxlIHx8ICd0aGlzIGxpc3QnfSR7biA/IGAgYW5kIGl0cyAke259IGNhcmQke24gPT09IDEgPyAnJyA6ICdzJ31gIDogJyd9PyBUaGlzIGNhbm5vdCBiZSB1bmRvbmUuYCxcbiAgICAgIGFjdGlvbjogJ0RlbGV0ZScsXG4gICAgICBkYW5nZXI6IHRydWUsXG4gICAgfSk7XG4gICAgaWYgKG9rKSB0aGlzLnVwZGF0ZShvcHMuZGVsZXRlTGFuZSh0aGlzLmJvYXJkLCBsYW5lLmlkKSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGFkZENhcmQobGFuZTogTGFuZSwgYXQ/OiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCB0ZXh0ID0gYXdhaXQgdWkucHJvbXB0KHRoaXMuYXBwLCB7IHRpdGxlOiAnQWRkIGNhcmQnLCBsYWJlbDogJ0NhcmQnLCBwbGFjZWhvbGRlcjogJ1doYXQgbmVlZHMgZG9pbmc/JywgYWN0aW9uOiAnQWRkIGNhcmQnLCB2YWxpZGF0ZTogcmVxdWlyZWQoJ2NhcmQnKSB9KTtcbiAgICBpZiAodGV4dCkgdGhpcy51cGRhdGUob3BzLmFkZENhcmQodGhpcy5ib2FyZCwgbGFuZS5pZCwgZnJvbVByb21wdCh0ZXh0KSwgYXQpKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgZWRpdENhcmQoY2FyZDogQ2FyZCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHRleHQgPSBhd2FpdCB1aS5wcm9tcHQodGhpcy5hcHAsIHsgdGl0bGU6ICdFZGl0IGNhcmQnLCBsYWJlbDogJ0NhcmQgKDxicj4gc3RhcnRzIGEgbmV3IGxpbmUpJywgdmFsdWU6IHRvUHJvbXB0KGNhcmQudGV4dCksIGFjdGlvbjogJ1NhdmUnLCB2YWxpZGF0ZTogcmVxdWlyZWQoJ2NhcmQnKSB9KTtcbiAgICBpZiAodGV4dCAhPT0gbnVsbCAmJiBmcm9tUHJvbXB0KHRleHQpLnRyaW0oKSAhPT0gY2FyZC50ZXh0KSB0aGlzLnVwZGF0ZShvcHMuZWRpdENhcmQodGhpcy5ib2FyZCwgY2FyZC5pZCwgZnJvbVByb21wdCh0ZXh0KSkpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBkZWxldGVDYXJkKGNhcmQ6IENhcmQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBvayA9IGF3YWl0IHVpLmNvbmZpcm0odGhpcy5hcHAsIHsgdGl0bGU6ICdEZWxldGUgY2FyZCcsIG1lc3NhZ2U6IGBEZWxldGUgXCIke2ZpcnN0TGluZShjYXJkLnRleHQpfVwiPyBUaGlzIGNhbm5vdCBiZSB1bmRvbmUuYCwgYWN0aW9uOiAnRGVsZXRlJywgZGFuZ2VyOiB0cnVlIH0pO1xuICAgIGlmIChvaykgdGhpcy51cGRhdGUob3BzLmRlbGV0ZUNhcmQodGhpcy5ib2FyZCwgY2FyZC5pZCkpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBtb3ZlVG9MYW5lKGNhcmQ6IENhcmQsIGZyb206IExhbmUpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBvcHRpb25zID0gdGhpcy5ib2FyZC5sYW5lcy5tYXAoKGwpID0+ICh7IHZhbHVlOiBsLmlkLCB0ZXh0OiBsLnRpdGxlIHx8ICdVbnRpdGxlZCBsaXN0JywgZGlzYWJsZWQ6IGwuaWQgPT09IGZyb20uaWQgfSkpO1xuICAgIGNvbnN0IHRvID0gYXdhaXQgdWkuY2hvb3NlKHRoaXMuYXBwLCB7IHRpdGxlOiAnTW92ZSBjYXJkIHRvIGxpc3QnLCBvcHRpb25zIH0pO1xuICAgIGlmICh0bykgdGhpcy51cGRhdGUob3BzLm1vdmVDYXJkKHRoaXMuYm9hcmQsIGNhcmQuaWQsIHRvLCBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUikpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyByZXN0b3JlRnJvbUFyY2hpdmUoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgZmlyc3QgPSB0aGlzLmJvYXJkLmxhbmVzWzBdO1xuICAgIGlmICghZmlyc3QpIHtcbiAgICAgIHVpLm5vdGljZSgnQWRkIGEgbGlzdCBmaXJzdCwgdGhlbiByZXN0b3JlIGNhcmRzIGludG8gaXQuJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IGlkID0gYXdhaXQgdWkuY2hvb3NlKHRoaXMuYXBwLCB7XG4gICAgICB0aXRsZTogYFJlc3RvcmUgYSBjYXJkIHRvICR7Zmlyc3QudGl0bGUgfHwgJ3RoZSBmaXJzdCBsaXN0J31gLFxuICAgICAgb3B0aW9uczogdGhpcy5ib2FyZC5hcmNoaXZlLm1hcCgoYykgPT4gKHsgdmFsdWU6IGMuaWQsIHRleHQ6IGZpcnN0TGluZShjLnRleHQpIH0pKSxcbiAgICB9KTtcbiAgICBpZiAoIWlkKSByZXR1cm47XG4gICAgdGhpcy51cGRhdGUob3BzLnJlc3RvcmVDYXJkKHRoaXMuYm9hcmQsIGlkLCBmaXJzdC5pZCkpO1xuICAgIHVpLm5vdGljZSgnQ2FyZCByZXN0b3JlZCcsIHsga2luZDogJ3N1Y2Nlc3MnIH0pO1xuICB9XG59XG4iLCAiLy8gQm9hcmQgZWRpdHMuIEVhY2ggdGFrZXMgYSBib2FyZCBhbmQgcmV0dXJucyBhIG5ldyBvbmU7IHRoZSBpbnB1dCBpcyBsZWZ0IGFzIGl0IHdhcy4gUHVyZSwgc28gdGhlIHZpZXcgc3RheXMgdGhpbi5cbmltcG9ydCB7IG5ld0lkLCB0eXBlIEJvYXJkLCB0eXBlIENhcmQsIHR5cGUgTGFuZSB9IGZyb20gJy4vYm9hcmQnO1xuXG5jb25zdCBjbG9uZSA9IChiOiBCb2FyZCk6IEJvYXJkID0+IHN0cnVjdHVyZWRDbG9uZShiKTtcblxuZnVuY3Rpb24gZmluZENhcmQoYjogQm9hcmQsIGNhcmRJZDogc3RyaW5nKTogeyBsaXN0OiBDYXJkW107IGluZGV4OiBudW1iZXI7IGxhbmU6IExhbmUgfCBudWxsIH0gfCBudWxsIHtcbiAgZm9yIChjb25zdCBsYW5lIG9mIGIubGFuZXMpIHtcbiAgICBjb25zdCBpbmRleCA9IGxhbmUuY2FyZHMuZmluZEluZGV4KChjKSA9PiBjLmlkID09PSBjYXJkSWQpO1xuICAgIGlmIChpbmRleCA+PSAwKSByZXR1cm4geyBsaXN0OiBsYW5lLmNhcmRzLCBpbmRleCwgbGFuZSB9O1xuICB9XG4gIGNvbnN0IGluZGV4ID0gYi5hcmNoaXZlLmZpbmRJbmRleCgoYykgPT4gYy5pZCA9PT0gY2FyZElkKTtcbiAgcmV0dXJuIGluZGV4ID49IDAgPyB7IGxpc3Q6IGIuYXJjaGl2ZSwgaW5kZXgsIGxhbmU6IG51bGwgfSA6IG51bGw7XG59XG5cbmNvbnN0IGxhbmVJbmRleCA9IChiOiBCb2FyZCwgbGFuZUlkOiBzdHJpbmcpOiBudW1iZXIgPT4gYi5sYW5lcy5maW5kSW5kZXgoKGwpID0+IGwuaWQgPT09IGxhbmVJZCk7XG5jb25zdCBjbGFtcCA9IChuOiBudW1iZXIsIGxvOiBudW1iZXIsIGhpOiBudW1iZXIpOiBudW1iZXIgPT4gTWF0aC5tYXgobG8sIE1hdGgubWluKGhpLCBuKSk7XG5cbmZ1bmN0aW9uIHNldERvbmUoY2FyZDogQ2FyZCwgZG9uZTogYm9vbGVhbik6IHZvaWQge1xuICBjYXJkLmNoZWNrZWQgPSBkb25lO1xuICBjYXJkLmNoZWNrQ2hhciA9IGRvbmUgPyAoY2FyZC5jaGVja0NoYXIgIT09ICcgJyA/IGNhcmQuY2hlY2tDaGFyIDogJ3gnKSA6ICcgJztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFkZExhbmUoYm9hcmQ6IEJvYXJkLCB0aXRsZTogc3RyaW5nLCBhdCA9IGJvYXJkLmxhbmVzLmxlbmd0aCk6IEJvYXJkIHtcbiAgY29uc3QgYiA9IGNsb25lKGJvYXJkKTtcbiAgYi5sYW5lcy5zcGxpY2UoY2xhbXAoYXQsIDAsIGIubGFuZXMubGVuZ3RoKSwgMCwgeyBpZDogbmV3SWQoJ2wnKSwgdGl0bGU6IHRpdGxlLnRyaW0oKSwgbWF4SXRlbXM6IDAsIG1hcmtDb21wbGV0ZTogZmFsc2UsIGNhcmRzOiBbXSB9KTtcbiAgcmV0dXJuIGI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZW5hbWVMYW5lKGJvYXJkOiBCb2FyZCwgbGFuZUlkOiBzdHJpbmcsIHRpdGxlOiBzdHJpbmcpOiBCb2FyZCB7XG4gIGNvbnN0IGIgPSBjbG9uZShib2FyZCk7XG4gIGNvbnN0IGxhbmUgPSBiLmxhbmVzW2xhbmVJbmRleChiLCBsYW5lSWQpXTtcbiAgaWYgKGxhbmUpIGxhbmUudGl0bGUgPSB0aXRsZS50cmltKCk7XG4gIHJldHVybiBiO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVsZXRlTGFuZShib2FyZDogQm9hcmQsIGxhbmVJZDogc3RyaW5nKTogQm9hcmQge1xuICBjb25zdCBiID0gY2xvbmUoYm9hcmQpO1xuICBiLmxhbmVzID0gYi5sYW5lcy5maWx0ZXIoKGwpID0+IGwuaWQgIT09IGxhbmVJZCk7XG4gIHJldHVybiBiO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbW92ZUxhbmUoYm9hcmQ6IEJvYXJkLCBsYW5lSWQ6IHN0cmluZywgdG86IG51bWJlcik6IEJvYXJkIHtcbiAgY29uc3QgYiA9IGNsb25lKGJvYXJkKTtcbiAgY29uc3QgZnJvbSA9IGxhbmVJbmRleChiLCBsYW5lSWQpO1xuICBpZiAoZnJvbSA8IDApIHJldHVybiBiO1xuICBjb25zdCBbbGFuZV0gPSBiLmxhbmVzLnNwbGljZShmcm9tLCAxKTtcbiAgYi5sYW5lcy5zcGxpY2UoY2xhbXAodG8sIDAsIGIubGFuZXMubGVuZ3RoKSwgMCwgbGFuZSk7XG4gIHJldHVybiBiO1xufVxuXG4vKiogVHVybiBcIk1hcmsgY2FyZHMgaW4gdGhpcyBsaXN0IGFzIGNvbXBsZXRlXCIgb24gb3Igb2ZmLiBUdXJuaW5nIGl0IG9uIGNoZWNrcyBvZmYgdGhlIGNhcmRzIGFscmVhZHkgdGhlcmUuICovXG5leHBvcnQgZnVuY3Rpb24gc2V0TWFya0NvbXBsZXRlKGJvYXJkOiBCb2FyZCwgbGFuZUlkOiBzdHJpbmcsIG9uOiBib29sZWFuKTogQm9hcmQge1xuICBjb25zdCBiID0gY2xvbmUoYm9hcmQpO1xuICBjb25zdCBsYW5lID0gYi5sYW5lc1tsYW5lSW5kZXgoYiwgbGFuZUlkKV07XG4gIGlmICghbGFuZSkgcmV0dXJuIGI7XG4gIGxhbmUubWFya0NvbXBsZXRlID0gb247XG4gIGlmIChvbikgbGFuZS5jYXJkcy5mb3JFYWNoKChjKSA9PiBzZXREb25lKGMsIHRydWUpKTtcbiAgcmV0dXJuIGI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXRNYXhJdGVtcyhib2FyZDogQm9hcmQsIGxhbmVJZDogc3RyaW5nLCBtYXg6IG51bWJlcik6IEJvYXJkIHtcbiAgY29uc3QgYiA9IGNsb25lKGJvYXJkKTtcbiAgY29uc3QgbGFuZSA9IGIubGFuZXNbbGFuZUluZGV4KGIsIGxhbmVJZCldO1xuICBpZiAobGFuZSkgbGFuZS5tYXhJdGVtcyA9IE1hdGgubWF4KDAsIE1hdGguZmxvb3IobWF4KSB8fCAwKTtcbiAgcmV0dXJuIGI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhZGRDYXJkKGJvYXJkOiBCb2FyZCwgbGFuZUlkOiBzdHJpbmcsIHRleHQ6IHN0cmluZywgYXQ/OiBudW1iZXIpOiBCb2FyZCB7XG4gIGNvbnN0IGIgPSBjbG9uZShib2FyZCk7XG4gIGNvbnN0IGxhbmUgPSBiLmxhbmVzW2xhbmVJbmRleChiLCBsYW5lSWQpXTtcbiAgaWYgKCFsYW5lKSByZXR1cm4gYjtcbiAgY29uc3QgY2FyZDogQ2FyZCA9IHsgaWQ6IG5ld0lkKCdjJyksIHRleHQ6IHRleHQudHJpbSgpLCBjaGVja2VkOiBmYWxzZSwgY2hlY2tDaGFyOiAnICcgfTtcbiAgaWYgKGxhbmUubWFya0NvbXBsZXRlKSBzZXREb25lKGNhcmQsIHRydWUpO1xuICBsYW5lLmNhcmRzLnNwbGljZShjbGFtcChhdCA/PyBsYW5lLmNhcmRzLmxlbmd0aCwgMCwgbGFuZS5jYXJkcy5sZW5ndGgpLCAwLCBjYXJkKTtcbiAgcmV0dXJuIGI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlZGl0Q2FyZChib2FyZDogQm9hcmQsIGNhcmRJZDogc3RyaW5nLCB0ZXh0OiBzdHJpbmcpOiBCb2FyZCB7XG4gIGNvbnN0IGIgPSBjbG9uZShib2FyZCk7XG4gIGNvbnN0IGhpdCA9IGZpbmRDYXJkKGIsIGNhcmRJZCk7XG4gIGlmIChoaXQpIGhpdC5saXN0W2hpdC5pbmRleF0udGV4dCA9IHRleHQudHJpbSgpO1xuICByZXR1cm4gYjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlbGV0ZUNhcmQoYm9hcmQ6IEJvYXJkLCBjYXJkSWQ6IHN0cmluZyk6IEJvYXJkIHtcbiAgY29uc3QgYiA9IGNsb25lKGJvYXJkKTtcbiAgY29uc3QgaGl0ID0gZmluZENhcmQoYiwgY2FyZElkKTtcbiAgaWYgKGhpdCkgaGl0Lmxpc3Quc3BsaWNlKGhpdC5pbmRleCwgMSk7XG4gIHJldHVybiBiO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdG9nZ2xlQ2FyZChib2FyZDogQm9hcmQsIGNhcmRJZDogc3RyaW5nKTogQm9hcmQge1xuICBjb25zdCBiID0gY2xvbmUoYm9hcmQpO1xuICBjb25zdCBoaXQgPSBmaW5kQ2FyZChiLCBjYXJkSWQpO1xuICBpZiAoaGl0KSB7XG4gICAgY29uc3QgY2FyZCA9IGhpdC5saXN0W2hpdC5pbmRleF07XG4gICAgc2V0RG9uZShjYXJkLCAhY2FyZC5jaGVja2VkKTtcbiAgfVxuICByZXR1cm4gYjtcbn1cblxuLyoqIE1vdmUgYSBjYXJkIHRvIGB0b2AgaW4gYW5vdGhlciAob3IgdGhlIHNhbWUpIGxhbmUuIEludG8gYSBcImNvbXBsZXRlXCIgbGFuZSBjaGVja3MgaXQgb2ZmOyBvdXQgb2Ygb25lIHJlb3BlbnMgaXQuICovXG5leHBvcnQgZnVuY3Rpb24gbW92ZUNhcmQoYm9hcmQ6IEJvYXJkLCBjYXJkSWQ6IHN0cmluZywgdG9MYW5lSWQ6IHN0cmluZywgdG86IG51bWJlcik6IEJvYXJkIHtcbiAgY29uc3QgYiA9IGNsb25lKGJvYXJkKTtcbiAgY29uc3QgaGl0ID0gZmluZENhcmQoYiwgY2FyZElkKTtcbiAgY29uc3QgZGVzdCA9IGIubGFuZXNbbGFuZUluZGV4KGIsIHRvTGFuZUlkKV07XG4gIGlmICghaGl0IHx8ICFkZXN0KSByZXR1cm4gYjtcbiAgY29uc3QgW2NhcmRdID0gaGl0Lmxpc3Quc3BsaWNlKGhpdC5pbmRleCwgMSk7XG4gIC8vIERyb3BwaW5nIGJlbG93IGl0c2VsZiBpbiB0aGUgc2FtZSBsYW5lOiB0aGUgcmVtb3ZhbCBzaGlmdGVkIHRoZSB0YXJnZXQgdXAgYnkgb25lLlxuICBjb25zdCBzYW1lID0gaGl0Lmxpc3QgPT09IGRlc3QuY2FyZHM7XG4gIGNvbnN0IGluZGV4ID0gc2FtZSAmJiB0byA+IGhpdC5pbmRleCA/IHRvIC0gMSA6IHRvO1xuICBpZiAoZGVzdC5tYXJrQ29tcGxldGUpIHNldERvbmUoY2FyZCwgdHJ1ZSk7XG4gIGVsc2UgaWYgKGhpdC5sYW5lPy5tYXJrQ29tcGxldGUgJiYgIXNhbWUpIHNldERvbmUoY2FyZCwgZmFsc2UpO1xuICBkZXN0LmNhcmRzLnNwbGljZShjbGFtcChpbmRleCwgMCwgZGVzdC5jYXJkcy5sZW5ndGgpLCAwLCBjYXJkKTtcbiAgcmV0dXJuIGI7XG59XG5cbi8qKiBNb3ZlIGEgY2FyZCB0byB0aGUgYXJjaGl2ZSBzZWN0aW9uICh0aGUgZW5kIG9mIHRoZSBub3RlLCB1bmRlciBgKioqYCBhbmQgYCMjIEFyY2hpdmVgKS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhcmNoaXZlQ2FyZChib2FyZDogQm9hcmQsIGNhcmRJZDogc3RyaW5nKTogQm9hcmQge1xuICBjb25zdCBiID0gY2xvbmUoYm9hcmQpO1xuICBjb25zdCBoaXQgPSBmaW5kQ2FyZChiLCBjYXJkSWQpO1xuICBpZiAoIWhpdCB8fCAhaGl0LmxhbmUpIHJldHVybiBiO1xuICBjb25zdCBbY2FyZF0gPSBoaXQubGlzdC5zcGxpY2UoaGl0LmluZGV4LCAxKTtcbiAgYi5hcmNoaXZlLnB1c2goY2FyZCk7XG4gIHJldHVybiBiO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVzdG9yZUNhcmQoYm9hcmQ6IEJvYXJkLCBjYXJkSWQ6IHN0cmluZywgbGFuZUlkOiBzdHJpbmcpOiBCb2FyZCB7XG4gIGNvbnN0IGIgPSBjbG9uZShib2FyZCk7XG4gIGNvbnN0IGluZGV4ID0gYi5hcmNoaXZlLmZpbmRJbmRleCgoYykgPT4gYy5pZCA9PT0gY2FyZElkKTtcbiAgY29uc3QgbGFuZSA9IGIubGFuZXNbbGFuZUluZGV4KGIsIGxhbmVJZCldO1xuICBpZiAoaW5kZXggPCAwIHx8ICFsYW5lKSByZXR1cm4gYjtcbiAgY29uc3QgW2NhcmRdID0gYi5hcmNoaXZlLnNwbGljZShpbmRleCwgMSk7XG4gIGlmIChsYW5lLm1hcmtDb21wbGV0ZSkgc2V0RG9uZShjYXJkLCB0cnVlKTtcbiAgbGFuZS5jYXJkcy5wdXNoKGNhcmQpO1xuICByZXR1cm4gYjtcbn1cblxuLyoqIEFyY2hpdmUgZXZlcnkgY2hlY2tlZCBjYXJkIGluIGEgbGFuZS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhcmNoaXZlRG9uZShib2FyZDogQm9hcmQsIGxhbmVJZDogc3RyaW5nKTogQm9hcmQge1xuICBjb25zdCBiID0gY2xvbmUoYm9hcmQpO1xuICBjb25zdCBsYW5lID0gYi5sYW5lc1tsYW5lSW5kZXgoYiwgbGFuZUlkKV07XG4gIGlmICghbGFuZSkgcmV0dXJuIGI7XG4gIGIuYXJjaGl2ZS5wdXNoKC4uLmxhbmUuY2FyZHMuZmlsdGVyKChjKSA9PiBjLmNoZWNrZWQpKTtcbiAgbGFuZS5jYXJkcyA9IGxhbmUuY2FyZHMuZmlsdGVyKChjKSA9PiAhYy5jaGVja2VkKTtcbiAgcmV0dXJuIGI7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFFQSxJQUFBQSxtQkFBeUU7QUFDekUsSUFBQUMsbUJBQW1COzs7QUNnQ1osSUFBTSxrQkFBa0I7QUFxQy9CLElBQUksU0FBUztBQUNOLElBQU0sUUFBUSxDQUFDLFdBQTJCLEdBQUcsTUFBTSxHQUFHLEVBQUUsTUFBTTtBQUVyRSxJQUFNLGNBQWM7QUFDcEIsSUFBTSxrQkFBa0I7QUFDeEIsSUFBTSxVQUFVO0FBQ2hCLElBQU0saUJBQWlCO0FBQ3ZCLElBQU0sWUFBWTtBQUNsQixJQUFNLE9BQU87QUFDYixJQUFNLFdBQVc7QUFDakIsSUFBTSxXQUFXO0FBQ2pCLElBQU0sZ0JBQWdCO0FBQ3RCLElBQU0sZ0JBQWdCO0FBR2YsU0FBUyxnQkFBZ0IsSUFBcUI7QUFDbkQsUUFBTSxLQUFLLFlBQVksS0FBSyxFQUFFO0FBQzlCLFNBQU8sQ0FBQyxDQUFDLE1BQU0sVUFBVSxHQUFHLENBQUMsQ0FBQyxNQUFNO0FBQ3RDO0FBR08sU0FBUyxtQkFBbUIsSUFBeUQ7QUFDMUYsUUFBTSxJQUFJLEtBQUssZUFBZTtBQUM5QixTQUFPLE1BQU0sV0FBVyxNQUFNO0FBQ2hDO0FBRUEsU0FBUyxVQUFVLE1BQTZCO0FBQzlDLFFBQU0sSUFBSSw2REFBNkQsS0FBSyxJQUFJO0FBQ2hGLFNBQU8sSUFBSSxFQUFFLENBQUMsSUFBSTtBQUNwQjtBQUdPLFNBQVMsZUFBZSxLQUFrRDtBQUMvRSxRQUFNLE1BQU0sSUFBSSxRQUFRLFNBQVMsSUFBSSxFQUFFLEtBQUs7QUFDNUMsUUFBTSxJQUFJLHNCQUFzQixLQUFLLEdBQUc7QUFDeEMsU0FBTyxJQUFJLEVBQUUsT0FBTyxFQUFFLENBQUMsR0FBRyxVQUFVLE9BQU8sRUFBRSxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsT0FBTyxLQUFLLFVBQVUsRUFBRTtBQUNqRjtBQUVBLFNBQVMsWUFBWSxNQUFvQjtBQUN2QyxRQUFNLElBQUksS0FBSyxXQUFXLEdBQUcsS0FBSyxLQUFLLEtBQUssS0FBSyxRQUFRLE1BQU0sS0FBSztBQUNwRSxTQUFPLEVBQUUsS0FBSyxFQUFFLFFBQVEsVUFBVSxNQUFNO0FBQzFDO0FBR0EsU0FBUyxPQUFPLE9BQWUsTUFBc0I7QUFDbkQsTUFBSSxZQUFZO0FBQ2hCLE1BQUksT0FBTztBQUNYLFFBQU0sT0FBTyxLQUFLLEtBQUssS0FBSztBQUM1QixNQUFJLE1BQU07QUFDUixnQkFBWSxLQUFLLENBQUM7QUFDbEIsV0FBTyxLQUFLLENBQUMsS0FBSztBQUFBLEVBQ3BCO0FBRUEsTUFBSSxPQUFPLENBQUMsTUFBTSxHQUFHLElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxLQUFLLEVBQUUsUUFBUSxxQkFBcUIsSUFBSSxFQUFFLFFBQVEsU0FBUyxJQUFJLEVBQUUsS0FBSztBQUM1RyxRQUFNLFFBQVEsS0FBSyxNQUFNLElBQUk7QUFDN0IsTUFBSTtBQUNKLFFBQU0sTUFBTSxTQUFTLEtBQUssTUFBTSxDQUFDLENBQUM7QUFDbEMsTUFBSSxLQUFLO0FBQ1AsY0FBVSxJQUFJLENBQUM7QUFDZixVQUFNLENBQUMsSUFBSSxNQUFNLENBQUMsRUFBRSxNQUFNLEdBQUcsSUFBSSxLQUFLO0FBQ3RDLFdBQU8sTUFBTSxLQUFLLElBQUk7QUFBQSxFQUN4QjtBQUNBLFFBQU0sT0FBYSxFQUFFLElBQUksTUFBTSxHQUFHLEdBQUcsTUFBTSxTQUFTLGNBQWMsS0FBSyxVQUFVO0FBQ2pGLE1BQUksUUFBUyxNQUFLLFVBQVU7QUFDNUIsU0FBTztBQUNUO0FBSU8sU0FBUyxXQUFXLElBQW1CO0FBQzVDLE1BQUksT0FBTztBQUNYLE1BQUksY0FBYztBQUNsQixRQUFNLEtBQUssWUFBWSxLQUFLLEVBQUU7QUFDOUIsTUFBSSxJQUFJO0FBQ04sa0JBQWMsR0FBRyxDQUFDLEVBQUUsS0FBSztBQUN6QixXQUFPLEdBQUcsTUFBTSxHQUFHLENBQUMsRUFBRSxNQUFNO0FBQUEsRUFDOUI7QUFFQSxNQUFJLFdBQW9DLENBQUM7QUFDekMsUUFBTSxTQUFTLGdCQUFnQixLQUFLLElBQUk7QUFDeEMsTUFBSSxRQUFRO0FBQ1YsUUFBSTtBQUNGLFlBQU0sU0FBUyxLQUFLLE1BQU0sT0FBTyxDQUFDLEVBQUUsS0FBSyxDQUFDO0FBQzFDLFVBQUksVUFBVSxPQUFPLFdBQVcsWUFBWSxDQUFDLE1BQU0sUUFBUSxNQUFNLEVBQUcsWUFBVztBQUFBLElBQ2pGLFFBQVE7QUFBQSxJQUVSO0FBQ0EsV0FBTyxLQUFLLE1BQU0sR0FBRyxPQUFPLEtBQUs7QUFBQSxFQUNuQztBQUNBLFFBQU0sT0FBTyxVQUFVLFdBQVc7QUFDbEMsTUFBSSxLQUFNLFVBQVMsZUFBZSxJQUFJLFNBQVMsVUFBVSxVQUFVO0FBRW5FLFFBQU0sUUFBZSxFQUFFLGFBQWEsT0FBTyxDQUFDLEdBQUcsU0FBUyxDQUFDLEdBQUcsU0FBUztBQUNyRSxNQUFJLFNBQXdCO0FBQzVCLE1BQUksT0FBb0I7QUFDeEIsTUFBSSxhQUFhO0FBQ2pCLE1BQUksT0FBaUU7QUFFckUsUUFBTSxRQUFRLE1BQU07QUFDbEIsUUFBSSxRQUFRLE9BQVEsUUFBTyxLQUFLLE9BQU8sS0FBSyxPQUFPLEtBQUssSUFBSSxDQUFDO0FBQzdELFdBQU87QUFBQSxFQUNUO0FBRUEsYUFBVyxRQUFRLEtBQUssTUFBTSxPQUFPLEdBQUc7QUFDdEMsVUFBTSxVQUFVLFFBQVEsS0FBSyxJQUFJO0FBQ2pDLFFBQUksU0FBUztBQUNYLFlBQU07QUFDTixVQUFJLFlBQVk7QUFDZCxpQkFBUyxNQUFNO0FBQ2YsZUFBTztBQUFBLE1BQ1QsT0FBTztBQUNMLGVBQU8sRUFBRSxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsZUFBZSxRQUFRLENBQUMsQ0FBQyxHQUFHLGNBQWMsT0FBTyxPQUFPLENBQUMsRUFBRTtBQUN2RixjQUFNLE1BQU0sS0FBSyxJQUFJO0FBQ3JCLGlCQUFTLEtBQUs7QUFBQSxNQUNoQjtBQUNBLG1CQUFhO0FBQ2I7QUFBQSxJQUNGO0FBQ0EsUUFBSSxlQUFlLEtBQUssSUFBSSxLQUFLLEVBQUUsUUFBUSxNQUFNLEtBQUssSUFBSSxJQUFJO0FBQzVELFlBQU07QUFDTixtQkFBYTtBQUNiO0FBQUEsSUFDRjtBQUNBLFFBQUksQ0FBQyxLQUFLLEtBQUssR0FBRztBQUNoQixVQUFJLEtBQU0sTUFBSztBQUNmO0FBQUEsSUFDRjtBQUNBLFVBQU0sS0FBSyxVQUFVLEtBQUssSUFBSTtBQUM5QixRQUFJLE1BQU0sUUFBUTtBQUNoQixZQUFNO0FBQ04sYUFBTyxFQUFFLE9BQU8sR0FBRyxDQUFDLEtBQUssSUFBSSxNQUFNLENBQUMsR0FBRyxRQUFRLEVBQUU7QUFDakQsbUJBQWE7QUFDYjtBQUFBLElBQ0Y7QUFDQSxRQUFJLFNBQVMsTUFBTSxLQUFLLElBQUksS0FBSyxLQUFLLFdBQVcsSUFBSTtBQUVuRCxhQUFPLEtBQUssU0FBUyxHQUFHLEtBQUssU0FBVSxNQUFLLEtBQUssS0FBSyxFQUFFO0FBQ3hELFdBQUssS0FBSyxLQUFLLElBQUk7QUFDbkI7QUFBQSxJQUNGO0FBQ0EsVUFBTTtBQUNOLGlCQUFhO0FBQ2IsUUFBSSxRQUFRLEtBQUssS0FBSyxNQUFNLFlBQVksS0FBSyxNQUFNLFdBQVcsRUFBRyxNQUFLLGVBQWU7QUFBQSxFQUN2RjtBQUNBLFFBQU07QUFDTixTQUFPO0FBQ1Q7QUFFQSxTQUFTLFNBQVMsTUFBWSxRQUF3QjtBQUNwRCxRQUFNLFFBQVEsS0FBSyxLQUFLLEtBQUssRUFBRSxRQUFRLFVBQVU7QUFBQSxFQUFLLE1BQU0sRUFBRSxFQUFFLE1BQU0sSUFBSTtBQUMxRSxNQUFJLEtBQUssUUFBUyxPQUFNLENBQUMsS0FBSyxLQUFLLEtBQUssT0FBTztBQUMvQyxTQUFPLE1BQU0sS0FBSyxTQUFTLEtBQUssTUFBTSxLQUFLLElBQUksQ0FBQztBQUNsRDtBQUdPLFNBQVMsZUFBZSxPQUFjLElBQXNCLENBQUMsR0FBVztBQUM3RSxRQUFNLFNBQVMsRUFBRSxXQUFXLFFBQVEsU0FBUztBQUM3QyxRQUFNLE9BQU8sTUFBTSxZQUFZLEtBQUssS0FBSyxHQUFHLGVBQWU7QUFDM0QsTUFBSSxNQUFNLENBQUMsT0FBTyxJQUFJLEdBQUcsSUFBSTtBQUFBLEdBQU0sT0FBTyxJQUFJLEVBQUUsRUFBRSxLQUFLLElBQUk7QUFDM0QsYUFBVyxRQUFRLE1BQU0sT0FBTztBQUM5QixVQUFNLFFBQVEsQ0FBQyxNQUFNLFlBQVksSUFBSSxDQUFDLElBQUksRUFBRTtBQUM1QyxRQUFJLEtBQUssYUFBYyxPQUFNLEtBQUssUUFBUTtBQUMxQyxlQUFXLEtBQUssS0FBSyxNQUFPLE9BQU0sS0FBSyxTQUFTLEdBQUcsTUFBTSxDQUFDO0FBQzFELFVBQU0sS0FBSyxJQUFJLElBQUksRUFBRTtBQUNyQixXQUFPLE1BQU0sS0FBSyxJQUFJO0FBQUEsRUFDeEI7QUFDQSxNQUFJLE1BQU0sUUFBUSxRQUFRO0FBQ3hCLFdBQU8sQ0FBQyxlQUFlLElBQUksTUFBTSxhQUFhLElBQUksSUFBSSxHQUFHLE1BQU0sUUFBUSxJQUFJLENBQUMsTUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLENBQUMsRUFBRSxLQUFLLElBQUk7QUFBQSxFQUNuSDtBQUNBLFFBQU0sV0FBVyxFQUFFLEdBQUcsTUFBTSxTQUFTO0FBQ3JDLE1BQUksRUFBRSxtQkFBbUIsVUFBVyxVQUFTLGVBQWUsSUFBSSxVQUFVLElBQUksS0FBSztBQUNuRixTQUFPLENBQUMsSUFBSSxJQUFJLHNCQUFzQixPQUFPLEtBQUssVUFBVSxRQUFRLEdBQUcsT0FBTyxJQUFJLEVBQUUsS0FBSyxJQUFJO0FBQzdGLFNBQU87QUFDVDtBQUdPLFNBQVMsaUJBQWlCLFFBQWtCLENBQUMsU0FBUyxTQUFTLE1BQU0sR0FBVztBQUNyRixTQUFPLGVBQWU7QUFBQSxJQUNwQixhQUFhLEdBQUcsZUFBZTtBQUFBLElBQy9CLE9BQU8sTUFBTSxJQUFJLENBQUMsT0FBTyxPQUFPLEVBQUUsSUFBSSxNQUFNLEdBQUcsR0FBRyxPQUFPLFVBQVUsR0FBRyxjQUFjLE1BQU0sTUFBTSxTQUFTLEtBQUssTUFBTSxTQUFTLEdBQUcsT0FBTyxDQUFDLEVBQUUsRUFBRTtBQUFBLElBQzVJLFNBQVMsQ0FBQztBQUFBLElBQ1YsVUFBVSxFQUFFLENBQUMsZUFBZSxHQUFHLFFBQVE7QUFBQSxFQUN6QyxDQUFDO0FBQ0g7OztBQzlQQSxzQkFBbUU7QUFDbkUsc0JBQXNDOzs7QUNDdEMsSUFBTSxRQUFRLENBQUMsTUFBb0IsZ0JBQWdCLENBQUM7QUFFcEQsU0FBUyxTQUFTLEdBQVUsUUFBMkU7QUFDckcsYUFBVyxRQUFRLEVBQUUsT0FBTztBQUMxQixVQUFNQyxTQUFRLEtBQUssTUFBTSxVQUFVLENBQUMsTUFBTSxFQUFFLE9BQU8sTUFBTTtBQUN6RCxRQUFJQSxVQUFTLEVBQUcsUUFBTyxFQUFFLE1BQU0sS0FBSyxPQUFPLE9BQUFBLFFBQU8sS0FBSztBQUFBLEVBQ3pEO0FBQ0EsUUFBTSxRQUFRLEVBQUUsUUFBUSxVQUFVLENBQUMsTUFBTSxFQUFFLE9BQU8sTUFBTTtBQUN4RCxTQUFPLFNBQVMsSUFBSSxFQUFFLE1BQU0sRUFBRSxTQUFTLE9BQU8sTUFBTSxLQUFLLElBQUk7QUFDL0Q7QUFFQSxJQUFNLFlBQVksQ0FBQyxHQUFVLFdBQTJCLEVBQUUsTUFBTSxVQUFVLENBQUMsTUFBTSxFQUFFLE9BQU8sTUFBTTtBQUNoRyxJQUFNLFFBQVEsQ0FBQyxHQUFXLElBQVksT0FBdUIsS0FBSyxJQUFJLElBQUksS0FBSyxJQUFJLElBQUksQ0FBQyxDQUFDO0FBRXpGLFNBQVMsUUFBUSxNQUFZLE1BQXFCO0FBQ2hELE9BQUssVUFBVTtBQUNmLE9BQUssWUFBWSxPQUFRLEtBQUssY0FBYyxNQUFNLEtBQUssWUFBWSxNQUFPO0FBQzVFO0FBRU8sU0FBUyxRQUFRLE9BQWMsT0FBZSxLQUFLLE1BQU0sTUFBTSxRQUFlO0FBQ25GLFFBQU0sSUFBSSxNQUFNLEtBQUs7QUFDckIsSUFBRSxNQUFNLE9BQU8sTUFBTSxJQUFJLEdBQUcsRUFBRSxNQUFNLE1BQU0sR0FBRyxHQUFHLEVBQUUsSUFBSSxNQUFNLEdBQUcsR0FBRyxPQUFPLE1BQU0sS0FBSyxHQUFHLFVBQVUsR0FBRyxjQUFjLE9BQU8sT0FBTyxDQUFDLEVBQUUsQ0FBQztBQUNwSSxTQUFPO0FBQ1Q7QUFFTyxTQUFTLFdBQVcsT0FBYyxRQUFnQixPQUFzQjtBQUM3RSxRQUFNLElBQUksTUFBTSxLQUFLO0FBQ3JCLFFBQU0sT0FBTyxFQUFFLE1BQU0sVUFBVSxHQUFHLE1BQU0sQ0FBQztBQUN6QyxNQUFJLEtBQU0sTUFBSyxRQUFRLE1BQU0sS0FBSztBQUNsQyxTQUFPO0FBQ1Q7QUFFTyxTQUFTLFdBQVcsT0FBYyxRQUF1QjtBQUM5RCxRQUFNLElBQUksTUFBTSxLQUFLO0FBQ3JCLElBQUUsUUFBUSxFQUFFLE1BQU0sT0FBTyxDQUFDLE1BQU0sRUFBRSxPQUFPLE1BQU07QUFDL0MsU0FBTztBQUNUO0FBRU8sU0FBUyxTQUFTLE9BQWMsUUFBZ0IsSUFBbUI7QUFDeEUsUUFBTSxJQUFJLE1BQU0sS0FBSztBQUNyQixRQUFNLE9BQU8sVUFBVSxHQUFHLE1BQU07QUFDaEMsTUFBSSxPQUFPLEVBQUcsUUFBTztBQUNyQixRQUFNLENBQUMsSUFBSSxJQUFJLEVBQUUsTUFBTSxPQUFPLE1BQU0sQ0FBQztBQUNyQyxJQUFFLE1BQU0sT0FBTyxNQUFNLElBQUksR0FBRyxFQUFFLE1BQU0sTUFBTSxHQUFHLEdBQUcsSUFBSTtBQUNwRCxTQUFPO0FBQ1Q7QUFHTyxTQUFTLGdCQUFnQixPQUFjLFFBQWdCLElBQW9CO0FBQ2hGLFFBQU0sSUFBSSxNQUFNLEtBQUs7QUFDckIsUUFBTSxPQUFPLEVBQUUsTUFBTSxVQUFVLEdBQUcsTUFBTSxDQUFDO0FBQ3pDLE1BQUksQ0FBQyxLQUFNLFFBQU87QUFDbEIsT0FBSyxlQUFlO0FBQ3BCLE1BQUksR0FBSSxNQUFLLE1BQU0sUUFBUSxDQUFDLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQztBQUNsRCxTQUFPO0FBQ1Q7QUFFTyxTQUFTLFlBQVksT0FBYyxRQUFnQixLQUFvQjtBQUM1RSxRQUFNLElBQUksTUFBTSxLQUFLO0FBQ3JCLFFBQU0sT0FBTyxFQUFFLE1BQU0sVUFBVSxHQUFHLE1BQU0sQ0FBQztBQUN6QyxNQUFJLEtBQU0sTUFBSyxXQUFXLEtBQUssSUFBSSxHQUFHLEtBQUssTUFBTSxHQUFHLEtBQUssQ0FBQztBQUMxRCxTQUFPO0FBQ1Q7QUFFTyxTQUFTLFFBQVEsT0FBYyxRQUFnQixNQUFjLElBQW9CO0FBQ3RGLFFBQU0sSUFBSSxNQUFNLEtBQUs7QUFDckIsUUFBTSxPQUFPLEVBQUUsTUFBTSxVQUFVLEdBQUcsTUFBTSxDQUFDO0FBQ3pDLE1BQUksQ0FBQyxLQUFNLFFBQU87QUFDbEIsUUFBTSxPQUFhLEVBQUUsSUFBSSxNQUFNLEdBQUcsR0FBRyxNQUFNLEtBQUssS0FBSyxHQUFHLFNBQVMsT0FBTyxXQUFXLElBQUk7QUFDdkYsTUFBSSxLQUFLLGFBQWMsU0FBUSxNQUFNLElBQUk7QUFDekMsT0FBSyxNQUFNLE9BQU8sTUFBTSxNQUFNLEtBQUssTUFBTSxRQUFRLEdBQUcsS0FBSyxNQUFNLE1BQU0sR0FBRyxHQUFHLElBQUk7QUFDL0UsU0FBTztBQUNUO0FBRU8sU0FBUyxTQUFTLE9BQWMsUUFBZ0IsTUFBcUI7QUFDMUUsUUFBTSxJQUFJLE1BQU0sS0FBSztBQUNyQixRQUFNLE1BQU0sU0FBUyxHQUFHLE1BQU07QUFDOUIsTUFBSSxJQUFLLEtBQUksS0FBSyxJQUFJLEtBQUssRUFBRSxPQUFPLEtBQUssS0FBSztBQUM5QyxTQUFPO0FBQ1Q7QUFFTyxTQUFTLFdBQVcsT0FBYyxRQUF1QjtBQUM5RCxRQUFNLElBQUksTUFBTSxLQUFLO0FBQ3JCLFFBQU0sTUFBTSxTQUFTLEdBQUcsTUFBTTtBQUM5QixNQUFJLElBQUssS0FBSSxLQUFLLE9BQU8sSUFBSSxPQUFPLENBQUM7QUFDckMsU0FBTztBQUNUO0FBRU8sU0FBUyxXQUFXLE9BQWMsUUFBdUI7QUFDOUQsUUFBTSxJQUFJLE1BQU0sS0FBSztBQUNyQixRQUFNLE1BQU0sU0FBUyxHQUFHLE1BQU07QUFDOUIsTUFBSSxLQUFLO0FBQ1AsVUFBTSxPQUFPLElBQUksS0FBSyxJQUFJLEtBQUs7QUFDL0IsWUFBUSxNQUFNLENBQUMsS0FBSyxPQUFPO0FBQUEsRUFDN0I7QUFDQSxTQUFPO0FBQ1Q7QUFHTyxTQUFTLFNBQVMsT0FBYyxRQUFnQixVQUFrQixJQUFtQjtBQUMxRixRQUFNLElBQUksTUFBTSxLQUFLO0FBQ3JCLFFBQU0sTUFBTSxTQUFTLEdBQUcsTUFBTTtBQUM5QixRQUFNLE9BQU8sRUFBRSxNQUFNLFVBQVUsR0FBRyxRQUFRLENBQUM7QUFDM0MsTUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFNLFFBQU87QUFDMUIsUUFBTSxDQUFDLElBQUksSUFBSSxJQUFJLEtBQUssT0FBTyxJQUFJLE9BQU8sQ0FBQztBQUUzQyxRQUFNLE9BQU8sSUFBSSxTQUFTLEtBQUs7QUFDL0IsUUFBTSxRQUFRLFFBQVEsS0FBSyxJQUFJLFFBQVEsS0FBSyxJQUFJO0FBQ2hELE1BQUksS0FBSyxhQUFjLFNBQVEsTUFBTSxJQUFJO0FBQUEsV0FDaEMsSUFBSSxNQUFNLGdCQUFnQixDQUFDLEtBQU0sU0FBUSxNQUFNLEtBQUs7QUFDN0QsT0FBSyxNQUFNLE9BQU8sTUFBTSxPQUFPLEdBQUcsS0FBSyxNQUFNLE1BQU0sR0FBRyxHQUFHLElBQUk7QUFDN0QsU0FBTztBQUNUO0FBR08sU0FBUyxZQUFZLE9BQWMsUUFBdUI7QUFDL0QsUUFBTSxJQUFJLE1BQU0sS0FBSztBQUNyQixRQUFNLE1BQU0sU0FBUyxHQUFHLE1BQU07QUFDOUIsTUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEtBQU0sUUFBTztBQUM5QixRQUFNLENBQUMsSUFBSSxJQUFJLElBQUksS0FBSyxPQUFPLElBQUksT0FBTyxDQUFDO0FBQzNDLElBQUUsUUFBUSxLQUFLLElBQUk7QUFDbkIsU0FBTztBQUNUO0FBRU8sU0FBUyxZQUFZLE9BQWMsUUFBZ0IsUUFBdUI7QUFDL0UsUUFBTSxJQUFJLE1BQU0sS0FBSztBQUNyQixRQUFNLFFBQVEsRUFBRSxRQUFRLFVBQVUsQ0FBQyxNQUFNLEVBQUUsT0FBTyxNQUFNO0FBQ3hELFFBQU0sT0FBTyxFQUFFLE1BQU0sVUFBVSxHQUFHLE1BQU0sQ0FBQztBQUN6QyxNQUFJLFFBQVEsS0FBSyxDQUFDLEtBQU0sUUFBTztBQUMvQixRQUFNLENBQUMsSUFBSSxJQUFJLEVBQUUsUUFBUSxPQUFPLE9BQU8sQ0FBQztBQUN4QyxNQUFJLEtBQUssYUFBYyxTQUFRLE1BQU0sSUFBSTtBQUN6QyxPQUFLLE1BQU0sS0FBSyxJQUFJO0FBQ3BCLFNBQU87QUFDVDtBQUdPLFNBQVMsWUFBWSxPQUFjLFFBQXVCO0FBQy9ELFFBQU0sSUFBSSxNQUFNLEtBQUs7QUFDckIsUUFBTSxPQUFPLEVBQUUsTUFBTSxVQUFVLEdBQUcsTUFBTSxDQUFDO0FBQ3pDLE1BQUksQ0FBQyxLQUFNLFFBQU87QUFDbEIsSUFBRSxRQUFRLEtBQUssR0FBRyxLQUFLLE1BQU0sT0FBTyxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUM7QUFDckQsT0FBSyxRQUFRLEtBQUssTUFBTSxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUUsT0FBTztBQUNoRCxTQUFPO0FBQ1Q7OztBRDVJTyxJQUFNLFlBQVk7QUFHekIsSUFBTSxXQUFXLENBQUMsU0FBeUIsS0FBSyxRQUFRLFVBQVUsTUFBTTtBQUN4RSxJQUFNLGFBQWEsQ0FBQyxTQUF5QixLQUFLLFFBQVEsU0FBUyxJQUFJO0FBQ3ZFLElBQU0sWUFBWSxDQUFDLFNBQXlCLEtBQUssTUFBTSxJQUFJLEVBQUUsQ0FBQyxLQUFLO0FBQ25FLElBQU0sV0FBVyxDQUFDLFNBQWlCLENBQUMsTUFBZSxFQUFFLEtBQUssSUFBSSxPQUFPLFdBQVcsSUFBSTtBQU83RSxJQUFNLGFBQU4sY0FBeUIsNkJBQWE7QUFBQSxFQU0zQyxZQUFZLE1BQTZCLE1BQWtCO0FBQ3pELFVBQU0sSUFBSTtBQUQ2QjtBQUFBLEVBRXpDO0FBQUEsRUFGeUM7QUFBQSxFQUx6QyxRQUFlLFdBQVcsRUFBRTtBQUFBO0FBQUEsRUFFcEIsUUFBUTtBQUFBLEVBQ1IsU0FBd0I7QUFBQSxFQU1oQyxjQUFzQjtBQUNwQixXQUFPO0FBQUEsRUFDVDtBQUFBLEVBRUEsVUFBa0I7QUFDaEIsV0FBTztBQUFBLEVBQ1Q7QUFBQSxFQUVBLE1BQU0sU0FBd0I7QUFDNUIsU0FBSyxVQUFVLGFBQWEsb0JBQW9CLE1BQU0sS0FBSyxLQUFLLGVBQWUsS0FBSyxJQUFJLENBQUM7QUFBQSxFQUMzRjtBQUFBLEVBRUEsY0FBc0I7QUFDcEIsUUFBSSxDQUFDLEtBQUssTUFBTyxRQUFPLEtBQUs7QUFDN0IsVUFBTSxTQUFVLEtBQUssSUFBSSxNQUFjLFlBQVksUUFBUSxNQUFNO0FBQ2pFLFdBQU8sZUFBZSxLQUFLLE9BQU8sRUFBRSxPQUFPLENBQUM7QUFBQSxFQUM5QztBQUFBLEVBRUEsWUFBWSxNQUFjLFFBQXVCO0FBQy9DLFNBQUssT0FBTztBQUNaLFNBQUssUUFBUTtBQUNiLFNBQUssUUFBUSxXQUFXLElBQUk7QUFDNUIsU0FBSyxPQUFPO0FBQUEsRUFDZDtBQUFBLEVBRUEsUUFBYztBQUNaLFNBQUssUUFBUSxXQUFXLEVBQUU7QUFDMUIsU0FBSyxRQUFRO0FBQUEsRUFDZjtBQUFBO0FBQUEsRUFHQSxNQUFNLEtBQUssT0FBZ0M7QUFDekMsUUFBSSxLQUFLLE1BQU8sT0FBTSxNQUFNLEtBQUssS0FBSztBQUFBLEVBQ3hDO0FBQUE7QUFBQSxFQUdBLE9BQU8sTUFBbUI7QUFDeEIsU0FBSyxRQUFRO0FBQ2IsU0FBSyxRQUFRO0FBQ2IsU0FBSyxPQUFPO0FBQ1osU0FBSyxLQUFLLEtBQUs7QUFBQSxFQUNqQjtBQUFBLEVBRUEsU0FBZTtBQUNiLFVBQU0sT0FBTyxLQUFLO0FBQ2xCLFNBQUssTUFBTTtBQUNYLFNBQUssU0FBUyxzQkFBc0I7QUFDcEMsVUFBTSxNQUFNLEtBQUssVUFBVSxFQUFFLEtBQUssMEJBQTBCLENBQUM7QUFDN0QsdUJBQUcsT0FBTyxLQUFLLEVBQUUsTUFBTSxZQUFZLE1BQU0sUUFBUSxTQUFTLE1BQU0sS0FBSyxRQUFRLEVBQUUsQ0FBQztBQUNoRixRQUFJLEtBQUssTUFBTSxRQUFRLFFBQVE7QUFDN0IseUJBQUcsT0FBTyxLQUFLLEVBQUUsTUFBTSxtQkFBbUIsS0FBSyxNQUFNLFFBQVEsTUFBTSxLQUFLLE1BQU0sV0FBVyxTQUFTLE1BQU0sS0FBSyxtQkFBbUIsRUFBRSxDQUFDO0FBQUEsSUFDckk7QUFDQSxVQUFNLFFBQVEsS0FBSyxVQUFVLEVBQUUsS0FBSyx3QkFBd0IsQ0FBQztBQUM3RCxRQUFJLENBQUMsS0FBSyxNQUFNLE1BQU0sUUFBUTtBQUM1Qix5QkFBRyxXQUFXLE9BQU8sOENBQThDO0FBQ25FO0FBQUEsSUFDRjtBQUNBLFNBQUssTUFBTSxNQUFNLFFBQVEsQ0FBQyxNQUFNLE1BQU0sS0FBSyxXQUFXLE9BQU8sTUFBTSxDQUFDLENBQUM7QUFBQSxFQUN2RTtBQUFBLEVBRVEsV0FBVyxRQUFxQixNQUFZLE9BQXFCO0FBQ3ZFLFVBQU0sS0FBSyxPQUFPLFVBQVUsRUFBRSxLQUFLLHVCQUF1QixDQUFDO0FBQzNELE9BQUcsUUFBUSxTQUFTLEtBQUs7QUFDekIsVUFBTSxPQUFPLEdBQUcsVUFBVSxFQUFFLEtBQUssOEJBQThCLENBQUM7QUFDaEUsVUFBTSxRQUFRLEtBQUssVUFBVSxFQUFFLEtBQUssOEJBQThCLE1BQU0sS0FBSyxTQUFTLGdCQUFnQixDQUFDO0FBQ3ZHLFVBQU0sYUFBYSxRQUFRLFFBQVE7QUFDbkMsVUFBTSxXQUFXO0FBQ2pCLFVBQU0saUJBQWlCLFNBQVMsTUFBTSxLQUFLLEtBQUssV0FBVyxJQUFJLENBQUM7QUFDaEUsVUFBTSxRQUFRLEtBQUssV0FBVyxHQUFHLEtBQUssTUFBTSxNQUFNLElBQUksS0FBSyxRQUFRLEtBQUssT0FBTyxLQUFLLE1BQU0sTUFBTTtBQUNoRyx1QkFBRyxNQUFNLE1BQU0sT0FBTyxLQUFLLFlBQVksS0FBSyxNQUFNLFNBQVMsS0FBSyxXQUFXLFdBQVcsS0FBSyxlQUFlLFlBQVksU0FBUztBQUMvSCx1QkFBRyxXQUFXLE1BQU0sTUFBTSxLQUFLLFNBQVMsTUFBTSxLQUFLLEdBQUcsY0FBYztBQUVwRSxVQUFNLFFBQVEsR0FBRyxVQUFVLEVBQUUsS0FBSyx3QkFBd0IsQ0FBQztBQUMzRCxTQUFLLFNBQVMsT0FBTyxJQUFJO0FBQ3pCLFFBQUksQ0FBQyxLQUFLLE1BQU0sT0FBUSxPQUFNLFVBQVUsRUFBRSxLQUFLLCtCQUErQixNQUFNLFdBQVcsQ0FBQztBQUNoRyxlQUFXLFFBQVEsS0FBSyxNQUFPLE1BQUssV0FBVyxPQUFPLE1BQU0sSUFBSTtBQUNoRSx1QkFBRyxPQUFPLElBQUksRUFBRSxNQUFNLGNBQWMsTUFBTSxRQUFRLFNBQVMsUUFBUSxTQUFTLE1BQU0sS0FBSyxRQUFRLElBQUksRUFBRSxDQUFDO0FBQUEsRUFDeEc7QUFBQSxFQUVRLFdBQVcsUUFBcUIsTUFBWSxNQUFrQjtBQUNwRSxVQUFNLEtBQUssT0FBTyxVQUFVLEVBQUUsS0FBSyx1QkFBdUIsQ0FBQztBQUMzRCxPQUFHLFlBQVksV0FBVyxLQUFLLE9BQU87QUFDdEMsT0FBRyxRQUFRLFNBQVMsS0FBSztBQUN6QixPQUFHLFlBQVk7QUFDZixPQUFHLGlCQUFpQixhQUFhLENBQUMsTUFBTTtBQUN0QyxXQUFLLFNBQVMsS0FBSztBQUNuQixRQUFFLGNBQWMsUUFBUSxjQUFjLEtBQUssRUFBRTtBQUM3QyxTQUFHLFNBQVMsYUFBYTtBQUFBLElBQzNCLENBQUM7QUFDRCxPQUFHLGlCQUFpQixXQUFXLE1BQU07QUFDbkMsV0FBSyxTQUFTO0FBQ2QsU0FBRyxZQUFZLGFBQWE7QUFBQSxJQUM5QixDQUFDO0FBQ0QsVUFBTSxRQUFRLEdBQUcsU0FBUyxTQUFTLEVBQUUsS0FBSyxpREFBaUQsTUFBTSxXQUFXLENBQUM7QUFDN0csVUFBTSxVQUFVLEtBQUs7QUFDckIsVUFBTSxhQUFhLGNBQWMsS0FBSyxVQUFVLDBCQUEwQixtQkFBbUI7QUFDN0YsVUFBTSxpQkFBaUIsU0FBUyxDQUFDLE1BQU07QUFDckMsUUFBRSxnQkFBZ0I7QUFDbEIsV0FBSyxPQUFXLFdBQVcsS0FBSyxPQUFPLEtBQUssRUFBRSxDQUFDO0FBQUEsSUFDakQsQ0FBQztBQUNELFVBQU0sT0FBTyxHQUFHLFVBQVUsRUFBRSxLQUFLLDRCQUE0QixDQUFDO0FBQzlELFNBQUssaUNBQWlCLE9BQU8sS0FBSyxLQUFLLEtBQUssTUFBTSxNQUFNLEtBQUssTUFBTSxRQUFRLElBQUksSUFBSTtBQUNuRixTQUFLLGlCQUFpQixZQUFZLE1BQU0sS0FBSyxLQUFLLFNBQVMsSUFBSSxDQUFDO0FBQ2hFLHVCQUFHLFdBQVcsSUFBSSxNQUFNLEtBQUssU0FBUyxNQUFNLElBQUksR0FBRyxjQUFjO0FBQUEsRUFDbkU7QUFBQTtBQUFBLEVBR1EsU0FBUyxPQUFvQixNQUFrQjtBQUNyRCxVQUFNLGlCQUFpQixZQUFZLENBQUMsTUFBTTtBQUN4QyxVQUFJLENBQUMsS0FBSyxPQUFRO0FBQ2xCLFFBQUUsZUFBZTtBQUNqQixZQUFNLFNBQVMsZ0JBQWdCO0FBQUEsSUFDakMsQ0FBQztBQUNELFVBQU0saUJBQWlCLGFBQWEsTUFBTSxNQUFNLFlBQVksZ0JBQWdCLENBQUM7QUFDN0UsVUFBTSxpQkFBaUIsUUFBUSxDQUFDLE1BQU07QUFDcEMsWUFBTSxZQUFZLGdCQUFnQjtBQUNsQyxZQUFNLEtBQUssS0FBSyxVQUFVLEVBQUUsY0FBYyxRQUFRLFlBQVk7QUFDOUQsVUFBSSxDQUFDLEdBQUk7QUFDVCxRQUFFLGVBQWU7QUFDakIsWUFBTSxRQUFRLE1BQU0sS0FBSyxNQUFNLGlCQUE4Qix1QkFBdUIsQ0FBQztBQUNyRixVQUFJLEtBQUssTUFBTSxVQUFVLENBQUMsTUFBTTtBQUM5QixjQUFNLElBQUksRUFBRSxzQkFBc0I7QUFDbEMsZUFBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUUsU0FBUztBQUFBLE1BQ3hDLENBQUM7QUFDRCxVQUFJLEtBQUssRUFBRyxNQUFLLE1BQU07QUFDdkIsV0FBSyxPQUFXLFNBQVMsS0FBSyxPQUFPLElBQUksS0FBSyxJQUFJLEVBQUUsQ0FBQztBQUFBLElBQ3ZELENBQUM7QUFBQSxFQUNIO0FBQUEsRUFFUSxTQUFTLE1BQVksT0FBK0I7QUFDMUQsVUFBTSxPQUFPLEtBQUssTUFBTSxNQUFNLFNBQVM7QUFDdkMsV0FBTztBQUFBLE1BQ0wsRUFBRSxPQUFPLGVBQWUsTUFBTSxVQUFVLFNBQVMsTUFBTSxLQUFLLFdBQVcsSUFBSSxFQUFFO0FBQUEsTUFDN0UsRUFBRSxPQUFPLHlCQUF5QixNQUFNLFFBQVEsU0FBUyxNQUFNLEtBQUssUUFBUSxNQUFNLENBQUMsRUFBRTtBQUFBLE1BQ3JGLEVBQUUsT0FBTyxrQkFBa0IsTUFBTSxRQUFRLFNBQVMsTUFBTSxLQUFLLFNBQVMsSUFBSSxFQUFFO0FBQUEsTUFDNUU7QUFBQSxRQUNFLE9BQU8sS0FBSyxlQUFlLCtCQUErQjtBQUFBLFFBQzFELE1BQU07QUFBQSxRQUNOLFNBQVMsTUFBTSxLQUFLLE9BQVcsZ0JBQWdCLEtBQUssT0FBTyxLQUFLLElBQUksQ0FBQyxLQUFLLFlBQVksQ0FBQztBQUFBLE1BQ3pGO0FBQUEsTUFDQSxFQUFFLE9BQU8sc0JBQXNCLE1BQU0sV0FBVyxVQUFVLENBQUMsS0FBSyxNQUFNLEtBQUssQ0FBQyxNQUFNLEVBQUUsT0FBTyxHQUFHLFNBQVMsTUFBTSxLQUFLLE9BQVcsWUFBWSxLQUFLLE9BQU8sS0FBSyxFQUFFLENBQUMsRUFBRTtBQUFBLE1BQy9KO0FBQUEsTUFDQSxFQUFFLE9BQU8sa0JBQWtCLE1BQU0sY0FBYyxVQUFVLFVBQVUsR0FBRyxTQUFTLE1BQU0sS0FBSyxPQUFXLFNBQVMsS0FBSyxPQUFPLEtBQUssSUFBSSxRQUFRLENBQUMsQ0FBQyxFQUFFO0FBQUEsTUFDL0ksRUFBRSxPQUFPLG1CQUFtQixNQUFNLGVBQWUsVUFBVSxVQUFVLE1BQU0sU0FBUyxNQUFNLEtBQUssT0FBVyxTQUFTLEtBQUssT0FBTyxLQUFLLElBQUksUUFBUSxDQUFDLENBQUMsRUFBRTtBQUFBLE1BQ3BKO0FBQUEsTUFDQSxFQUFFLE9BQU8sZUFBZSxNQUFNLFdBQVcsUUFBUSxNQUFNLFNBQVMsTUFBTSxLQUFLLFdBQVcsSUFBSSxFQUFFO0FBQUEsSUFDOUY7QUFBQSxFQUNGO0FBQUEsRUFFUSxTQUFTLE1BQVksTUFBNEI7QUFDdkQsVUFBTSxLQUFLLEtBQUssTUFBTSxVQUFVLENBQUMsTUFBTSxFQUFFLE9BQU8sS0FBSyxFQUFFO0FBQ3ZELFdBQU87QUFBQSxNQUNMLEVBQUUsT0FBTyxhQUFhLE1BQU0sVUFBVSxTQUFTLE1BQU0sS0FBSyxTQUFTLElBQUksRUFBRTtBQUFBLE1BQ3pFLEVBQUUsT0FBTyxxQkFBcUIsTUFBTSxvQkFBb0IsVUFBVSxLQUFLLE1BQU0sTUFBTSxTQUFTLEdBQUcsU0FBUyxNQUFNLEtBQUssV0FBVyxNQUFNLElBQUksRUFBRTtBQUFBLE1BQzFJLEVBQUUsT0FBTyxlQUFlLE1BQU0sb0JBQW9CLFVBQVUsT0FBTyxHQUFHLFNBQVMsTUFBTSxLQUFLLE9BQVcsU0FBUyxLQUFLLE9BQU8sS0FBSyxJQUFJLEtBQUssSUFBSSxDQUFDLENBQUMsRUFBRTtBQUFBLE1BQ2hKLEVBQUUsT0FBTyxrQkFBa0IsTUFBTSxzQkFBc0IsVUFBVSxPQUFPLEtBQUssTUFBTSxTQUFTLEdBQUcsU0FBUyxNQUFNLEtBQUssT0FBVyxTQUFTLEtBQUssT0FBTyxLQUFLLElBQUksS0FBSyxJQUFJLEtBQUssTUFBTSxNQUFNLENBQUMsRUFBRTtBQUFBLE1BQ3pMO0FBQUEsTUFDQSxFQUFFLE9BQU8sZ0JBQWdCLE1BQU0sV0FBVyxTQUFTLE1BQU0sS0FBSyxPQUFXLFlBQVksS0FBSyxPQUFPLEtBQUssRUFBRSxDQUFDLEVBQUU7QUFBQSxNQUMzRyxFQUFFLE9BQU8sZUFBZSxNQUFNLFdBQVcsUUFBUSxNQUFNLFNBQVMsTUFBTSxLQUFLLFdBQVcsSUFBSSxFQUFFO0FBQUEsSUFDOUY7QUFBQSxFQUNGO0FBQUEsRUFFQSxNQUFjLFVBQXlCO0FBQ3JDLFVBQU0sUUFBUSxNQUFNLG1CQUFHLE9BQU8sS0FBSyxLQUFLLEVBQUUsT0FBTyxZQUFZLE9BQU8sUUFBUSxhQUFhLFNBQVMsUUFBUSxZQUFZLFVBQVUsU0FBUyxNQUFNLEVBQUUsQ0FBQztBQUNsSixRQUFJLE1BQU8sTUFBSyxPQUFXLFFBQVEsS0FBSyxPQUFPLEtBQUssQ0FBQztBQUFBLEVBQ3ZEO0FBQUEsRUFFQSxNQUFjLFdBQVcsTUFBMkI7QUFDbEQsVUFBTSxRQUFRLE1BQU0sbUJBQUcsT0FBTyxLQUFLLEtBQUssRUFBRSxPQUFPLGVBQWUsT0FBTyxRQUFRLE9BQU8sS0FBSyxPQUFPLFFBQVEsVUFBVSxVQUFVLFNBQVMsTUFBTSxFQUFFLENBQUM7QUFDaEosUUFBSSxTQUFTLE1BQU0sS0FBSyxNQUFNLEtBQUssTUFBTyxNQUFLLE9BQVcsV0FBVyxLQUFLLE9BQU8sS0FBSyxJQUFJLEtBQUssQ0FBQztBQUFBLEVBQ2xHO0FBQUEsRUFFQSxNQUFjLFNBQVMsTUFBMkI7QUFDaEQsVUFBTSxJQUFJLE1BQU0sbUJBQUcsT0FBTyxLQUFLLEtBQUs7QUFBQSxNQUNsQyxPQUFPO0FBQUEsTUFDUCxPQUFPO0FBQUEsTUFDUCxPQUFPLE9BQU8sS0FBSyxRQUFRO0FBQUEsTUFDM0IsUUFBUTtBQUFBLE1BQ1IsVUFBVSxDQUFDLE1BQU8sUUFBUSxLQUFLLEVBQUUsS0FBSyxDQUFDLElBQUksT0FBTztBQUFBLElBQ3BELENBQUM7QUFDRCxRQUFJLE1BQU0sS0FBTSxNQUFLLE9BQVcsWUFBWSxLQUFLLE9BQU8sS0FBSyxJQUFJLE9BQU8sRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDO0FBQUEsRUFDcEY7QUFBQSxFQUVBLE1BQWMsV0FBVyxNQUEyQjtBQUNsRCxVQUFNLElBQUksS0FBSyxNQUFNO0FBQ3JCLFVBQU0sS0FBSyxNQUFNLG1CQUFHLFFBQVEsS0FBSyxLQUFLO0FBQUEsTUFDcEMsT0FBTztBQUFBLE1BQ1AsU0FBUyxVQUFVLEtBQUssU0FBUyxXQUFXLEdBQUcsSUFBSSxZQUFZLENBQUMsUUFBUSxNQUFNLElBQUksS0FBSyxHQUFHLEtBQUssRUFBRTtBQUFBLE1BQ2pHLFFBQVE7QUFBQSxNQUNSLFFBQVE7QUFBQSxJQUNWLENBQUM7QUFDRCxRQUFJLEdBQUksTUFBSyxPQUFXLFdBQVcsS0FBSyxPQUFPLEtBQUssRUFBRSxDQUFDO0FBQUEsRUFDekQ7QUFBQSxFQUVBLE1BQWMsUUFBUSxNQUFZLElBQTRCO0FBQzVELFVBQU0sT0FBTyxNQUFNLG1CQUFHLE9BQU8sS0FBSyxLQUFLLEVBQUUsT0FBTyxZQUFZLE9BQU8sUUFBUSxhQUFhLHFCQUFxQixRQUFRLFlBQVksVUFBVSxTQUFTLE1BQU0sRUFBRSxDQUFDO0FBQzdKLFFBQUksS0FBTSxNQUFLLE9BQVcsUUFBUSxLQUFLLE9BQU8sS0FBSyxJQUFJLFdBQVcsSUFBSSxHQUFHLEVBQUUsQ0FBQztBQUFBLEVBQzlFO0FBQUEsRUFFQSxNQUFjLFNBQVMsTUFBMkI7QUFDaEQsVUFBTSxPQUFPLE1BQU0sbUJBQUcsT0FBTyxLQUFLLEtBQUssRUFBRSxPQUFPLGFBQWEsT0FBTyxpQ0FBaUMsT0FBTyxTQUFTLEtBQUssSUFBSSxHQUFHLFFBQVEsUUFBUSxVQUFVLFNBQVMsTUFBTSxFQUFFLENBQUM7QUFDN0ssUUFBSSxTQUFTLFFBQVEsV0FBVyxJQUFJLEVBQUUsS0FBSyxNQUFNLEtBQUssS0FBTSxNQUFLLE9BQVcsU0FBUyxLQUFLLE9BQU8sS0FBSyxJQUFJLFdBQVcsSUFBSSxDQUFDLENBQUM7QUFBQSxFQUM3SDtBQUFBLEVBRUEsTUFBYyxXQUFXLE1BQTJCO0FBQ2xELFVBQU0sS0FBSyxNQUFNLG1CQUFHLFFBQVEsS0FBSyxLQUFLLEVBQUUsT0FBTyxlQUFlLFNBQVMsV0FBVyxVQUFVLEtBQUssSUFBSSxDQUFDLDZCQUE2QixRQUFRLFVBQVUsUUFBUSxLQUFLLENBQUM7QUFDbkssUUFBSSxHQUFJLE1BQUssT0FBVyxXQUFXLEtBQUssT0FBTyxLQUFLLEVBQUUsQ0FBQztBQUFBLEVBQ3pEO0FBQUEsRUFFQSxNQUFjLFdBQVcsTUFBWSxNQUEyQjtBQUM5RCxVQUFNLFVBQVUsS0FBSyxNQUFNLE1BQU0sSUFBSSxDQUFDLE9BQU8sRUFBRSxPQUFPLEVBQUUsSUFBSSxNQUFNLEVBQUUsU0FBUyxpQkFBaUIsVUFBVSxFQUFFLE9BQU8sS0FBSyxHQUFHLEVBQUU7QUFDM0gsVUFBTSxLQUFLLE1BQU0sbUJBQUcsT0FBTyxLQUFLLEtBQUssRUFBRSxPQUFPLHFCQUFxQixRQUFRLENBQUM7QUFDNUUsUUFBSSxHQUFJLE1BQUssT0FBVyxTQUFTLEtBQUssT0FBTyxLQUFLLElBQUksSUFBSSxPQUFPLGdCQUFnQixDQUFDO0FBQUEsRUFDcEY7QUFBQSxFQUVBLE1BQWMscUJBQW9DO0FBQ2hELFVBQU0sUUFBUSxLQUFLLE1BQU0sTUFBTSxDQUFDO0FBQ2hDLFFBQUksQ0FBQyxPQUFPO0FBQ1YseUJBQUcsT0FBTywrQ0FBK0M7QUFDekQ7QUFBQSxJQUNGO0FBQ0EsVUFBTSxLQUFLLE1BQU0sbUJBQUcsT0FBTyxLQUFLLEtBQUs7QUFBQSxNQUNuQyxPQUFPLHFCQUFxQixNQUFNLFNBQVMsZ0JBQWdCO0FBQUEsTUFDM0QsU0FBUyxLQUFLLE1BQU0sUUFBUSxJQUFJLENBQUMsT0FBTyxFQUFFLE9BQU8sRUFBRSxJQUFJLE1BQU0sVUFBVSxFQUFFLElBQUksRUFBRSxFQUFFO0FBQUEsSUFDbkYsQ0FBQztBQUNELFFBQUksQ0FBQyxHQUFJO0FBQ1QsU0FBSyxPQUFXLFlBQVksS0FBSyxPQUFPLElBQUksTUFBTSxFQUFFLENBQUM7QUFDckQsdUJBQUcsT0FBTyxpQkFBaUIsRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUFBLEVBQ2hEO0FBQ0Y7OztBRjNQQSxJQUFxQixlQUFyQixjQUEwQyx3QkFBNkI7QUFBQTtBQUFBLEVBRTdELGFBQWEsb0JBQUksUUFBK0I7QUFBQSxFQUV4RCxNQUFNLFNBQXdCO0FBQzVCLFNBQUssYUFBYSxXQUFXLENBQUMsU0FBd0IsSUFBSSxXQUFXLE1BQU0sSUFBSSxDQUFDO0FBQ2hGLFNBQUssY0FBYyxpQkFBaUIsYUFBYSxNQUFNLEtBQUssS0FBSyxZQUFZLENBQUM7QUFDOUUsU0FBSyxXQUFXLEVBQUUsSUFBSSxnQkFBZ0IsTUFBTSxhQUFhLFVBQVUsTUFBTSxLQUFLLEtBQUssWUFBWSxFQUFFLENBQUM7QUFDbEcsU0FBSyxXQUFXO0FBQUEsTUFDZCxJQUFJO0FBQUEsTUFDSixNQUFNO0FBQUEsTUFDTixlQUFlLENBQUMsYUFBc0I7QUFDcEMsY0FBTSxPQUFPLEtBQUssSUFBSSxVQUFVLGNBQWMsS0FBSyxJQUFJLFVBQVUsa0JBQWtCO0FBQ25GLGNBQU0sT0FBTyxNQUFNO0FBQ25CLFlBQUksZ0JBQWdCLFlBQVk7QUFDOUIsY0FBSSxDQUFDLFNBQVUsTUFBSyxlQUFlLElBQUs7QUFDeEMsaUJBQU87QUFBQSxRQUNUO0FBQ0EsWUFBSSxnQkFBZ0IsaUNBQWdCLEtBQUssUUFBUSxLQUFLLFFBQVEsS0FBSyxJQUFJLEdBQUc7QUFDeEUsY0FBSSxDQUFDLFNBQVUsTUFBSyxLQUFLLFlBQVksTUFBTyxLQUFLLElBQUk7QUFDckQsaUJBQU87QUFBQSxRQUNUO0FBQ0EsZUFBTztBQUFBLE1BQ1Q7QUFBQSxJQUNGLENBQUM7QUFDRCxTQUFLO0FBQUEsTUFDSCxLQUFLLElBQUksVUFBVSxHQUFHLGFBQWEsQ0FBQyxNQUFXLE1BQVcsU0FBaUIsU0FBeUI7QUFDbEcsWUFBSSxnQkFBZ0IsMEJBQVM7QUFDM0IsZUFBSyxRQUFRLENBQUMsTUFBVyxFQUFFLFNBQVMsV0FBVyxFQUFFLFFBQVEsZUFBZSxFQUFFLFFBQVEsTUFBTSxLQUFLLEtBQUssWUFBWSxJQUFJLENBQUMsQ0FBQztBQUFBLFFBQ3RILFdBQVcsZ0JBQWdCLDBCQUFTLE1BQU0sZ0JBQWdCLGlDQUFnQixLQUFLLFFBQVEsSUFBSSxHQUFHO0FBQzVGLGVBQUssUUFBUSxDQUFDLE1BQVcsRUFBRSxTQUFTLGVBQWUsRUFBRSxRQUFRLGVBQWUsRUFBRSxRQUFRLE1BQU0sS0FBSyxLQUFLLFlBQVksTUFBTSxJQUFJLENBQUMsQ0FBQztBQUFBLFFBQ2hJO0FBQUEsTUFDRixDQUFDO0FBQUEsSUFDSDtBQUVBLFNBQUssY0FBYyxLQUFLLElBQUksVUFBVSxHQUFHLGFBQWEsTUFBTSxLQUFLLEtBQUssaUJBQWlCLENBQUMsQ0FBQztBQUN6RixTQUFLLElBQUksVUFBVSxjQUFjLE1BQU07QUFDckMsV0FBSyxJQUFJLFVBQVUsb0JBQW9CLENBQUMsU0FBd0IsS0FBSyxLQUFLLFlBQVksSUFBSSxDQUFDO0FBQUEsSUFDN0YsQ0FBQztBQUFBLEVBQ0g7QUFBQTtBQUFBLEVBR0EsUUFBUSxNQUFzQjtBQUM1QixXQUFPLG1CQUFtQixLQUFLLElBQUksY0FBYyxhQUFhLElBQUksR0FBRyxXQUFXO0FBQUEsRUFDbEY7QUFBQSxFQUVBLE1BQWMsbUJBQWtDO0FBQzlDLFVBQU0sT0FBTyxLQUFLLElBQUksVUFBVSxjQUFjLEtBQUssSUFBSSxVQUFVLGtCQUFrQjtBQUNuRixRQUFJLEtBQU0sT0FBTSxLQUFLLFlBQVksSUFBSTtBQUFBLEVBQ3ZDO0FBQUEsRUFFQSxNQUFjLFlBQVksTUFBb0M7QUFDNUQsVUFBTSxPQUFPLEtBQUs7QUFDbEIsUUFBSSxFQUFFLGdCQUFnQixrQ0FBaUIsQ0FBQyxLQUFLLEtBQU07QUFDbkQsVUFBTSxPQUFPLEtBQUs7QUFDbEIsVUFBTSxTQUFTLEtBQUssV0FBVyxJQUFJLElBQUk7QUFDdkMsUUFBSSxXQUFXLEtBQUssS0FBTTtBQUMxQixRQUFJLE9BQVEsTUFBSyxXQUFXLE9BQU8sSUFBSTtBQUV2QyxVQUFNLFFBQVEsS0FBSyxJQUFJLGNBQWMsYUFBYSxJQUFJLElBQUksS0FBSyxRQUFRLElBQUksSUFBSSxnQkFBZ0IsTUFBTSxLQUFLLElBQUksTUFBTSxXQUFXLElBQUksQ0FBQztBQUNwSSxRQUFJLE1BQU8sT0FBTSxLQUFLLFlBQVksTUFBTSxJQUFJO0FBQUEsRUFDOUM7QUFBQSxFQUVBLE1BQU0sWUFBWSxNQUFxQixNQUE0QjtBQUNqRSxTQUFLLFdBQVcsT0FBTyxJQUFJO0FBQzNCLFVBQU0sS0FBSyxhQUFhLEVBQUUsTUFBTSxXQUFXLE9BQU8sRUFBRSxNQUFNLEtBQUssS0FBSyxHQUFHLFFBQVEsS0FBSyxDQUFRO0FBQUEsRUFDOUY7QUFBQSxFQUVBLGVBQWUsTUFBMkI7QUFDeEMsVUFBTSxPQUFRLEtBQUssS0FBb0I7QUFDdkMsUUFBSSxDQUFDLEtBQU07QUFDWCxTQUFLLFdBQVcsSUFBSSxNQUFNLEtBQUssSUFBSTtBQUNuQyxTQUFLLEtBQUssYUFBYSxFQUFFLE1BQU0sWUFBWSxPQUFPLEVBQUUsTUFBTSxLQUFLLEtBQUssR0FBRyxRQUFRLEtBQUssQ0FBUTtBQUFBLEVBQzlGO0FBQUE7QUFBQSxFQUdBLE1BQU0sWUFBWSxRQUFpQztBQUNqRCxVQUFNLFNBQVMsVUFBVSxLQUFLLElBQUksWUFBWSxpQkFBaUIsS0FBSyxJQUFJLFVBQVUsY0FBYyxHQUFHLFFBQVEsRUFBRTtBQUM3RyxVQUFNLE1BQU0sVUFBVSxDQUFDLE9BQU8sT0FBTyxJQUFJLEdBQUcsT0FBTyxJQUFJLE1BQU07QUFDN0QsUUFBSSxPQUFPLEdBQUcsR0FBRztBQUNqQixhQUFTLElBQUksR0FBRyxLQUFLLElBQUksTUFBTSxzQkFBc0IsSUFBSSxHQUFHLElBQUssUUFBTyxHQUFHLEdBQUcsbUJBQW1CLENBQUM7QUFDbEcsUUFBSTtBQUNGLFlBQU0sT0FBTyxNQUFNLEtBQUssSUFBSSxNQUFNLE9BQU8sTUFBTSxpQkFBaUIsQ0FBQztBQUNqRSxZQUFNLEtBQUssWUFBWSxLQUFLLElBQUksVUFBVSxRQUFRLEtBQUssR0FBRyxJQUFJO0FBQUEsSUFDaEUsU0FBUyxHQUFHO0FBQ1YsMEJBQUcsT0FBTywrQkFBK0IsYUFBYSxRQUFRLEVBQUUsVUFBVSxPQUFPLENBQUMsQ0FBQyxJQUFJLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFBQSxJQUMxRztBQUFBLEVBQ0Y7QUFDRjsiLAogICJuYW1lcyI6IFsiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9oZWxlbml0ZSIsICJpbmRleCJdCn0K
