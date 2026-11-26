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
  default: () => SampleDesignSystemPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian3 = require("obsidian");
var import_helenite10 = require("helenite");

// src/data.ts
var STATUSES = [
  { id: "todo", text: "To do", tone: "default" },
  { id: "doing", text: "Doing", tone: "accent" },
  { id: "done", text: "Done", tone: "success" }
];
var count = (n, noun) => `${n} ${noun}${n === 1 ? "" : "s"}`;
var statusOf = (item) => STATUSES.find((s) => s.id === item.status) ?? STATUSES[0];
var SEED = [
  { id: "1", name: "Reading list", kind: "note", status: "doing", pinned: true },
  { id: "2", name: "Design references", kind: "link", status: "todo", pinned: false },
  { id: "3", name: "Weekly review", kind: "note", status: "todo", pinned: false },
  { id: "4", name: "Release checklist", kind: "note", status: "done", pinned: false }
];
function readData(saved) {
  const s = saved ?? {};
  const items = s.items ?? SEED;
  return {
    items: items.map((i) => ({ ...i, status: i.status ?? "todo", pinned: i.pinned ?? false })),
    density: s.density ?? "detailed",
    scope: s.scope ?? "all"
  };
}

// src/settings.ts
var import_obsidian = require("obsidian");
var import_helenite2 = require("helenite");

// src/item-parts.ts
var import_helenite = require("helenite");
function itemTable(el, plugin, rows, onRemoved) {
  return import_helenite.ui.table(el, {
    columns: [
      { key: "name", title: "Name", cell: (r) => r.name },
      { key: "kind", title: "Kind", fit: true, cell: (r, td) => void import_helenite.ui.badge(td, r.kind) },
      { key: "status", title: "Status", fit: true, cell: (r, td) => void import_helenite.ui.statusText(td, statusOf(r).text, statusOf(r).tone) }
    ],
    rows,
    empty: "No items yet.",
    // `delete` asks before it runs, naming the item.
    actions: (r, cell) => void import_helenite.ui.action(cell, "delete", {
      app: plugin.app,
      subject: r.name,
      onClick: async () => {
        await plugin.remove(r);
        onRemoved?.();
      }
    })
  });
}
function itemMenu(plugin, item) {
  return [
    { title: "Open", icon: "panel-right-open", onClick: () => void openItem(plugin, item) },
    { title: "Rename", icon: "pencil", onClick: () => void plugin.rename(item) },
    "separator",
    ...STATUSES.map((s) => ({ title: s.text, checked: item.status === s.id, onClick: () => void plugin.move(item.id, s.id) })),
    "separator",
    {
      title: "Delete",
      icon: "trash-2",
      danger: true,
      onClick: () => void import_helenite.ui.confirm(plugin.app, {
        title: `Delete ${item.name}`,
        message: `Delete ${item.name}? This cannot be undone.`,
        action: "Delete",
        danger: true,
        onConfirm: () => plugin.remove(item)
      })
    }
  ];
}
function openItem(plugin, item) {
  let name = item.name;
  return import_helenite.ui.dialog(plugin.app, {
    title: "Edit item",
    width: "wide",
    render: (body, ctx) => {
      const { main, side } = ctx.sidePanel();
      import_helenite.ui.textInput(import_helenite.ui.field(main, { label: "Name", fill: true }).control, { value: name, onInput: (v) => name = v });
      import_helenite.ui.keyValue(side, [
        { key: "Kind", value: item.kind },
        { key: "Status", value: statusOf(item).text },
        { key: "Pinned", value: item.pinned ? "Yes" : "No" }
      ]);
    },
    actions: [{
      text: "Save",
      variant: "primary",
      onClick: async (ctx) => {
        if (!name.trim()) throw new Error("Enter a name.");
        item.name = name.trim();
        await plugin.save();
        ctx.close(null);
      }
    }]
  });
}

// src/settings.ts
var SampleSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  plugin;
  display() {
    const { plugin } = this;
    const el = this.containerEl;
    el.empty();
    const items = import_helenite2.ui.settings.section(el, "Items");
    const manage = import_helenite2.ui.settings.subpageRow(this.app, items, {
      name: "Manage items",
      desc: count(plugin.data.items.length, "item"),
      title: "Items",
      // The tab stays drawn under the sub-page, so a change there updates this row too.
      render: (page) => this.renderItems(page, () => manage.setDesc(count(plugin.data.items.length, "item")))
    });
    import_helenite2.ui.settings.summaryRow(items, {
      name: "About this sample",
      desc: "Where to see every part.",
      chevron: true,
      onClick: () => import_helenite2.ui.settings.openSubpage(this.app, "About this sample", (page) => {
        import_helenite2.ui.callout(page, { tone: "info", text: "The component ribbon icon, or the command \u201CShow design-system parts\u201D, opens a tab with every part." });
      })
    });
    new import_helenite2.ui.settings.row(items).setName("Two-line rows").setDesc("Show details under each item.").addToggle((t) => t.setValue(plugin.data.density === "detailed").onChange((on) => {
      plugin.data.density = on ? "detailed" : "compact";
      void plugin.save();
    }));
    new import_helenite2.ui.settings.row(items).setName("Sync").setDesc("Not available in this sample.").addDropdown((d) => d.addOption("off", "Off")).setDisabled(true);
    const access = import_helenite2.ui.settings.section(el, "Access", { desc: "Demo values: nothing is shared." });
    const card = import_helenite2.ui.settings.card(access, { name: "Item sync", desc: "sample", icon: "refresh-cw", status: { text: "Not connected", tone: "warning" } });
    import_helenite2.ui.action(card.head.controlEl, "reconnect", { onClick: () => card.setStatus({ text: "Connected", tone: "success" }) });
    import_helenite2.ui.settings.vaultScope(card.body, {
      value: plugin.data.scope,
      vaults: [{ id: "work", name: "Work" }, { id: "notes", name: "Notes" }, { id: "old", name: "Archive", disabled: "Closed vault" }],
      homeNote: true,
      confirmAll: () => import_helenite2.ui.confirm(this.app, { title: "Allow all vaults", message: "Let every vault use item sync?", action: "Allow all" }),
      onChange: (scope2) => {
        plugin.data.scope = scope2;
        void plugin.save();
      }
    });
    const scope = import_helenite2.ui.settings.section(el, "Scope bar", { desc: "For a page that edits both Home and the Vault Defaults." });
    import_helenite2.ui.settings.scopeBar(scope, { editingDefaults: false, onChange: () => {
    } });
  }
  renderItems(page, onChange) {
    const table = itemTable(page, this.plugin, this.plugin.data.items, () => {
      table.setRows(this.plugin.data.items);
      onChange();
    });
  }
};

// src/view.ts
var import_obsidian2 = require("obsidian");
var import_helenite9 = require("helenite");

// src/pages/board.ts
var import_helenite3 = require("helenite");
function drawBoard(el, plugin, hold) {
  const board = import_helenite3.ui.board(el, {
    label: "Items",
    onDragStart: () => hold(true),
    onDragEnd: () => hold(false),
    onDrop: (id, lane, index) => {
      const status = STATUSES.find((s) => s.id === lane);
      if (status) void plugin.move(id, status.id, index);
    }
  });
  for (const status of STATUSES) {
    const items = plugin.data.items.filter((i) => i.status === status.id);
    const lane = board.lane({ id: status.id, label: status.text, title: status.text, onTitleClick: () => import_helenite3.ui.notice(`${items.length} in ${status.text}`) });
    import_helenite3.ui.badge(lane.head, String(items.length), status.tone);
    if (!items.length) import_helenite3.ui.emptyState(lane.list, "No items", { variant: "inline" });
    for (const item of items) {
      const card = lane.card({
        id: item.id,
        label: item.name,
        onOpen: () => void openItem(plugin, item),
        check: { checked: status.id === "done", label: `Done: ${item.name}`, onToggle: (done) => void plugin.move(item.id, done ? "done" : "todo", 0) }
      });
      card.content.setText(item.name);
      import_helenite3.ui.moreButton(card.actions, () => itemMenu(plugin, item));
      import_helenite3.ui.badge(card.meta, item.kind);
      if (item.pinned) import_helenite3.ui.chip(card.meta, "Pinned", { tone: "accent" });
    }
    if (status.id === "todo") import_helenite3.ui.button(lane.footer, { text: "Add item", icon: "plus", variant: "link", onClick: () => void plugin.addItem() });
  }
}

// src/pages/cards.ts
var import_helenite4 = require("helenite");
function drawCards(el) {
  const card = import_helenite4.ui.card(import_helenite4.ui.settings.section(el, "Card"), { title: "Reading list", icon: "file-text" });
  import_helenite4.ui.statusText(card.body, "Synced a minute ago", "success");
  import_helenite4.ui.button(card.footer, { text: "Open", onClick: () => void import_helenite4.ui.notice("Opened Reading list") });
  const warning = import_helenite4.ui.card(import_helenite4.ui.settings.section(el, "Card that needs attention"), { title: "Which folder?", icon: "circle-help", tone: "warning", attention: true });
  import_helenite4.ui.choiceList(warning.body, {
    label: "Folder",
    options: [{ value: "notes", text: "Notes", key: "1" }, { value: "archive", text: "Archive", key: "2" }],
    onChange: (v) => void import_helenite4.ui.notice(`Picked ${v}`)
  });
  const more = import_helenite4.ui.disclosure(import_helenite4.ui.settings.section(el, "Disclosure"), { title: "About this list", summary: "Notes and links", open: true });
  import_helenite4.ui.badge(more.lead, "1", "accent");
  import_helenite4.ui.keyValue(more.body, [
    { key: "Folder", value: "Notes/Lists" },
    { key: "Kinds", value: ["note", "link"], isNew: (k) => k === "link" },
    { key: "Secrets", value: [], empty: "None" }
  ]);
  import_helenite4.ui.codeBlock(import_helenite4.ui.settings.section(el, "Code block"), "const card = ui.card(el, { title: 'Reading list', icon: 'file-text' });\nui.statusText(card.body, 'Synced a minute ago', 'success');", { label: "Card code" });
  const heading = import_helenite4.ui.sectionHeading(el, { title: "Collection", extra: "3 items", level: 3 });
  import_helenite4.ui.button(heading.actions, { text: "Refresh", onClick: () => void import_helenite4.ui.notice("Up to date") });
  import_helenite4.ui.statTiles(el, [{ value: "3", label: "Items", onClick: () => void import_helenite4.ui.notice("3 items") }, { value: "1", label: "Unread" }]);
  const grid = import_helenite4.ui.mediaGrid(el, { minWidth: 120 });
  for (const title of ["Reading list", "Ideas"]) {
    const item = import_helenite4.ui.mediaCard(grid, { art: { title }, title });
    import_helenite4.ui.rating(item.body, { value: 4 });
    import_helenite4.ui.figures(item.body, [{ text: "12", label: "Notes", icon: "file-text" }]);
    import_helenite4.ui.button(item.footer, { text: "Open", onClick: () => void import_helenite4.ui.notice(`Opened ${title}`) });
  }
  import_helenite4.ui.artwork(import_helenite4.ui.mediaGrid(el, { layout: "strip", minWidth: 80 }), { title: "No cover", onClick: () => void import_helenite4.ui.notice("No cover yet") });
  import_helenite4.ui.monthGrid(import_helenite4.ui.settings.section(el, "Month"), { month: /* @__PURE__ */ new Date(), events: (day) => day.endsWith("-15") ? [{ title: "Review", lead: "9:00" }] : [] });
  const talk = import_helenite4.ui.thread(import_helenite4.ui.settings.section(el, "Thread"));
  talk.event("Nov 26, 9:00 AM \xB7 Item added");
  const asked = talk.entry();
  import_helenite4.ui.threadText(import_helenite4.ui.card(asked.el, { compact: true, title: "Ada", icon: "user" }).body, "Should this go in the archive?");
  const answer = asked.replies().entry();
  import_helenite4.ui.threadText(import_helenite4.ui.card(answer.el, { compact: true, title: "You", icon: "user", tone: "accent" }).body, "Not yet.\nAfter the review.");
}

// src/pages/dialogs.ts
var import_helenite5 = require("helenite");
function drawDialogs(el, plugin) {
  const { app } = plugin;
  const modals = import_helenite5.ui.toolbar(import_helenite5.ui.settings.section(el, "Modals"), { label: "Modals" });
  import_helenite5.ui.button(modals, {
    text: "Confirm",
    onClick: () => void import_helenite5.ui.confirm(app, { title: "Discard changes", message: "Discard the changes to this item?", action: "Discard", danger: true })
  });
  import_helenite5.ui.button(modals, { text: "Prompt", onClick: () => void import_helenite5.ui.prompt(app, { title: "Rename item", label: "Name", value: "Reading list", action: "Rename" }) });
  import_helenite5.ui.button(modals, {
    text: "Choose",
    onClick: () => void import_helenite5.ui.choose(app, {
      title: "Pick a template",
      options: [{ value: "blank", text: "Blank", detail: "An empty note", icon: "file" }, { value: "daily", text: "Daily note", detail: "Headings for the day", icon: "calendar" }]
    })
  });
  import_helenite5.ui.button(modals, {
    text: "Form",
    onClick: () => void import_helenite5.ui.form(app, {
      title: "Import items",
      action: "Import",
      message: "Copies the items from a folder into this list.",
      fields: [
        { id: "path", kind: "text", label: "Folder", placeholder: "Notes/Lists" },
        { id: "kind", kind: "select", label: "Kind", options: [{ value: "note", label: "Note" }, { value: "link", label: "Link" }] },
        { id: "when", kind: "choice", label: "When", value: "now", options: [{ value: "now", label: "Now" }, { value: "later", label: "Tonight" }] },
        { id: "parts", kind: "multi", label: "Include", value: ["tags"], options: [{ value: "tags", label: "Tags" }, { value: "links", label: "Links" }] },
        { id: "open", kind: "checkbox", label: "Open when done", value: true }
      ]
    })
  });
  import_helenite5.ui.button(modals, {
    text: "Dialog",
    onClick: () => void import_helenite5.ui.dialog(app, {
      title: "Export items",
      icon: "download",
      render: (body) => void import_helenite5.ui.keyValue(body, [{ key: "Items", value: String(plugin.data.items.length) }, { key: "Format", value: "Markdown" }]),
      actions: [{ text: "Export", variant: "primary", onClick: (ctx) => ctx.close("exported") }]
    })
  });
  const items = () => [
    { title: "Rename", icon: "pencil", onClick: () => void import_helenite5.ui.notice("Rename") },
    { title: "Pinned", checked: true, onClick: () => {
    } },
    "separator",
    { title: "Delete", icon: "trash-2", danger: true, onClick: () => void import_helenite5.ui.notice("Delete") }
  ];
  const floating = import_helenite5.ui.toolbar(import_helenite5.ui.settings.section(el, "Popovers and menus"), { label: "Popovers and menus" });
  const anchor = import_helenite5.ui.button(floating, {
    text: "Popover",
    onClick: () => {
      const pop = import_helenite5.ui.popover(anchor.el, { title: "Quick note", icon: "message-circle", quote: "The text it is about." });
      import_helenite5.ui.textInput(pop.body, { placeholder: "Add a note", label: "Note" });
      import_helenite5.ui.button(pop.footer, { text: "Save", variant: "primary", onClick: () => pop.close() });
    }
  });
  const opener = import_helenite5.ui.button(floating, {
    text: "Menu",
    onClick: () => {
      const { left, bottom } = opener.el.getBoundingClientRect();
      import_helenite5.ui.menu(items(), { x: left, y: bottom }, { doc: opener.el.ownerDocument });
    }
  });
  import_helenite5.ui.menuButton(floating, { text: "Add to\u2026", items });
  import_helenite5.ui.moreButton(floating, items);
  const notices = import_helenite5.ui.toolbar(import_helenite5.ui.settings.section(el, "Notices"), { label: "Notices" });
  for (const kind of ["info", "success", "error"]) {
    import_helenite5.ui.button(notices, { text: kind, onClick: () => void import_helenite5.ui.notice(`This is a ${kind} notice.`, { kind }) });
  }
  import_helenite5.ui.button(notices, {
    text: "With an action",
    onClick: () => void import_helenite5.ui.notice("2 items need review.", { action: { text: "Review", onClick: () => void import_helenite5.ui.notice("Reviewing.") } })
  });
  const actions = import_helenite5.ui.toolbar(import_helenite5.ui.settings.section(el, "Standard actions"), { label: "Standard actions" });
  for (const id of Object.keys(import_helenite5.ui.STANDARD_ACTIONS)) {
    import_helenite5.ui.action(actions, id, { app, subject: "Example", onClick: () => void import_helenite5.ui.notice(import_helenite5.ui.STANDARD_ACTIONS[id].label) });
  }
}

// src/pages/inputs.ts
var import_helenite6 = require("helenite");
function drawInputs(el) {
  const buttons = import_helenite6.ui.toolbar(import_helenite6.ui.settings.section(el, "Buttons"), { label: "Button variants" });
  import_helenite6.ui.button(buttons, { text: "Default" });
  import_helenite6.ui.button(buttons, { text: "Primary", variant: "primary" });
  import_helenite6.ui.button(buttons, { text: "Danger", variant: "danger" });
  import_helenite6.ui.button(buttons, { text: "Link", variant: "link" });
  import_helenite6.ui.button(buttons, { variant: "icon", icon: "settings", label: "Configure" });
  import_helenite6.ui.button(buttons, { text: "Pressed", pressed: true });
  import_helenite6.ui.button(buttons, { text: "Disabled", disabled: true });
  const fields = import_helenite6.ui.settings.section(el, "Fields");
  const name = import_helenite6.ui.field(fields, { label: "Name", hint: "Shown in the lists.", fill: true });
  import_helenite6.ui.textInput(name.control, { value: "Reading list", onInput: (v) => name.setError(v.trim() ? null : "Enter a name.") });
  const key = import_helenite6.ui.field(fields, { label: "API key", fill: true });
  import_helenite6.ui.textInput(key.control, { secret: true, placeholder: "Paste the key" });
  const note = import_helenite6.ui.field(fields, { label: "Description", fill: true });
  import_helenite6.ui.textInput(note.control, { multiline: true, rows: 3, placeholder: "What the item is for" });
  const invalid = import_helenite6.ui.field(fields, { label: "Limit", inline: true });
  import_helenite6.ui.textInput(invalid.control, { type: "number", value: "0" });
  invalid.setError("Enter a number above 0.");
  const kind = import_helenite6.ui.field(fields, { label: "Kind", inline: true });
  import_helenite6.ui.dropdown(kind.control, { options: [{ value: "note", text: "Note" }, { value: "link", text: "Link" }], value: "note" });
  const switches = import_helenite6.ui.settings.section(el, "Switches and sliders");
  const toggles = import_helenite6.ui.toolbar(switches, { label: "Switches" });
  import_helenite6.ui.toggle(toggles, { value: true, label: "Show finished items" });
  import_helenite6.ui.toggle(toggles, { value: false, label: "Sync items", disabled: true });
  import_helenite6.ui.slider(import_helenite6.ui.field(switches, { label: "Items per page", inline: true }).control, { min: 10, max: 50, step: 5, value: 25, label: "Items per page", onChange: () => {
  } });
  const lists = import_helenite6.ui.settings.section(el, "Lists to pick from");
  import_helenite6.ui.checkList(import_helenite6.ui.field(lists, { label: "Show kinds", fill: true }).control, {
    options: [
      { value: "note", text: "Notes", detail: "Markdown files in this vault" },
      { value: "link", text: "Links" },
      { value: "file", text: "Files", detail: "Not supported yet", disabled: true }
    ],
    value: ["note", "link"]
  });
  import_helenite6.ui.choiceList(import_helenite6.ui.field(lists, { label: "Open items in", fill: true }).control, {
    indicator: "radio",
    options: [
      { value: "tab", text: "A new tab", detail: "Keeps this view open", icon: "plus-square", tag: "Default", key: "1" },
      { value: "split", text: "A split", icon: "columns-2", key: "2" },
      { value: "window", text: "A new window", icon: "app-window", key: "3", disabled: true }
    ],
    value: "tab",
    onChange: () => {
    }
  });
  const compose = import_helenite6.ui.settings.section(el, "Composer");
  import_helenite6.ui.composer(compose, {
    placeholder: "Add a comment",
    hint: "Enter sends, Shift+Enter starts a new line.",
    onAttach: () => [{ name: "notes.md" }],
    onSubmit: (text) => void import_helenite6.ui.notice(`Sent: ${text}`)
  });
}

// src/pages/items.ts
var import_helenite7 = require("helenite");
function drawItems(el, plugin, filter) {
  const bar = import_helenite7.ui.toolbar(el, { label: "Item filters" });
  import_helenite7.ui.searchInput(bar, {
    placeholder: "Search items",
    value: filter.query,
    onSearch: (q) => {
      filter.query = q;
      draw();
    }
  });
  import_helenite7.ui.dropdown(bar, {
    label: "Kind",
    compact: true,
    value: filter.kind,
    options: [{ value: "all", text: "All kinds" }, { value: "note", text: "Notes" }, { value: "link", text: "Links" }],
    onChange: (kind) => {
      filter.kind = kind;
      draw();
    }
  });
  import_helenite7.ui.segmented(bar, {
    label: "View:",
    value: filter.layout,
    options: [{ value: "list", text: "List" }, { value: "table", text: "Table" }],
    onChange: (layout) => {
      filter.layout = layout;
      draw();
    }
  });
  import_helenite7.ui.button(bar, { text: "Add item", variant: "primary", onClick: () => void plugin.addItem() }).el.classList.add("hel-toolbar-end");
  const list = el.createDiv();
  const draw = () => {
    list.empty();
    const q = filter.query.toLowerCase();
    const items = plugin.data.items.filter((i) => i.name.toLowerCase().includes(q) && (filter.kind === "all" || i.kind === filter.kind));
    if (!items.length) {
      import_helenite7.ui.emptyState(list, plugin.data.items.length ? "No items match." : "No items yet.");
      return;
    }
    if (filter.layout === "table") itemTable(list, plugin, items);
    else drawGroups(list, plugin, items);
  };
  draw();
}
function drawGroups(el, plugin, items) {
  const detailed = plugin.data.density === "detailed";
  for (const status of STATUSES) {
    const rows = items.filter((i) => i.status === status.id);
    if (!rows.length) continue;
    const group = import_helenite7.ui.listGroup(el, { title: status.text, count: rows.length });
    for (const item of rows) {
      import_helenite7.ui.listRow(group.body, {
        title: item.name,
        dot: { tone: statusOf(item).tone, label: statusOf(item).text },
        tag: item.pinned ? "Pinned" : void 0,
        meta: item.kind,
        // The detailed density adds a second line and a line of chips.
        sub: detailed ? `${statusOf(item).text} \xB7 added from the sample` : void 0,
        chips: detailed && item.pinned ? [{ text: "pinned", tone: "accent" }, item.kind] : void 0,
        actions: [{ icon: "pencil", label: "Rename", id: "rename", onClick: () => void plugin.rename(item) }],
        onClick: () => void openItem(plugin, item),
        menu: () => itemMenu(plugin, item)
      });
    }
  }
}

// src/pages/status.ts
var import_helenite8 = require("helenite");
var TONES = ["default", "accent", "success", "warning", "danger"];
function drawStatus(el) {
  const callouts = import_helenite8.ui.settings.section(el, "Callouts");
  import_helenite8.ui.callout(callouts, { tone: "info", text: "Items are saved in this vault." });
  import_helenite8.ui.callout(callouts, { tone: "accent", text: "2 items are waiting for you.", action: { text: "Review", onClick: () => void import_helenite8.ui.notice("Nothing to review.") } });
  import_helenite8.ui.callout(callouts, { tone: "success", text: "Everything is up to date." });
  import_helenite8.ui.callout(callouts, { tone: "warning", text: "This link has not been checked for a month." });
  import_helenite8.ui.callout(callouts, { tone: "danger", text: "Could not reach the server." });
  import_helenite8.ui.callout(callouts, { tone: "accent", solid: true, text: "An agent is waiting on you." });
  const labels = import_helenite8.ui.settings.section(el, "Badges, dots, counts, chips, avatars and swatches");
  const row = (name) => new import_helenite8.ui.settings.row(labels).setName(name).controlEl;
  const badges = row("Badges");
  for (const tone of TONES) import_helenite8.ui.badge(badges, tone, tone);
  const dots = row("Status dots");
  for (const tone of TONES) import_helenite8.ui.statusDot(dots, tone, tone);
  import_helenite8.ui.statusDot(dots, "warning", "Waiting for you", { pulse: true });
  const words = row("Status text");
  for (const tone of TONES) import_helenite8.ui.statusText(words, tone, tone);
  const counts = row("Counts");
  import_helenite8.ui.countBadge(counts, 3, { label: "unread" });
  import_helenite8.ui.countBadge(counts, 12, { label: "waiting", tone: "danger", icon: "circle-help" });
  const chips = row("Chips");
  import_helenite8.ui.chip(chips, "project");
  import_helenite8.ui.chip(chips, "draft", { tone: "accent", onRemove: () => {
  } });
  import_helenite8.ui.chip(chips, "broken", { tone: "danger" });
  const people = row("Avatars");
  for (const size of ["small", "medium", "large"]) import_helenite8.ui.avatar(people, { text: "Ada Lovelace", size });
  import_helenite8.ui.avatar(people, { text: "+3" });
  const values = row("Swatches");
  import_helenite8.ui.swatch(values, { kind: "color", value: "var(--interactive-accent)", label: "--interactive-accent" });
  import_helenite8.ui.swatch(values, { kind: "radius", value: "var(--radius-m)", label: "--radius-m" });
  import_helenite8.ui.swatch(values, { kind: "shadow", value: "var(--shadow-s)", label: "--shadow-s" });
  import_helenite8.ui.swatch(values, { kind: "size", value: "var(--size-4-6)", label: "--size-4-6" });
  import_helenite8.ui.swatch(values, { kind: "font-family", value: "var(--font-monospace)", label: "--font-monospace" });
  const readings = import_helenite8.ui.settings.section(el, "Meters");
  const inline = new import_helenite8.ui.settings.row(readings).setName("Inline").controlEl;
  import_helenite8.ui.meter(inline, { label: "Storage", value: 30, text: "30%", tone: "success" });
  import_helenite8.ui.meter(inline, { label: "Quota", value: 75, text: "75%", tone: "warning" });
  import_helenite8.ui.meter(readings, { layout: "stacked", label: "Monthly budget", value: 96, text: "$48 of $50", sub: "resets in 3 days", tone: "danger" });
  const added = [2, 5, 3, 0, 6, 8, 4, 7, 1, 9].map((value, i) => ({ day: `Nov ${i + 12}`, value }));
  const chart = import_helenite8.ui.settings.section(el, "Bar chart");
  import_helenite8.ui.barChart(chart, {
    label: "Items added per day",
    buckets: added.map(({ day, value }) => ({ key: day, value, title: `${day}: ${count(value, "item")}` }))
  });
  const most = added.reduce((a, b) => b.value > a.value ? b : a);
  const total = added.reduce((sum, d) => sum + d.value, 0);
  import_helenite8.ui.statusText(chart, `${count(total, "item")} added; the most, ${most.value}, on ${most.day}.`);
  const waiting = import_helenite8.ui.settings.section(el, "Loading");
  import_helenite8.ui.loadingState(waiting, "Loading items\u2026");
  import_helenite8.ui.loadingState(waiting, "Importing", { progress: 0.4 });
  import_helenite8.ui.emptyState(import_helenite8.ui.settings.section(el, "Empty state"), "No items yet.");
  import_helenite8.ui.errorState(import_helenite8.ui.settings.section(el, "Error state"), "Could not load the items.", () => void import_helenite8.ui.notice("Trying again."));
  const small = import_helenite8.ui.settings.section(el, "Inline states, for a settings list");
  import_helenite8.ui.emptyState(small, "No accounts yet.", { variant: "inline" });
  import_helenite8.ui.errorState(small, "Could not connect.", () => {
  }, { variant: "inline", retryLabel: "Reconnect" });
}

// src/view.ts
var VIEW_TYPE = "sample-design-system";
var PAGES = [
  { id: "items", text: "Items" },
  { id: "board", text: "Board" },
  { id: "inputs", text: "Inputs" },
  { id: "status", text: "Status" },
  { id: "cards", text: "Cards" },
  { id: "dialogs", text: "Dialogs" }
];
var SampleView = class extends import_obsidian2.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  plugin;
  page = "items";
  tabs = null;
  header = null;
  dragging = false;
  stale = false;
  /** Kept here so a redraw after a save does not lose the search or the layout. */
  filter = { query: "", kind: "all", layout: "list" };
  getViewType() {
    return VIEW_TYPE;
  }
  getDisplayText() {
    return "Design-system parts";
  }
  getIcon() {
    return "component";
  }
  async onOpen() {
    this.contentEl.empty();
    this.tabs = import_helenite9.ui.tabs(this.contentEl, {
      tabs: PAGES.map((p) => ({ ...p })),
      value: this.page,
      onSelect: (id) => {
        this.page = id;
        this.drawPage();
      }
    });
    this.refresh();
  }
  /** Redraws what shows the plugin's data, after a drag if one is under way. The Inputs page holds what the user typed, so it is left alone. */
  refresh() {
    if (this.dragging) {
      this.stale = true;
      return;
    }
    this.drawHeader();
    this.tabs?.setBadge("items", this.plugin.data.items.length);
    if (this.page !== "inputs" || !this.tabs?.el.nextElementSibling) this.drawPage();
  }
  hold(dragging) {
    this.dragging = dragging;
    if (dragging || !this.stale) return;
    this.stale = false;
    this.refresh();
  }
  drawHeader() {
    this.header?.remove();
    this.header = import_helenite9.ui.paneHeader(this.contentEl, [
      { icon: "plus", label: "Add item", id: "add", onClick: () => void this.plugin.addItem() },
      // One line or two per row. The header is rebuilt on a change, so the icon follows.
      import_helenite9.ui.densityAction(this.plugin.data.density, (density) => {
        this.plugin.data.density = density;
        void this.plugin.save();
      })
    ]);
  }
  drawPage() {
    const el = this.contentEl;
    while (this.tabs?.el.nextSibling) this.tabs.el.nextSibling.remove();
    el.toggleClass("hel-board-page", this.page === "board");
    if (this.page === "board") return drawBoard(el, this.plugin, (dragging) => this.hold(dragging));
    const page = el.createDiv();
    if (this.page === "items") drawItems(page, this.plugin, this.filter);
    else if (this.page === "inputs") drawInputs(page);
    else if (this.page === "status") drawStatus(page);
    else if (this.page === "cards") drawCards(page);
    else drawDialogs(page, this.plugin);
  }
};

// src/main.ts
var SampleDesignSystemPlugin = class extends import_obsidian3.Plugin {
  data = readData(null);
  status = null;
  count = null;
  async onload() {
    this.data = readData(await this.loadData());
    this.registerView(VIEW_TYPE, (leaf) => new SampleView(leaf, this));
    this.addSettingTab(new SampleSettingTab(this.app, this));
    this.addRibbonIcon("plus", "Add item", () => void this.addItem());
    const ribbon = this.addRibbonIcon("component", "Show design-system parts", () => void this.openView());
    this.count = import_helenite10.ui.countBadge(ribbon, 0, { overlay: true, label: "open items" });
    this.status = import_helenite10.ui.statusText(this.addStatusBarItem(), "");
    this.addCommand({ id: "show-parts", name: "Show design-system parts", callback: () => void this.openView() });
    this.addCommand({ id: "add-item", name: "Add item", callback: () => void this.addItem() });
    this.showCounts();
  }
  /** Saves, then redraws everything that shows the items. */
  async save() {
    await this.saveData(this.data);
    this.showCounts();
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (leaf.view instanceof SampleView) leaf.view.refresh();
    }
  }
  showCounts() {
    const open = this.data.items.filter((i) => i.status !== "done").length;
    this.count?.set(open);
    this.status?.setText(count(open, "open item"));
  }
  async openView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = workspace.getLeaf("tab");
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    await workspace.revealLeaf(leaf);
  }
  /** The ribbon icon: a form modal, then a notice that echoes the values. */
  async addItem() {
    const values = await import_helenite10.ui.form(this.app, {
      title: "Add item",
      action: "Add",
      fields: [
        { id: "name", kind: "text", label: "Name", placeholder: "Item name" },
        { id: "kind", kind: "select", label: "Kind", value: "note", options: [{ value: "note", label: "Note" }, { value: "link", label: "Link" }] },
        { id: "pinned", kind: "checkbox", label: "Pin it", detail: "Marks it in the lists", value: false }
      ]
    });
    if (!values) return;
    const name = String(values.name).trim() || "Untitled";
    const pinned = values.pinned === true;
    this.data.items.push({ id: String(Date.now()), name, kind: values.kind, status: "todo", pinned });
    await this.save();
    import_helenite10.ui.notice(`Added ${name} (${values.kind}${pinned ? ", pinned" : ""})`, { kind: "success" });
  }
  async move(id, status, index) {
    const item = this.data.items.find((i) => i.id === id);
    if (!item) return;
    const rest = this.data.items.filter((i) => i !== item);
    item.status = status;
    const before = index === void 0 ? void 0 : rest.filter((i) => i.status === status)[index];
    rest.splice(before ? rest.indexOf(before) : rest.length, 0, item);
    this.data.items = rest;
    await this.save();
  }
  async rename(item) {
    const name = await import_helenite10.ui.prompt(this.app, {
      title: "Rename item",
      label: "Name",
      value: item.name,
      action: "Rename",
      validate: (v) => v.trim() ? null : "Enter a name."
    });
    if (name === null) return;
    item.name = name.trim();
    await this.save();
  }
  async remove(item) {
    this.data.items = this.data.items.filter((i) => i.id !== item.id);
    await this.save();
    import_helenite10.ui.notice(`Deleted ${item.name}`, { kind: "success" });
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL21haW4udHMiLCAiLi4vc3JjL2RhdGEudHMiLCAiLi4vc3JjL3NldHRpbmdzLnRzIiwgIi4uL3NyYy9pdGVtLXBhcnRzLnRzIiwgIi4uL3NyYy92aWV3LnRzIiwgIi4uL3NyYy9wYWdlcy9ib2FyZC50cyIsICIuLi9zcmMvcGFnZXMvY2FyZHMudHMiLCAiLi4vc3JjL3BhZ2VzL2RpYWxvZ3MudHMiLCAiLi4vc3JjL3BhZ2VzL2lucHV0cy50cyIsICIuLi9zcmMvcGFnZXMvaXRlbXMudHMiLCAiLi4vc3JjL3BhZ2VzL3N0YXR1cy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLy8gU2FtcGxlIHBsdWdpbiBmb3IgSGVsZW5pdGUncyBkZXNpZ24gc3lzdGVtIChgaW1wb3J0IHsgdWkgfSBmcm9tICdoZWxlbml0ZSdgKS4gUmVhZCBkb2NzL2Rlc2lnbi1zeXN0ZW0vUkVBRE1FLm1kIGZpcnN0LlxuLy8gSXQgc2hvd3MgZXZlcnkgcGFydCwgYW5kIGl0IGhhcyBubyBzdHlsZXNoZWV0OiB0aGUgcGFydHMgYnJpbmcgdGhlIGxvb2ssIGluIGxpZ2h0IGFuZCBkYXJrLCB3aXRoIGV2ZXJ5IHRoZW1lLlxuLy8gSXQgaXMgbm90IGEgY29yZSBwbHVnaW4gYW5kIGlzIG5vdCBlbmFibGVkIGJ5IGRlZmF1bHQuIEJ1aWxkIGl0IHdpdGggYG5vZGUgc2NyaXB0cy9idWlsZC1wbHVnaW4ubWpzIHNhbXBsZS1kZXNpZ24tc3lzdGVtYC5cbmltcG9ydCB7IFBsdWdpbiB9IGZyb20gJ29ic2lkaWFuJztcbi8vIEltcG9ydGVkIHN0YXRpY2FsbHkgYmVjYXVzZSB0aGlzIHBsdWdpbiBpcyBIZWxlbml0ZS1vbmx5LiBBIHBsdWdpbiB0aGF0IGFsc28gcnVucyBpbiBPYnNpZGlhbiBtdXN0IGd1YXJkIHRoZSByZXF1aXJlXG4vLyAoc2VlIFwiUGx1Z2lucyB0aGF0IHJ1biBpbiBPYnNpZGlhbiB0b29cIiBpbiBkb2NzL2Rlc2lnbi1zeXN0ZW0vUkVBRE1FLm1kKS5cbmltcG9ydCB7IHVpLCB0eXBlIENvdW50QmFkZ2VIYW5kbGUgfSBmcm9tICdoZWxlbml0ZSc7XG5pbXBvcnQgeyBjb3VudCwgcmVhZERhdGEsIHR5cGUgRGF0YSwgdHlwZSBJdGVtLCB0eXBlIEtpbmQsIHR5cGUgU3RhdHVzIH0gZnJvbSAnLi9kYXRhJztcbmltcG9ydCB7IFNhbXBsZVNldHRpbmdUYWIgfSBmcm9tICcuL3NldHRpbmdzJztcbmltcG9ydCB7IFNhbXBsZVZpZXcsIFZJRVdfVFlQRSB9IGZyb20gJy4vdmlldyc7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFNhbXBsZURlc2lnblN5c3RlbVBsdWdpbiBleHRlbmRzIFBsdWdpbiB7XG4gIGRhdGE6IERhdGEgPSByZWFkRGF0YShudWxsKTtcbiAgcHJpdmF0ZSBzdGF0dXM6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgY291bnQ6IENvdW50QmFkZ2VIYW5kbGUgfCBudWxsID0gbnVsbDtcblxuICBhc3luYyBvbmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5kYXRhID0gcmVhZERhdGEoYXdhaXQgdGhpcy5sb2FkRGF0YSgpKTtcbiAgICB0aGlzLnJlZ2lzdGVyVmlldyhWSUVXX1RZUEUsIChsZWFmKSA9PiBuZXcgU2FtcGxlVmlldyhsZWFmLCB0aGlzKSk7XG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBTYW1wbGVTZXR0aW5nVGFiKHRoaXMuYXBwLCB0aGlzKSk7XG4gICAgdGhpcy5hZGRSaWJib25JY29uKCdwbHVzJywgJ0FkZCBpdGVtJywgKCkgPT4gdm9pZCB0aGlzLmFkZEl0ZW0oKSk7XG4gICAgY29uc3QgcmliYm9uID0gdGhpcy5hZGRSaWJib25JY29uKCdjb21wb25lbnQnLCAnU2hvdyBkZXNpZ24tc3lzdGVtIHBhcnRzJywgKCkgPT4gdm9pZCB0aGlzLm9wZW5WaWV3KCkpO1xuICAgIHRoaXMuY291bnQgPSB1aS5jb3VudEJhZGdlKHJpYmJvbiwgMCwgeyBvdmVybGF5OiB0cnVlLCBsYWJlbDogJ29wZW4gaXRlbXMnIH0pO1xuICAgIC8vIFN0YXR1cyB0ZXh0IGluIGEgc3RhdHVzIGJhciBpdGVtIHRha2VzIHRoZSBiYXIncyBzaXplIGJ5IGl0c2VsZi5cbiAgICB0aGlzLnN0YXR1cyA9IHVpLnN0YXR1c1RleHQodGhpcy5hZGRTdGF0dXNCYXJJdGVtKCksICcnKTtcbiAgICB0aGlzLmFkZENvbW1hbmQoeyBpZDogJ3Nob3ctcGFydHMnLCBuYW1lOiAnU2hvdyBkZXNpZ24tc3lzdGVtIHBhcnRzJywgY2FsbGJhY2s6ICgpID0+IHZvaWQgdGhpcy5vcGVuVmlldygpIH0pO1xuICAgIHRoaXMuYWRkQ29tbWFuZCh7IGlkOiAnYWRkLWl0ZW0nLCBuYW1lOiAnQWRkIGl0ZW0nLCBjYWxsYmFjazogKCkgPT4gdm9pZCB0aGlzLmFkZEl0ZW0oKSB9KTtcbiAgICB0aGlzLnNob3dDb3VudHMoKTtcbiAgfVxuXG4gIC8qKiBTYXZlcywgdGhlbiByZWRyYXdzIGV2ZXJ5dGhpbmcgdGhhdCBzaG93cyB0aGUgaXRlbXMuICovXG4gIGFzeW5jIHNhdmUoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGhpcy5zYXZlRGF0YSh0aGlzLmRhdGEpO1xuICAgIHRoaXMuc2hvd0NvdW50cygpO1xuICAgIGZvciAoY29uc3QgbGVhZiBvZiB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFZJRVdfVFlQRSkpIHtcbiAgICAgIGlmIChsZWFmLnZpZXcgaW5zdGFuY2VvZiBTYW1wbGVWaWV3KSBsZWFmLnZpZXcucmVmcmVzaCgpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgc2hvd0NvdW50cygpOiB2b2lkIHtcbiAgICBjb25zdCBvcGVuID0gdGhpcy5kYXRhLml0ZW1zLmZpbHRlcigoaSkgPT4gaS5zdGF0dXMgIT09ICdkb25lJykubGVuZ3RoO1xuICAgIHRoaXMuY291bnQ/LnNldChvcGVuKTtcbiAgICB0aGlzLnN0YXR1cz8uc2V0VGV4dChjb3VudChvcGVuLCAnb3BlbiBpdGVtJykpO1xuICB9XG5cbiAgYXN5bmMgb3BlblZpZXcoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyB3b3Jrc3BhY2UgfSA9IHRoaXMuYXBwO1xuICAgIGxldCBsZWFmID0gd29ya3NwYWNlLmdldExlYXZlc09mVHlwZShWSUVXX1RZUEUpWzBdO1xuICAgIGlmICghbGVhZikge1xuICAgICAgbGVhZiA9IHdvcmtzcGFjZS5nZXRMZWFmKCd0YWInKTtcbiAgICAgIGF3YWl0IGxlYWYuc2V0Vmlld1N0YXRlKHsgdHlwZTogVklFV19UWVBFLCBhY3RpdmU6IHRydWUgfSk7XG4gICAgfVxuICAgIGF3YWl0IHdvcmtzcGFjZS5yZXZlYWxMZWFmKGxlYWYpO1xuICB9XG5cbiAgLyoqIFRoZSByaWJib24gaWNvbjogYSBmb3JtIG1vZGFsLCB0aGVuIGEgbm90aWNlIHRoYXQgZWNob2VzIHRoZSB2YWx1ZXMuICovXG4gIGFzeW5jIGFkZEl0ZW0oKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgdmFsdWVzID0gYXdhaXQgdWkuZm9ybSh0aGlzLmFwcCwge1xuICAgICAgdGl0bGU6ICdBZGQgaXRlbScsXG4gICAgICBhY3Rpb246ICdBZGQnLFxuICAgICAgZmllbGRzOiBbXG4gICAgICAgIHsgaWQ6ICduYW1lJywga2luZDogJ3RleHQnLCBsYWJlbDogJ05hbWUnLCBwbGFjZWhvbGRlcjogJ0l0ZW0gbmFtZScgfSxcbiAgICAgICAgeyBpZDogJ2tpbmQnLCBraW5kOiAnc2VsZWN0JywgbGFiZWw6ICdLaW5kJywgdmFsdWU6ICdub3RlJywgb3B0aW9uczogW3sgdmFsdWU6ICdub3RlJywgbGFiZWw6ICdOb3RlJyB9LCB7IHZhbHVlOiAnbGluaycsIGxhYmVsOiAnTGluaycgfV0gfSxcbiAgICAgICAgeyBpZDogJ3Bpbm5lZCcsIGtpbmQ6ICdjaGVja2JveCcsIGxhYmVsOiAnUGluIGl0JywgZGV0YWlsOiAnTWFya3MgaXQgaW4gdGhlIGxpc3RzJywgdmFsdWU6IGZhbHNlIH0sXG4gICAgICBdLFxuICAgIH0pO1xuICAgIGlmICghdmFsdWVzKSByZXR1cm47XG4gICAgY29uc3QgbmFtZSA9IFN0cmluZyh2YWx1ZXMubmFtZSkudHJpbSgpIHx8ICdVbnRpdGxlZCc7XG4gICAgY29uc3QgcGlubmVkID0gdmFsdWVzLnBpbm5lZCA9PT0gdHJ1ZTtcbiAgICB0aGlzLmRhdGEuaXRlbXMucHVzaCh7IGlkOiBTdHJpbmcoRGF0ZS5ub3coKSksIG5hbWUsIGtpbmQ6IHZhbHVlcy5raW5kIGFzIEtpbmQsIHN0YXR1czogJ3RvZG8nLCBwaW5uZWQgfSk7XG4gICAgYXdhaXQgdGhpcy5zYXZlKCk7XG4gICAgdWkubm90aWNlKGBBZGRlZCAke25hbWV9ICgke3ZhbHVlcy5raW5kfSR7cGlubmVkID8gJywgcGlubmVkJyA6ICcnfSlgLCB7IGtpbmQ6ICdzdWNjZXNzJyB9KTtcbiAgfVxuXG4gIGFzeW5jIG1vdmUoaWQ6IHN0cmluZywgc3RhdHVzOiBTdGF0dXMsIGluZGV4PzogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgaXRlbSA9IHRoaXMuZGF0YS5pdGVtcy5maW5kKChpKSA9PiBpLmlkID09PSBpZCk7XG4gICAgaWYgKCFpdGVtKSByZXR1cm47XG4gICAgY29uc3QgcmVzdCA9IHRoaXMuZGF0YS5pdGVtcy5maWx0ZXIoKGkpID0+IGkgIT09IGl0ZW0pO1xuICAgIGl0ZW0uc3RhdHVzID0gc3RhdHVzO1xuICAgIC8vIGBpbmRleGAgaXMgdGhlIHBsYWNlIGFtb25nIHRoZSBsYW5lJ3Mgb3RoZXIgaXRlbXM7IHdpdGhvdXQgb25lIHRoZSBpdGVtIGdvZXMgbGFzdC5cbiAgICBjb25zdCBiZWZvcmUgPSBpbmRleCA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkIDogcmVzdC5maWx0ZXIoKGkpID0+IGkuc3RhdHVzID09PSBzdGF0dXMpW2luZGV4XTtcbiAgICByZXN0LnNwbGljZShiZWZvcmUgPyByZXN0LmluZGV4T2YoYmVmb3JlKSA6IHJlc3QubGVuZ3RoLCAwLCBpdGVtKTtcbiAgICB0aGlzLmRhdGEuaXRlbXMgPSByZXN0O1xuICAgIGF3YWl0IHRoaXMuc2F2ZSgpO1xuICB9XG5cbiAgYXN5bmMgcmVuYW1lKGl0ZW06IEl0ZW0pOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBuYW1lID0gYXdhaXQgdWkucHJvbXB0KHRoaXMuYXBwLCB7XG4gICAgICB0aXRsZTogJ1JlbmFtZSBpdGVtJywgbGFiZWw6ICdOYW1lJywgdmFsdWU6IGl0ZW0ubmFtZSwgYWN0aW9uOiAnUmVuYW1lJyxcbiAgICAgIHZhbGlkYXRlOiAodikgPT4gKHYudHJpbSgpID8gbnVsbCA6ICdFbnRlciBhIG5hbWUuJyksXG4gICAgfSk7XG4gICAgaWYgKG5hbWUgPT09IG51bGwpIHJldHVybjtcbiAgICBpdGVtLm5hbWUgPSBuYW1lLnRyaW0oKTtcbiAgICBhd2FpdCB0aGlzLnNhdmUoKTtcbiAgfVxuXG4gIGFzeW5jIHJlbW92ZShpdGVtOiBJdGVtKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5kYXRhLml0ZW1zID0gdGhpcy5kYXRhLml0ZW1zLmZpbHRlcigoaSkgPT4gaS5pZCAhPT0gaXRlbS5pZCk7XG4gICAgYXdhaXQgdGhpcy5zYXZlKCk7XG4gICAgdWkubm90aWNlKGBEZWxldGVkICR7aXRlbS5uYW1lfWAsIHsga2luZDogJ3N1Y2Nlc3MnIH0pO1xuICB9XG59XG4iLCAiLy8gVGhlIHBsdWdpbidzIHNhdmVkIGRhdGEuIFRoZSBzYW1wbGUga2VlcHMgYSBzbWFsbCBsaXN0IG9mIGl0ZW1zIHNvIGV2ZXJ5IHBhcnQgaGFzIHNvbWV0aGluZyByZWFsIHRvIHNob3cuXG5pbXBvcnQgdHlwZSB7IFZhdWx0U2NvcGUgfSBmcm9tICdoZWxlbml0ZSc7XG5cbmV4cG9ydCB0eXBlIFN0YXR1cyA9ICd0b2RvJyB8ICdkb2luZycgfCAnZG9uZSc7XG5leHBvcnQgdHlwZSBLaW5kID0gJ25vdGUnIHwgJ2xpbmsnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEl0ZW0ge1xuICBpZDogc3RyaW5nO1xuICBuYW1lOiBzdHJpbmc7XG4gIGtpbmQ6IEtpbmQ7XG4gIHN0YXR1czogU3RhdHVzO1xuICBwaW5uZWQ6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRGF0YSB7XG4gIGl0ZW1zOiBJdGVtW107XG4gIGRlbnNpdHk6ICdjb21wYWN0JyB8ICdkZXRhaWxlZCc7XG4gIHNjb3BlOiBWYXVsdFNjb3BlO1xufVxuXG5leHBvcnQgY29uc3QgU1RBVFVTRVM6IHsgaWQ6IFN0YXR1czsgdGV4dDogc3RyaW5nOyB0b25lOiAnZGVmYXVsdCcgfCAnYWNjZW50JyB8ICdzdWNjZXNzJyB9W10gPSBbXG4gIHsgaWQ6ICd0b2RvJywgdGV4dDogJ1RvIGRvJywgdG9uZTogJ2RlZmF1bHQnIH0sXG4gIHsgaWQ6ICdkb2luZycsIHRleHQ6ICdEb2luZycsIHRvbmU6ICdhY2NlbnQnIH0sXG4gIHsgaWQ6ICdkb25lJywgdGV4dDogJ0RvbmUnLCB0b25lOiAnc3VjY2VzcycgfSxcbl07XG5cbi8qKiBcIjEgaXRlbVwiLCBcIjIgaXRlbXNcIi4gKi9cbmV4cG9ydCBjb25zdCBjb3VudCA9IChuOiBudW1iZXIsIG5vdW46IHN0cmluZykgPT4gYCR7bn0gJHtub3VufSR7biA9PT0gMSA/ICcnIDogJ3MnfWA7XG5cbmV4cG9ydCBjb25zdCBzdGF0dXNPZiA9IChpdGVtOiBJdGVtKSA9PiBTVEFUVVNFUy5maW5kKChzKSA9PiBzLmlkID09PSBpdGVtLnN0YXR1cykgPz8gU1RBVFVTRVNbMF07XG5cbmNvbnN0IFNFRUQ6IEl0ZW1bXSA9IFtcbiAgeyBpZDogJzEnLCBuYW1lOiAnUmVhZGluZyBsaXN0Jywga2luZDogJ25vdGUnLCBzdGF0dXM6ICdkb2luZycsIHBpbm5lZDogdHJ1ZSB9LFxuICB7IGlkOiAnMicsIG5hbWU6ICdEZXNpZ24gcmVmZXJlbmNlcycsIGtpbmQ6ICdsaW5rJywgc3RhdHVzOiAndG9kbycsIHBpbm5lZDogZmFsc2UgfSxcbiAgeyBpZDogJzMnLCBuYW1lOiAnV2Vla2x5IHJldmlldycsIGtpbmQ6ICdub3RlJywgc3RhdHVzOiAndG9kbycsIHBpbm5lZDogZmFsc2UgfSxcbiAgeyBpZDogJzQnLCBuYW1lOiAnUmVsZWFzZSBjaGVja2xpc3QnLCBraW5kOiAnbm90ZScsIHN0YXR1czogJ2RvbmUnLCBwaW5uZWQ6IGZhbHNlIH0sXG5dO1xuXG4vKiogRmlsbHMgaW4gd2hhdCBzYXZlZCBkYXRhIGxhY2tzIChhbiBpdGVtIHNhdmVkIGJlZm9yZSBpdCBoYWQgYSBzdGF0dXMpLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlYWREYXRhKHNhdmVkOiB1bmtub3duKTogRGF0YSB7XG4gIGNvbnN0IHMgPSAoc2F2ZWQgPz8ge30pIGFzIFBhcnRpYWw8RGF0YT47XG4gIGNvbnN0IGl0ZW1zID0gcy5pdGVtcyA/PyBTRUVEO1xuICByZXR1cm4ge1xuICAgIGl0ZW1zOiBpdGVtcy5tYXAoKGkpID0+ICh7IC4uLmksIHN0YXR1czogaS5zdGF0dXMgPz8gJ3RvZG8nLCBwaW5uZWQ6IGkucGlubmVkID8/IGZhbHNlIH0pKSxcbiAgICBkZW5zaXR5OiBzLmRlbnNpdHkgPz8gJ2RldGFpbGVkJyxcbiAgICBzY29wZTogcy5zY29wZSA/PyAnYWxsJyxcbiAgfTtcbn1cbiIsICIvLyBUaGUgc2V0dGluZ3MgdGFiOiBldmVyeSBgdWkuc2V0dGluZ3NgIHBhcnQuXG5pbXBvcnQgeyBQbHVnaW5TZXR0aW5nVGFiLCB0eXBlIEFwcCB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IHVpIH0gZnJvbSAnaGVsZW5pdGUnO1xuaW1wb3J0IHsgY291bnQgfSBmcm9tICcuL2RhdGEnO1xuaW1wb3J0IHsgaXRlbVRhYmxlIH0gZnJvbSAnLi9pdGVtLXBhcnRzJztcbmltcG9ydCB0eXBlIFNhbXBsZURlc2lnblN5c3RlbVBsdWdpbiBmcm9tICcuL21haW4nO1xuXG5leHBvcnQgY2xhc3MgU2FtcGxlU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcHJpdmF0ZSBwbHVnaW46IFNhbXBsZURlc2lnblN5c3RlbVBsdWdpbikge1xuICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcbiAgfVxuXG4gIGRpc3BsYXkoKTogdm9pZCB7XG4gICAgY29uc3QgeyBwbHVnaW4gfSA9IHRoaXM7XG4gICAgY29uc3QgZWwgPSB0aGlzLmNvbnRhaW5lckVsO1xuICAgIGVsLmVtcHR5KCk7XG4gICAgY29uc3QgaXRlbXMgPSB1aS5zZXR0aW5ncy5zZWN0aW9uKGVsLCAnSXRlbXMnKTtcbiAgICBjb25zdCBtYW5hZ2UgPSB1aS5zZXR0aW5ncy5zdWJwYWdlUm93KHRoaXMuYXBwLCBpdGVtcywge1xuICAgICAgbmFtZTogJ01hbmFnZSBpdGVtcycsXG4gICAgICBkZXNjOiBjb3VudChwbHVnaW4uZGF0YS5pdGVtcy5sZW5ndGgsICdpdGVtJyksXG4gICAgICB0aXRsZTogJ0l0ZW1zJyxcbiAgICAgIC8vIFRoZSB0YWIgc3RheXMgZHJhd24gdW5kZXIgdGhlIHN1Yi1wYWdlLCBzbyBhIGNoYW5nZSB0aGVyZSB1cGRhdGVzIHRoaXMgcm93IHRvby5cbiAgICAgIHJlbmRlcjogKHBhZ2UpID0+IHRoaXMucmVuZGVySXRlbXMocGFnZSwgKCkgPT4gbWFuYWdlLnNldERlc2MoY291bnQocGx1Z2luLmRhdGEuaXRlbXMubGVuZ3RoLCAnaXRlbScpKSksXG4gICAgfSk7XG4gICAgdWkuc2V0dGluZ3Muc3VtbWFyeVJvdyhpdGVtcywge1xuICAgICAgbmFtZTogJ0Fib3V0IHRoaXMgc2FtcGxlJywgZGVzYzogJ1doZXJlIHRvIHNlZSBldmVyeSBwYXJ0LicsIGNoZXZyb246IHRydWUsXG4gICAgICBvbkNsaWNrOiAoKSA9PiB1aS5zZXR0aW5ncy5vcGVuU3VicGFnZSh0aGlzLmFwcCwgJ0Fib3V0IHRoaXMgc2FtcGxlJywgKHBhZ2UpID0+IHtcbiAgICAgICAgdWkuY2FsbG91dChwYWdlLCB7IHRvbmU6ICdpbmZvJywgdGV4dDogJ1RoZSBjb21wb25lbnQgcmliYm9uIGljb24sIG9yIHRoZSBjb21tYW5kIFx1MjAxQ1Nob3cgZGVzaWduLXN5c3RlbSBwYXJ0c1x1MjAxRCwgb3BlbnMgYSB0YWIgd2l0aCBldmVyeSBwYXJ0LicgfSk7XG4gICAgICB9KSxcbiAgICB9KTtcbiAgICBuZXcgdWkuc2V0dGluZ3Mucm93KGl0ZW1zKVxuICAgICAgLnNldE5hbWUoJ1R3by1saW5lIHJvd3MnKVxuICAgICAgLnNldERlc2MoJ1Nob3cgZGV0YWlscyB1bmRlciBlYWNoIGl0ZW0uJylcbiAgICAgIC5hZGRUb2dnbGUoKHQpID0+IHQuc2V0VmFsdWUocGx1Z2luLmRhdGEuZGVuc2l0eSA9PT0gJ2RldGFpbGVkJykub25DaGFuZ2UoKG9uKSA9PiB7XG4gICAgICAgIHBsdWdpbi5kYXRhLmRlbnNpdHkgPSBvbiA/ICdkZXRhaWxlZCcgOiAnY29tcGFjdCc7XG4gICAgICAgIHZvaWQgcGx1Z2luLnNhdmUoKTtcbiAgICAgIH0pKTtcbiAgICBuZXcgdWkuc2V0dGluZ3Mucm93KGl0ZW1zKVxuICAgICAgLnNldE5hbWUoJ1N5bmMnKVxuICAgICAgLnNldERlc2MoJ05vdCBhdmFpbGFibGUgaW4gdGhpcyBzYW1wbGUuJylcbiAgICAgIC5hZGREcm9wZG93bigoZCkgPT4gZC5hZGRPcHRpb24oJ29mZicsICdPZmYnKSlcbiAgICAgIC5zZXREaXNhYmxlZCh0cnVlKTtcblxuICAgIGNvbnN0IGFjY2VzcyA9IHVpLnNldHRpbmdzLnNlY3Rpb24oZWwsICdBY2Nlc3MnLCB7IGRlc2M6ICdEZW1vIHZhbHVlczogbm90aGluZyBpcyBzaGFyZWQuJyB9KTtcbiAgICBjb25zdCBjYXJkID0gdWkuc2V0dGluZ3MuY2FyZChhY2Nlc3MsIHsgbmFtZTogJ0l0ZW0gc3luYycsIGRlc2M6ICdzYW1wbGUnLCBpY29uOiAncmVmcmVzaC1jdycsIHN0YXR1czogeyB0ZXh0OiAnTm90IGNvbm5lY3RlZCcsIHRvbmU6ICd3YXJuaW5nJyB9IH0pO1xuICAgIHVpLmFjdGlvbihjYXJkLmhlYWQuY29udHJvbEVsLCAncmVjb25uZWN0JywgeyBvbkNsaWNrOiAoKSA9PiBjYXJkLnNldFN0YXR1cyh7IHRleHQ6ICdDb25uZWN0ZWQnLCB0b25lOiAnc3VjY2VzcycgfSkgfSk7XG4gICAgdWkuc2V0dGluZ3MudmF1bHRTY29wZShjYXJkLmJvZHksIHtcbiAgICAgIHZhbHVlOiBwbHVnaW4uZGF0YS5zY29wZSxcbiAgICAgIHZhdWx0czogW3sgaWQ6ICd3b3JrJywgbmFtZTogJ1dvcmsnIH0sIHsgaWQ6ICdub3RlcycsIG5hbWU6ICdOb3RlcycgfSwgeyBpZDogJ29sZCcsIG5hbWU6ICdBcmNoaXZlJywgZGlzYWJsZWQ6ICdDbG9zZWQgdmF1bHQnIH1dLFxuICAgICAgaG9tZU5vdGU6IHRydWUsXG4gICAgICBjb25maXJtQWxsOiAoKSA9PiB1aS5jb25maXJtKHRoaXMuYXBwLCB7IHRpdGxlOiAnQWxsb3cgYWxsIHZhdWx0cycsIG1lc3NhZ2U6ICdMZXQgZXZlcnkgdmF1bHQgdXNlIGl0ZW0gc3luYz8nLCBhY3Rpb246ICdBbGxvdyBhbGwnIH0pLFxuICAgICAgb25DaGFuZ2U6IChzY29wZSkgPT4ge1xuICAgICAgICBwbHVnaW4uZGF0YS5zY29wZSA9IHNjb3BlO1xuICAgICAgICB2b2lkIHBsdWdpbi5zYXZlKCk7XG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gSGVsZW5pdGUgZHJhd3MgdGhpcyBiYXIgYWJvdmUgYSBIb21lIHBsdWdpbidzIHBhZ2UgYnkgaXRzZWxmLCBzbyBhIHBsdWdpbiByYXJlbHkgbmVlZHMgdG8uIFRoaXMgb25lIGlzIGEgZGVtby5cbiAgICBjb25zdCBzY29wZSA9IHVpLnNldHRpbmdzLnNlY3Rpb24oZWwsICdTY29wZSBiYXInLCB7IGRlc2M6ICdGb3IgYSBwYWdlIHRoYXQgZWRpdHMgYm90aCBIb21lIGFuZCB0aGUgVmF1bHQgRGVmYXVsdHMuJyB9KTtcbiAgICB1aS5zZXR0aW5ncy5zY29wZUJhcihzY29wZSwgeyBlZGl0aW5nRGVmYXVsdHM6IGZhbHNlLCBvbkNoYW5nZTogKCkgPT4ge30gfSk7XG4gIH1cblxuICBwcml2YXRlIHJlbmRlckl0ZW1zKHBhZ2U6IEhUTUxFbGVtZW50LCBvbkNoYW5nZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIC8vIE5vdGhpbmcgZWxzZSByZWRyYXdzIHRoZSB0YWJsZTogYWZ0ZXIgYSBkZWxldGUgaXQgdGFrZXMgdGhlIG5ldyByb3dzLCBhbmQgdGhlIHN1Yi1wYWdlIHN0YXlzIG9wZW4uXG4gICAgY29uc3QgdGFibGUgPSBpdGVtVGFibGUocGFnZSwgdGhpcy5wbHVnaW4sIHRoaXMucGx1Z2luLmRhdGEuaXRlbXMsICgpID0+IHtcbiAgICAgIHRhYmxlLnNldFJvd3ModGhpcy5wbHVnaW4uZGF0YS5pdGVtcyk7XG4gICAgICBvbkNoYW5nZSgpO1xuICAgIH0pO1xuICB9XG59XG4iLCAiLy8gV2hhdCBtb3JlIHRoYW4gb25lIHBhZ2UgZHJhd3MgZm9yIGFuIGl0ZW06IGl0cyB0YWJsZSwgaXRzIG1lbnUgYW5kIGl0cyBkZXRhaWxzIGRpYWxvZy5cbmltcG9ydCB7IHVpLCB0eXBlIE1lbnVJdGVtU3BlYyB9IGZyb20gJ2hlbGVuaXRlJztcbmltcG9ydCB7IFNUQVRVU0VTLCBzdGF0dXNPZiwgdHlwZSBJdGVtIH0gZnJvbSAnLi9kYXRhJztcbmltcG9ydCB0eXBlIFNhbXBsZURlc2lnblN5c3RlbVBsdWdpbiBmcm9tICcuL21haW4nO1xuXG4vKiogYG9uUmVtb3ZlZGAgcnVucyBhZnRlciBhIGRlbGV0ZSwgZm9yIGEgdGFibGUgdGhhdCBub3RoaW5nIGVsc2UgcmVkcmF3cy4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpdGVtVGFibGUoZWw6IEhUTUxFbGVtZW50LCBwbHVnaW46IFNhbXBsZURlc2lnblN5c3RlbVBsdWdpbiwgcm93czogSXRlbVtdLCBvblJlbW92ZWQ/OiAoKSA9PiB2b2lkKSB7XG4gIHJldHVybiB1aS50YWJsZTxJdGVtPihlbCwge1xuICAgIGNvbHVtbnM6IFtcbiAgICAgIHsga2V5OiAnbmFtZScsIHRpdGxlOiAnTmFtZScsIGNlbGw6IChyKSA9PiByLm5hbWUgfSxcbiAgICAgIHsga2V5OiAna2luZCcsIHRpdGxlOiAnS2luZCcsIGZpdDogdHJ1ZSwgY2VsbDogKHIsIHRkKSA9PiB2b2lkIHVpLmJhZGdlKHRkLCByLmtpbmQpIH0sXG4gICAgICB7IGtleTogJ3N0YXR1cycsIHRpdGxlOiAnU3RhdHVzJywgZml0OiB0cnVlLCBjZWxsOiAociwgdGQpID0+IHZvaWQgdWkuc3RhdHVzVGV4dCh0ZCwgc3RhdHVzT2YocikudGV4dCwgc3RhdHVzT2YocikudG9uZSkgfSxcbiAgICBdLFxuICAgIHJvd3MsXG4gICAgZW1wdHk6ICdObyBpdGVtcyB5ZXQuJyxcbiAgICAvLyBgZGVsZXRlYCBhc2tzIGJlZm9yZSBpdCBydW5zLCBuYW1pbmcgdGhlIGl0ZW0uXG4gICAgYWN0aW9uczogKHIsIGNlbGwpID0+IHZvaWQgdWkuYWN0aW9uKGNlbGwsICdkZWxldGUnLCB7XG4gICAgICBhcHA6IHBsdWdpbi5hcHAsIHN1YmplY3Q6IHIubmFtZSxcbiAgICAgIG9uQ2xpY2s6IGFzeW5jICgpID0+IHtcbiAgICAgICAgYXdhaXQgcGx1Z2luLnJlbW92ZShyKTtcbiAgICAgICAgb25SZW1vdmVkPy4oKTtcbiAgICAgIH0sXG4gICAgfSksXG4gIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXRlbU1lbnUocGx1Z2luOiBTYW1wbGVEZXNpZ25TeXN0ZW1QbHVnaW4sIGl0ZW06IEl0ZW0pOiBNZW51SXRlbVNwZWNbXSB7XG4gIHJldHVybiBbXG4gICAgeyB0aXRsZTogJ09wZW4nLCBpY29uOiAncGFuZWwtcmlnaHQtb3BlbicsIG9uQ2xpY2s6ICgpID0+IHZvaWQgb3Blbkl0ZW0ocGx1Z2luLCBpdGVtKSB9LFxuICAgIHsgdGl0bGU6ICdSZW5hbWUnLCBpY29uOiAncGVuY2lsJywgb25DbGljazogKCkgPT4gdm9pZCBwbHVnaW4ucmVuYW1lKGl0ZW0pIH0sXG4gICAgJ3NlcGFyYXRvcicsXG4gICAgLi4uU1RBVFVTRVMubWFwKChzKSA9PiAoeyB0aXRsZTogcy50ZXh0LCBjaGVja2VkOiBpdGVtLnN0YXR1cyA9PT0gcy5pZCwgb25DbGljazogKCkgPT4gdm9pZCBwbHVnaW4ubW92ZShpdGVtLmlkLCBzLmlkKSB9KSksXG4gICAgJ3NlcGFyYXRvcicsXG4gICAge1xuICAgICAgdGl0bGU6ICdEZWxldGUnLCBpY29uOiAndHJhc2gtMicsIGRhbmdlcjogdHJ1ZSxcbiAgICAgIG9uQ2xpY2s6ICgpID0+IHZvaWQgdWkuY29uZmlybShwbHVnaW4uYXBwLCB7XG4gICAgICAgIHRpdGxlOiBgRGVsZXRlICR7aXRlbS5uYW1lfWAsIG1lc3NhZ2U6IGBEZWxldGUgJHtpdGVtLm5hbWV9PyBUaGlzIGNhbm5vdCBiZSB1bmRvbmUuYCwgYWN0aW9uOiAnRGVsZXRlJywgZGFuZ2VyOiB0cnVlLFxuICAgICAgICBvbkNvbmZpcm06ICgpID0+IHBsdWdpbi5yZW1vdmUoaXRlbSksXG4gICAgICB9KSxcbiAgICB9LFxuICBdO1xufVxuXG4vKiogQSBkaWFsb2cgd2l0aCB0aGUgY29udGVudCBvbiB0aGUgbGVmdCBhbmQgaXRzIHByb3BlcnRpZXMgb24gdGhlIHJpZ2h0LiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG9wZW5JdGVtKHBsdWdpbjogU2FtcGxlRGVzaWduU3lzdGVtUGx1Z2luLCBpdGVtOiBJdGVtKTogUHJvbWlzZTx1bmtub3duPiB7XG4gIGxldCBuYW1lID0gaXRlbS5uYW1lO1xuICByZXR1cm4gdWkuZGlhbG9nKHBsdWdpbi5hcHAsIHtcbiAgICB0aXRsZTogJ0VkaXQgaXRlbScsXG4gICAgd2lkdGg6ICd3aWRlJyxcbiAgICByZW5kZXI6IChib2R5LCBjdHgpID0+IHtcbiAgICAgIGNvbnN0IHsgbWFpbiwgc2lkZSB9ID0gY3R4LnNpZGVQYW5lbCgpO1xuICAgICAgdWkudGV4dElucHV0KHVpLmZpZWxkKG1haW4sIHsgbGFiZWw6ICdOYW1lJywgZmlsbDogdHJ1ZSB9KS5jb250cm9sLCB7IHZhbHVlOiBuYW1lLCBvbklucHV0OiAodikgPT4gKG5hbWUgPSB2KSB9KTtcbiAgICAgIHVpLmtleVZhbHVlKHNpZGUsIFtcbiAgICAgICAgeyBrZXk6ICdLaW5kJywgdmFsdWU6IGl0ZW0ua2luZCB9LFxuICAgICAgICB7IGtleTogJ1N0YXR1cycsIHZhbHVlOiBzdGF0dXNPZihpdGVtKS50ZXh0IH0sXG4gICAgICAgIHsga2V5OiAnUGlubmVkJywgdmFsdWU6IGl0ZW0ucGlubmVkID8gJ1llcycgOiAnTm8nIH0sXG4gICAgICBdKTtcbiAgICB9LFxuICAgIGFjdGlvbnM6IFt7XG4gICAgICB0ZXh0OiAnU2F2ZScsIHZhcmlhbnQ6ICdwcmltYXJ5Jywgb25DbGljazogYXN5bmMgKGN0eCkgPT4ge1xuICAgICAgICBpZiAoIW5hbWUudHJpbSgpKSB0aHJvdyBuZXcgRXJyb3IoJ0VudGVyIGEgbmFtZS4nKTtcbiAgICAgICAgaXRlbS5uYW1lID0gbmFtZS50cmltKCk7XG4gICAgICAgIGF3YWl0IHBsdWdpbi5zYXZlKCk7XG4gICAgICAgIGN0eC5jbG9zZShudWxsKTtcbiAgICAgIH0sXG4gICAgfV0sXG4gIH0pO1xufVxuIiwgIi8vIFRoZSBcIkRlc2lnbi1zeXN0ZW0gcGFydHNcIiB0YWI6IGEgcGFuZSBoZWFkZXIsIHRhYnMsIGFuZCBvbmUgcGFnZSBwZXIgdGFiLlxuaW1wb3J0IHsgSXRlbVZpZXcsIHR5cGUgV29ya3NwYWNlTGVhZiB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IHVpLCB0eXBlIFRhYnNIYW5kbGUgfSBmcm9tICdoZWxlbml0ZSc7XG5pbXBvcnQgdHlwZSBTYW1wbGVEZXNpZ25TeXN0ZW1QbHVnaW4gZnJvbSAnLi9tYWluJztcbmltcG9ydCB7IGRyYXdCb2FyZCB9IGZyb20gJy4vcGFnZXMvYm9hcmQnO1xuaW1wb3J0IHsgZHJhd0NhcmRzIH0gZnJvbSAnLi9wYWdlcy9jYXJkcyc7XG5pbXBvcnQgeyBkcmF3RGlhbG9ncyB9IGZyb20gJy4vcGFnZXMvZGlhbG9ncyc7XG5pbXBvcnQgeyBkcmF3SW5wdXRzIH0gZnJvbSAnLi9wYWdlcy9pbnB1dHMnO1xuaW1wb3J0IHsgZHJhd0l0ZW1zLCB0eXBlIEl0ZW1GaWx0ZXIgfSBmcm9tICcuL3BhZ2VzL2l0ZW1zJztcbmltcG9ydCB7IGRyYXdTdGF0dXMgfSBmcm9tICcuL3BhZ2VzL3N0YXR1cyc7XG5cbmV4cG9ydCBjb25zdCBWSUVXX1RZUEUgPSAnc2FtcGxlLWRlc2lnbi1zeXN0ZW0nO1xuXG5leHBvcnQgY29uc3QgUEFHRVMgPSBbXG4gIHsgaWQ6ICdpdGVtcycsIHRleHQ6ICdJdGVtcycgfSxcbiAgeyBpZDogJ2JvYXJkJywgdGV4dDogJ0JvYXJkJyB9LFxuICB7IGlkOiAnaW5wdXRzJywgdGV4dDogJ0lucHV0cycgfSxcbiAgeyBpZDogJ3N0YXR1cycsIHRleHQ6ICdTdGF0dXMnIH0sXG4gIHsgaWQ6ICdjYXJkcycsIHRleHQ6ICdDYXJkcycgfSxcbiAgeyBpZDogJ2RpYWxvZ3MnLCB0ZXh0OiAnRGlhbG9ncycgfSxcbl0gYXMgY29uc3Q7XG5cbmV4cG9ydCB0eXBlIFBhZ2VJZCA9ICh0eXBlb2YgUEFHRVMpW251bWJlcl1bJ2lkJ107XG5cbmV4cG9ydCBjbGFzcyBTYW1wbGVWaWV3IGV4dGVuZHMgSXRlbVZpZXcge1xuICBwYWdlOiBQYWdlSWQgPSAnaXRlbXMnO1xuICBwcml2YXRlIHRhYnM6IFRhYnNIYW5kbGU8UGFnZUlkPiB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIGhlYWRlcjogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBkcmFnZ2luZyA9IGZhbHNlO1xuICBwcml2YXRlIHN0YWxlID0gZmFsc2U7XG4gIC8qKiBLZXB0IGhlcmUgc28gYSByZWRyYXcgYWZ0ZXIgYSBzYXZlIGRvZXMgbm90IGxvc2UgdGhlIHNlYXJjaCBvciB0aGUgbGF5b3V0LiAqL1xuICBwcml2YXRlIGZpbHRlcjogSXRlbUZpbHRlciA9IHsgcXVlcnk6ICcnLCBraW5kOiAnYWxsJywgbGF5b3V0OiAnbGlzdCcgfTtcblxuICBjb25zdHJ1Y3RvcihsZWFmOiBXb3Jrc3BhY2VMZWFmLCBwcml2YXRlIHBsdWdpbjogU2FtcGxlRGVzaWduU3lzdGVtUGx1Z2luKSB7XG4gICAgc3VwZXIobGVhZik7XG4gIH1cblxuICBnZXRWaWV3VHlwZSgpOiBzdHJpbmcge1xuICAgIHJldHVybiBWSUVXX1RZUEU7XG4gIH1cblxuICBnZXREaXNwbGF5VGV4dCgpOiBzdHJpbmcge1xuICAgIHJldHVybiAnRGVzaWduLXN5c3RlbSBwYXJ0cyc7XG4gIH1cblxuICBnZXRJY29uKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuICdjb21wb25lbnQnO1xuICB9XG5cbiAgYXN5bmMgb25PcGVuKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuY29udGVudEVsLmVtcHR5KCk7XG4gICAgdGhpcy50YWJzID0gdWkudGFiczxQYWdlSWQ+KHRoaXMuY29udGVudEVsLCB7XG4gICAgICB0YWJzOiBQQUdFUy5tYXAoKHApID0+ICh7IC4uLnAgfSkpLFxuICAgICAgdmFsdWU6IHRoaXMucGFnZSxcbiAgICAgIG9uU2VsZWN0OiAoaWQpID0+IHtcbiAgICAgICAgdGhpcy5wYWdlID0gaWQ7XG4gICAgICAgIHRoaXMuZHJhd1BhZ2UoKTtcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgdGhpcy5yZWZyZXNoKCk7XG4gIH1cblxuICAvKiogUmVkcmF3cyB3aGF0IHNob3dzIHRoZSBwbHVnaW4ncyBkYXRhLCBhZnRlciBhIGRyYWcgaWYgb25lIGlzIHVuZGVyIHdheS4gVGhlIElucHV0cyBwYWdlIGhvbGRzIHdoYXQgdGhlIHVzZXIgdHlwZWQsIHNvIGl0IGlzIGxlZnQgYWxvbmUuICovXG4gIHJlZnJlc2goKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuZHJhZ2dpbmcpIHtcbiAgICAgIHRoaXMuc3RhbGUgPSB0cnVlO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLmRyYXdIZWFkZXIoKTtcbiAgICB0aGlzLnRhYnM/LnNldEJhZGdlKCdpdGVtcycsIHRoaXMucGx1Z2luLmRhdGEuaXRlbXMubGVuZ3RoKTtcbiAgICAvLyBSaWdodCBhZnRlciBvcGVuaW5nIHRoZXJlIGlzIG5vIHBhZ2UgeWV0LlxuICAgIGlmICh0aGlzLnBhZ2UgIT09ICdpbnB1dHMnIHx8ICF0aGlzLnRhYnM/LmVsLm5leHRFbGVtZW50U2libGluZykgdGhpcy5kcmF3UGFnZSgpO1xuICB9XG5cbiAgcHJpdmF0ZSBob2xkKGRyYWdnaW5nOiBib29sZWFuKTogdm9pZCB7XG4gICAgdGhpcy5kcmFnZ2luZyA9IGRyYWdnaW5nO1xuICAgIGlmIChkcmFnZ2luZyB8fCAhdGhpcy5zdGFsZSkgcmV0dXJuO1xuICAgIHRoaXMuc3RhbGUgPSBmYWxzZTtcbiAgICB0aGlzLnJlZnJlc2goKTtcbiAgfVxuXG4gIHByaXZhdGUgZHJhd0hlYWRlcigpOiB2b2lkIHtcbiAgICB0aGlzLmhlYWRlcj8ucmVtb3ZlKCk7XG4gICAgdGhpcy5oZWFkZXIgPSB1aS5wYW5lSGVhZGVyKHRoaXMuY29udGVudEVsLCBbXG4gICAgICB7IGljb246ICdwbHVzJywgbGFiZWw6ICdBZGQgaXRlbScsIGlkOiAnYWRkJywgb25DbGljazogKCkgPT4gdm9pZCB0aGlzLnBsdWdpbi5hZGRJdGVtKCkgfSxcbiAgICAgIC8vIE9uZSBsaW5lIG9yIHR3byBwZXIgcm93LiBUaGUgaGVhZGVyIGlzIHJlYnVpbHQgb24gYSBjaGFuZ2UsIHNvIHRoZSBpY29uIGZvbGxvd3MuXG4gICAgICB1aS5kZW5zaXR5QWN0aW9uKHRoaXMucGx1Z2luLmRhdGEuZGVuc2l0eSwgKGRlbnNpdHkpID0+IHtcbiAgICAgICAgdGhpcy5wbHVnaW4uZGF0YS5kZW5zaXR5ID0gZGVuc2l0eTtcbiAgICAgICAgdm9pZCB0aGlzLnBsdWdpbi5zYXZlKCk7XG4gICAgICB9KSxcbiAgICBdKTtcbiAgfVxuXG4gIHByaXZhdGUgZHJhd1BhZ2UoKTogdm9pZCB7XG4gICAgY29uc3QgZWwgPSB0aGlzLmNvbnRlbnRFbDtcbiAgICB3aGlsZSAodGhpcy50YWJzPy5lbC5uZXh0U2libGluZykgdGhpcy50YWJzLmVsLm5leHRTaWJsaW5nLnJlbW92ZSgpO1xuICAgIC8vIEEgYm9hcmQgZmlsbHMgaXRzIHBhbmU6IHRoZSBjbGFzcyBnb2VzIG9uIHRoZSBib2FyZCdzIGNvbnRhaW5lciwgYW5kIHRoZSBib2FyZCBpcyBkcmF3biBzdHJhaWdodCBpbnRvIGl0LlxuICAgIGVsLnRvZ2dsZUNsYXNzKCdoZWwtYm9hcmQtcGFnZScsIHRoaXMucGFnZSA9PT0gJ2JvYXJkJyk7XG4gICAgaWYgKHRoaXMucGFnZSA9PT0gJ2JvYXJkJykgcmV0dXJuIGRyYXdCb2FyZChlbCwgdGhpcy5wbHVnaW4sIChkcmFnZ2luZykgPT4gdGhpcy5ob2xkKGRyYWdnaW5nKSk7XG4gICAgY29uc3QgcGFnZSA9IGVsLmNyZWF0ZURpdigpO1xuICAgIGlmICh0aGlzLnBhZ2UgPT09ICdpdGVtcycpIGRyYXdJdGVtcyhwYWdlLCB0aGlzLnBsdWdpbiwgdGhpcy5maWx0ZXIpO1xuICAgIGVsc2UgaWYgKHRoaXMucGFnZSA9PT0gJ2lucHV0cycpIGRyYXdJbnB1dHMocGFnZSk7XG4gICAgZWxzZSBpZiAodGhpcy5wYWdlID09PSAnc3RhdHVzJykgZHJhd1N0YXR1cyhwYWdlKTtcbiAgICBlbHNlIGlmICh0aGlzLnBhZ2UgPT09ICdjYXJkcycpIGRyYXdDYXJkcyhwYWdlKTtcbiAgICBlbHNlIGRyYXdEaWFsb2dzKHBhZ2UsIHRoaXMucGx1Z2luKTtcbiAgfVxufVxuIiwgIi8vIFRoZSBpdGVtcyBhcyBhIGJvYXJkOiBkcmFnIGEgY2FyZCBiZXR3ZWVuIGxhbmVzLCBvciB1c2UgaXRzIG1lbnUgKGRyYWdnaW5nIGhhcyBubyBrZXlib2FyZCBlcXVpdmFsZW50KS5cbmltcG9ydCB7IHVpIH0gZnJvbSAnaGVsZW5pdGUnO1xuaW1wb3J0IHsgU1RBVFVTRVMgfSBmcm9tICcuLi9kYXRhJztcbmltcG9ydCB7IGl0ZW1NZW51LCBvcGVuSXRlbSB9IGZyb20gJy4uL2l0ZW0tcGFydHMnO1xuaW1wb3J0IHR5cGUgU2FtcGxlRGVzaWduU3lzdGVtUGx1Z2luIGZyb20gJy4uL21haW4nO1xuXG4vKiogYGhvbGRgIHN0b3BzIHJlZHJhd3Mgd2hpbGUgYSBjYXJkIGlzIGRyYWdnZWQ6IGEgcmVkcmF3IHdvdWxkIHRha2UgdGhlIGNhcmQgYXdheS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkcmF3Qm9hcmQoZWw6IEhUTUxFbGVtZW50LCBwbHVnaW46IFNhbXBsZURlc2lnblN5c3RlbVBsdWdpbiwgaG9sZDogKGRyYWdnaW5nOiBib29sZWFuKSA9PiB2b2lkKTogdm9pZCB7XG4gIGNvbnN0IGJvYXJkID0gdWkuYm9hcmQoZWwsIHtcbiAgICBsYWJlbDogJ0l0ZW1zJyxcbiAgICBvbkRyYWdTdGFydDogKCkgPT4gaG9sZCh0cnVlKSxcbiAgICBvbkRyYWdFbmQ6ICgpID0+IGhvbGQoZmFsc2UpLFxuICAgIG9uRHJvcDogKGlkLCBsYW5lLCBpbmRleCkgPT4ge1xuICAgICAgY29uc3Qgc3RhdHVzID0gU1RBVFVTRVMuZmluZCgocykgPT4gcy5pZCA9PT0gbGFuZSk7XG4gICAgICBpZiAoc3RhdHVzKSB2b2lkIHBsdWdpbi5tb3ZlKGlkLCBzdGF0dXMuaWQsIGluZGV4KTtcbiAgICB9LFxuICB9KTtcbiAgZm9yIChjb25zdCBzdGF0dXMgb2YgU1RBVFVTRVMpIHtcbiAgICBjb25zdCBpdGVtcyA9IHBsdWdpbi5kYXRhLml0ZW1zLmZpbHRlcigoaSkgPT4gaS5zdGF0dXMgPT09IHN0YXR1cy5pZCk7XG4gICAgY29uc3QgbGFuZSA9IGJvYXJkLmxhbmUoeyBpZDogc3RhdHVzLmlkLCBsYWJlbDogc3RhdHVzLnRleHQsIHRpdGxlOiBzdGF0dXMudGV4dCwgb25UaXRsZUNsaWNrOiAoKSA9PiB1aS5ub3RpY2UoYCR7aXRlbXMubGVuZ3RofSBpbiAke3N0YXR1cy50ZXh0fWApIH0pO1xuICAgIHVpLmJhZGdlKGxhbmUuaGVhZCwgU3RyaW5nKGl0ZW1zLmxlbmd0aCksIHN0YXR1cy50b25lKTtcbiAgICBpZiAoIWl0ZW1zLmxlbmd0aCkgdWkuZW1wdHlTdGF0ZShsYW5lLmxpc3QsICdObyBpdGVtcycsIHsgdmFyaWFudDogJ2lubGluZScgfSk7XG4gICAgZm9yIChjb25zdCBpdGVtIG9mIGl0ZW1zKSB7XG4gICAgICBjb25zdCBjYXJkID0gbGFuZS5jYXJkKHtcbiAgICAgICAgaWQ6IGl0ZW0uaWQsXG4gICAgICAgIGxhYmVsOiBpdGVtLm5hbWUsXG4gICAgICAgIG9uT3BlbjogKCkgPT4gdm9pZCBvcGVuSXRlbShwbHVnaW4sIGl0ZW0pLFxuICAgICAgICBjaGVjazogeyBjaGVja2VkOiBzdGF0dXMuaWQgPT09ICdkb25lJywgbGFiZWw6IGBEb25lOiAke2l0ZW0ubmFtZX1gLCBvblRvZ2dsZTogKGRvbmUpID0+IHZvaWQgcGx1Z2luLm1vdmUoaXRlbS5pZCwgZG9uZSA/ICdkb25lJyA6ICd0b2RvJywgMCkgfSxcbiAgICAgIH0pO1xuICAgICAgY2FyZC5jb250ZW50LnNldFRleHQoaXRlbS5uYW1lKTtcbiAgICAgIHVpLm1vcmVCdXR0b24oY2FyZC5hY3Rpb25zLCAoKSA9PiBpdGVtTWVudShwbHVnaW4sIGl0ZW0pKTtcbiAgICAgIHVpLmJhZGdlKGNhcmQubWV0YSwgaXRlbS5raW5kKTtcbiAgICAgIGlmIChpdGVtLnBpbm5lZCkgdWkuY2hpcChjYXJkLm1ldGEsICdQaW5uZWQnLCB7IHRvbmU6ICdhY2NlbnQnIH0pO1xuICAgIH1cbiAgICBpZiAoc3RhdHVzLmlkID09PSAndG9kbycpIHVpLmJ1dHRvbihsYW5lLmZvb3RlciwgeyB0ZXh0OiAnQWRkIGl0ZW0nLCBpY29uOiAncGx1cycsIHZhcmlhbnQ6ICdsaW5rJywgb25DbGljazogKCkgPT4gdm9pZCBwbHVnaW4uYWRkSXRlbSgpIH0pO1xuICB9XG59XG4iLCAiLy8gUGFydHMgdGhhdCBncm91cCBjb250ZW50OiBjYXJkcywgZGlzY2xvc3VyZSBjYXJkcywga2V5LXZhbHVlIGxpc3RzLCBjb2RlIGJsb2NrcywgY29tbWVudCB0aHJlYWRzLCBhbmQgdGhlIHBhcnRzIGZvclxuLy8gY29sbGVjdGlvbnMgd2l0aCBhcnR3b3JrIGFuZCBmaWd1cmVzIChtZWRpYSBjYXJkcywgcmF0aW5ncywgc3RhdCB0aWxlcywgaGVhZGluZ3MsIGEgbW9udGggZ3JpZCkuXG5pbXBvcnQgeyB1aSB9IGZyb20gJ2hlbGVuaXRlJztcblxuZXhwb3J0IGZ1bmN0aW9uIGRyYXdDYXJkcyhlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgY29uc3QgY2FyZCA9IHVpLmNhcmQodWkuc2V0dGluZ3Muc2VjdGlvbihlbCwgJ0NhcmQnKSwgeyB0aXRsZTogJ1JlYWRpbmcgbGlzdCcsIGljb246ICdmaWxlLXRleHQnIH0pO1xuICB1aS5zdGF0dXNUZXh0KGNhcmQuYm9keSwgJ1N5bmNlZCBhIG1pbnV0ZSBhZ28nLCAnc3VjY2VzcycpO1xuICB1aS5idXR0b24oY2FyZC5mb290ZXIsIHsgdGV4dDogJ09wZW4nLCBvbkNsaWNrOiAoKSA9PiB2b2lkIHVpLm5vdGljZSgnT3BlbmVkIFJlYWRpbmcgbGlzdCcpIH0pO1xuXG4gIGNvbnN0IHdhcm5pbmcgPSB1aS5jYXJkKHVpLnNldHRpbmdzLnNlY3Rpb24oZWwsICdDYXJkIHRoYXQgbmVlZHMgYXR0ZW50aW9uJyksIHsgdGl0bGU6ICdXaGljaCBmb2xkZXI/JywgaWNvbjogJ2NpcmNsZS1oZWxwJywgdG9uZTogJ3dhcm5pbmcnLCBhdHRlbnRpb246IHRydWUgfSk7XG4gIHVpLmNob2ljZUxpc3Qod2FybmluZy5ib2R5LCB7XG4gICAgbGFiZWw6ICdGb2xkZXInLFxuICAgIG9wdGlvbnM6IFt7IHZhbHVlOiAnbm90ZXMnLCB0ZXh0OiAnTm90ZXMnLCBrZXk6ICcxJyB9LCB7IHZhbHVlOiAnYXJjaGl2ZScsIHRleHQ6ICdBcmNoaXZlJywga2V5OiAnMicgfV0sXG4gICAgb25DaGFuZ2U6ICh2KSA9PiB2b2lkIHVpLm5vdGljZShgUGlja2VkICR7dn1gKSxcbiAgfSk7XG5cbiAgLy8gV2l0aG91dCBgb25Ub2dnbGVgIGEgZGlzY2xvc3VyZSBjYXJkIG9wZW5zIGFuZCBjbG9zZXMgaXRzZWxmLlxuICBjb25zdCBtb3JlID0gdWkuZGlzY2xvc3VyZSh1aS5zZXR0aW5ncy5zZWN0aW9uKGVsLCAnRGlzY2xvc3VyZScpLCB7IHRpdGxlOiAnQWJvdXQgdGhpcyBsaXN0Jywgc3VtbWFyeTogJ05vdGVzIGFuZCBsaW5rcycsIG9wZW46IHRydWUgfSk7XG4gIHVpLmJhZGdlKG1vcmUubGVhZCwgJzEnLCAnYWNjZW50Jyk7XG4gIHVpLmtleVZhbHVlKG1vcmUuYm9keSwgW1xuICAgIHsga2V5OiAnRm9sZGVyJywgdmFsdWU6ICdOb3Rlcy9MaXN0cycgfSxcbiAgICB7IGtleTogJ0tpbmRzJywgdmFsdWU6IFsnbm90ZScsICdsaW5rJ10sIGlzTmV3OiAoaykgPT4gayA9PT0gJ2xpbmsnIH0sXG4gICAgeyBrZXk6ICdTZWNyZXRzJywgdmFsdWU6IFtdLCBlbXB0eTogJ05vbmUnIH0sXG4gIF0pO1xuXG4gIHVpLmNvZGVCbG9jayh1aS5zZXR0aW5ncy5zZWN0aW9uKGVsLCAnQ29kZSBibG9jaycpLCBcImNvbnN0IGNhcmQgPSB1aS5jYXJkKGVsLCB7IHRpdGxlOiAnUmVhZGluZyBsaXN0JywgaWNvbjogJ2ZpbGUtdGV4dCcgfSk7XFxudWkuc3RhdHVzVGV4dChjYXJkLmJvZHksICdTeW5jZWQgYSBtaW51dGUgYWdvJywgJ3N1Y2Nlc3MnKTtcIiwgeyBsYWJlbDogJ0NhcmQgY29kZScgfSk7XG5cbiAgY29uc3QgaGVhZGluZyA9IHVpLnNlY3Rpb25IZWFkaW5nKGVsLCB7IHRpdGxlOiAnQ29sbGVjdGlvbicsIGV4dHJhOiAnMyBpdGVtcycsIGxldmVsOiAzIH0pO1xuICB1aS5idXR0b24oaGVhZGluZy5hY3Rpb25zLCB7IHRleHQ6ICdSZWZyZXNoJywgb25DbGljazogKCkgPT4gdm9pZCB1aS5ub3RpY2UoJ1VwIHRvIGRhdGUnKSB9KTtcbiAgdWkuc3RhdFRpbGVzKGVsLCBbeyB2YWx1ZTogJzMnLCBsYWJlbDogJ0l0ZW1zJywgb25DbGljazogKCkgPT4gdm9pZCB1aS5ub3RpY2UoJzMgaXRlbXMnKSB9LCB7IHZhbHVlOiAnMScsIGxhYmVsOiAnVW5yZWFkJyB9XSk7XG4gIGNvbnN0IGdyaWQgPSB1aS5tZWRpYUdyaWQoZWwsIHsgbWluV2lkdGg6IDEyMCB9KTtcbiAgZm9yIChjb25zdCB0aXRsZSBvZiBbJ1JlYWRpbmcgbGlzdCcsICdJZGVhcyddKSB7XG4gICAgY29uc3QgaXRlbSA9IHVpLm1lZGlhQ2FyZChncmlkLCB7IGFydDogeyB0aXRsZSB9LCB0aXRsZSB9KTtcbiAgICB1aS5yYXRpbmcoaXRlbS5ib2R5LCB7IHZhbHVlOiA0IH0pO1xuICAgIHVpLmZpZ3VyZXMoaXRlbS5ib2R5LCBbeyB0ZXh0OiAnMTInLCBsYWJlbDogJ05vdGVzJywgaWNvbjogJ2ZpbGUtdGV4dCcgfV0pO1xuICAgIHVpLmJ1dHRvbihpdGVtLmZvb3RlciwgeyB0ZXh0OiAnT3BlbicsIG9uQ2xpY2s6ICgpID0+IHZvaWQgdWkubm90aWNlKGBPcGVuZWQgJHt0aXRsZX1gKSB9KTtcbiAgfVxuICB1aS5hcnR3b3JrKHVpLm1lZGlhR3JpZChlbCwgeyBsYXlvdXQ6ICdzdHJpcCcsIG1pbldpZHRoOiA4MCB9KSwgeyB0aXRsZTogJ05vIGNvdmVyJywgb25DbGljazogKCkgPT4gdm9pZCB1aS5ub3RpY2UoJ05vIGNvdmVyIHlldCcpIH0pO1xuICB1aS5tb250aEdyaWQodWkuc2V0dGluZ3Muc2VjdGlvbihlbCwgJ01vbnRoJyksIHsgbW9udGg6IG5ldyBEYXRlKCksIGV2ZW50czogKGRheSkgPT4gKGRheS5lbmRzV2l0aCgnLTE1JykgPyBbeyB0aXRsZTogJ1JldmlldycsIGxlYWQ6ICc5OjAwJyB9XSA6IFtdKSB9KTtcblxuICBjb25zdCB0YWxrID0gdWkudGhyZWFkKHVpLnNldHRpbmdzLnNlY3Rpb24oZWwsICdUaHJlYWQnKSk7XG4gIHRhbGsuZXZlbnQoJ05vdiAyNiwgOTowMCBBTSBcdTAwQjcgSXRlbSBhZGRlZCcpO1xuICBjb25zdCBhc2tlZCA9IHRhbGsuZW50cnkoKTtcbiAgdWkudGhyZWFkVGV4dCh1aS5jYXJkKGFza2VkLmVsLCB7IGNvbXBhY3Q6IHRydWUsIHRpdGxlOiAnQWRhJywgaWNvbjogJ3VzZXInIH0pLmJvZHksICdTaG91bGQgdGhpcyBnbyBpbiB0aGUgYXJjaGl2ZT8nKTtcbiAgY29uc3QgYW5zd2VyID0gYXNrZWQucmVwbGllcygpLmVudHJ5KCk7XG4gIHVpLnRocmVhZFRleHQodWkuY2FyZChhbnN3ZXIuZWwsIHsgY29tcGFjdDogdHJ1ZSwgdGl0bGU6ICdZb3UnLCBpY29uOiAndXNlcicsIHRvbmU6ICdhY2NlbnQnIH0pLmJvZHksICdOb3QgeWV0LlxcbkFmdGVyIHRoZSByZXZpZXcuJyk7XG59XG4iLCAiLy8gRXZlcnl0aGluZyB0aGF0IG9wZW5zIG92ZXIgdGhlIHBhZ2U6IG1vZGFscywgcG9wb3ZlcnMsIG1lbnVzIGFuZCBub3RpY2VzLCBhbmQgdGhlIHN0YW5kYXJkIGFjdGlvbnMuXG5pbXBvcnQgeyB1aSwgdHlwZSBBY3Rpb25JZCwgdHlwZSBNZW51SXRlbVNwZWMgfSBmcm9tICdoZWxlbml0ZSc7XG5pbXBvcnQgdHlwZSBTYW1wbGVEZXNpZ25TeXN0ZW1QbHVnaW4gZnJvbSAnLi4vbWFpbic7XG5cbmV4cG9ydCBmdW5jdGlvbiBkcmF3RGlhbG9ncyhlbDogSFRNTEVsZW1lbnQsIHBsdWdpbjogU2FtcGxlRGVzaWduU3lzdGVtUGx1Z2luKTogdm9pZCB7XG4gIGNvbnN0IHsgYXBwIH0gPSBwbHVnaW47XG5cbiAgY29uc3QgbW9kYWxzID0gdWkudG9vbGJhcih1aS5zZXR0aW5ncy5zZWN0aW9uKGVsLCAnTW9kYWxzJyksIHsgbGFiZWw6ICdNb2RhbHMnIH0pO1xuICB1aS5idXR0b24obW9kYWxzLCB7XG4gICAgdGV4dDogJ0NvbmZpcm0nLFxuICAgIG9uQ2xpY2s6ICgpID0+IHZvaWQgdWkuY29uZmlybShhcHAsIHsgdGl0bGU6ICdEaXNjYXJkIGNoYW5nZXMnLCBtZXNzYWdlOiAnRGlzY2FyZCB0aGUgY2hhbmdlcyB0byB0aGlzIGl0ZW0/JywgYWN0aW9uOiAnRGlzY2FyZCcsIGRhbmdlcjogdHJ1ZSB9KSxcbiAgfSk7XG4gIHVpLmJ1dHRvbihtb2RhbHMsIHsgdGV4dDogJ1Byb21wdCcsIG9uQ2xpY2s6ICgpID0+IHZvaWQgdWkucHJvbXB0KGFwcCwgeyB0aXRsZTogJ1JlbmFtZSBpdGVtJywgbGFiZWw6ICdOYW1lJywgdmFsdWU6ICdSZWFkaW5nIGxpc3QnLCBhY3Rpb246ICdSZW5hbWUnIH0pIH0pO1xuICB1aS5idXR0b24obW9kYWxzLCB7XG4gICAgdGV4dDogJ0Nob29zZScsXG4gICAgb25DbGljazogKCkgPT4gdm9pZCB1aS5jaG9vc2UoYXBwLCB7XG4gICAgICB0aXRsZTogJ1BpY2sgYSB0ZW1wbGF0ZScsXG4gICAgICBvcHRpb25zOiBbeyB2YWx1ZTogJ2JsYW5rJywgdGV4dDogJ0JsYW5rJywgZGV0YWlsOiAnQW4gZW1wdHkgbm90ZScsIGljb246ICdmaWxlJyB9LCB7IHZhbHVlOiAnZGFpbHknLCB0ZXh0OiAnRGFpbHkgbm90ZScsIGRldGFpbDogJ0hlYWRpbmdzIGZvciB0aGUgZGF5JywgaWNvbjogJ2NhbGVuZGFyJyB9XSxcbiAgICB9KSxcbiAgfSk7XG4gIHVpLmJ1dHRvbihtb2RhbHMsIHtcbiAgICB0ZXh0OiAnRm9ybScsXG4gICAgb25DbGljazogKCkgPT4gdm9pZCB1aS5mb3JtKGFwcCwge1xuICAgICAgdGl0bGU6ICdJbXBvcnQgaXRlbXMnLCBhY3Rpb246ICdJbXBvcnQnLCBtZXNzYWdlOiAnQ29waWVzIHRoZSBpdGVtcyBmcm9tIGEgZm9sZGVyIGludG8gdGhpcyBsaXN0LicsXG4gICAgICBmaWVsZHM6IFtcbiAgICAgICAgeyBpZDogJ3BhdGgnLCBraW5kOiAndGV4dCcsIGxhYmVsOiAnRm9sZGVyJywgcGxhY2Vob2xkZXI6ICdOb3Rlcy9MaXN0cycgfSxcbiAgICAgICAgeyBpZDogJ2tpbmQnLCBraW5kOiAnc2VsZWN0JywgbGFiZWw6ICdLaW5kJywgb3B0aW9uczogW3sgdmFsdWU6ICdub3RlJywgbGFiZWw6ICdOb3RlJyB9LCB7IHZhbHVlOiAnbGluaycsIGxhYmVsOiAnTGluaycgfV0gfSxcbiAgICAgICAgeyBpZDogJ3doZW4nLCBraW5kOiAnY2hvaWNlJywgbGFiZWw6ICdXaGVuJywgdmFsdWU6ICdub3cnLCBvcHRpb25zOiBbeyB2YWx1ZTogJ25vdycsIGxhYmVsOiAnTm93JyB9LCB7IHZhbHVlOiAnbGF0ZXInLCBsYWJlbDogJ1RvbmlnaHQnIH1dIH0sXG4gICAgICAgIHsgaWQ6ICdwYXJ0cycsIGtpbmQ6ICdtdWx0aScsIGxhYmVsOiAnSW5jbHVkZScsIHZhbHVlOiBbJ3RhZ3MnXSwgb3B0aW9uczogW3sgdmFsdWU6ICd0YWdzJywgbGFiZWw6ICdUYWdzJyB9LCB7IHZhbHVlOiAnbGlua3MnLCBsYWJlbDogJ0xpbmtzJyB9XSB9LFxuICAgICAgICB7IGlkOiAnb3BlbicsIGtpbmQ6ICdjaGVja2JveCcsIGxhYmVsOiAnT3BlbiB3aGVuIGRvbmUnLCB2YWx1ZTogdHJ1ZSB9LFxuICAgICAgXSxcbiAgICB9KSxcbiAgfSk7XG4gIHVpLmJ1dHRvbihtb2RhbHMsIHtcbiAgICB0ZXh0OiAnRGlhbG9nJyxcbiAgICBvbkNsaWNrOiAoKSA9PiB2b2lkIHVpLmRpYWxvZyhhcHAsIHtcbiAgICAgIHRpdGxlOiAnRXhwb3J0IGl0ZW1zJywgaWNvbjogJ2Rvd25sb2FkJyxcbiAgICAgIHJlbmRlcjogKGJvZHkpID0+IHZvaWQgdWkua2V5VmFsdWUoYm9keSwgW3sga2V5OiAnSXRlbXMnLCB2YWx1ZTogU3RyaW5nKHBsdWdpbi5kYXRhLml0ZW1zLmxlbmd0aCkgfSwgeyBrZXk6ICdGb3JtYXQnLCB2YWx1ZTogJ01hcmtkb3duJyB9XSksXG4gICAgICBhY3Rpb25zOiBbeyB0ZXh0OiAnRXhwb3J0JywgdmFyaWFudDogJ3ByaW1hcnknLCBvbkNsaWNrOiAoY3R4KSA9PiBjdHguY2xvc2UoJ2V4cG9ydGVkJykgfV0sXG4gICAgfSksXG4gIH0pO1xuXG4gIGNvbnN0IGl0ZW1zID0gKCk6IE1lbnVJdGVtU3BlY1tdID0+IFtcbiAgICB7IHRpdGxlOiAnUmVuYW1lJywgaWNvbjogJ3BlbmNpbCcsIG9uQ2xpY2s6ICgpID0+IHZvaWQgdWkubm90aWNlKCdSZW5hbWUnKSB9LFxuICAgIHsgdGl0bGU6ICdQaW5uZWQnLCBjaGVja2VkOiB0cnVlLCBvbkNsaWNrOiAoKSA9PiB7fSB9LFxuICAgICdzZXBhcmF0b3InLFxuICAgIHsgdGl0bGU6ICdEZWxldGUnLCBpY29uOiAndHJhc2gtMicsIGRhbmdlcjogdHJ1ZSwgb25DbGljazogKCkgPT4gdm9pZCB1aS5ub3RpY2UoJ0RlbGV0ZScpIH0sXG4gIF07XG4gIGNvbnN0IGZsb2F0aW5nID0gdWkudG9vbGJhcih1aS5zZXR0aW5ncy5zZWN0aW9uKGVsLCAnUG9wb3ZlcnMgYW5kIG1lbnVzJyksIHsgbGFiZWw6ICdQb3BvdmVycyBhbmQgbWVudXMnIH0pO1xuICBjb25zdCBhbmNob3IgPSB1aS5idXR0b24oZmxvYXRpbmcsIHtcbiAgICB0ZXh0OiAnUG9wb3ZlcicsXG4gICAgb25DbGljazogKCkgPT4ge1xuICAgICAgY29uc3QgcG9wID0gdWkucG9wb3ZlcihhbmNob3IuZWwsIHsgdGl0bGU6ICdRdWljayBub3RlJywgaWNvbjogJ21lc3NhZ2UtY2lyY2xlJywgcXVvdGU6ICdUaGUgdGV4dCBpdCBpcyBhYm91dC4nIH0pO1xuICAgICAgdWkudGV4dElucHV0KHBvcC5ib2R5LCB7IHBsYWNlaG9sZGVyOiAnQWRkIGEgbm90ZScsIGxhYmVsOiAnTm90ZScgfSk7XG4gICAgICB1aS5idXR0b24ocG9wLmZvb3RlciwgeyB0ZXh0OiAnU2F2ZScsIHZhcmlhbnQ6ICdwcmltYXJ5Jywgb25DbGljazogKCkgPT4gcG9wLmNsb3NlKCkgfSk7XG4gICAgfSxcbiAgfSk7XG4gIC8vIFVuZGVyIHRoZSBidXR0b24sIG5vdCBhdCB0aGUgcG9pbnRlcjogYSBidXR0b24gcHJlc3NlZCBmcm9tIHRoZSBrZXlib2FyZCBoYXMgbm8gcG9pbnRlciBwb3NpdGlvbi5cbiAgY29uc3Qgb3BlbmVyID0gdWkuYnV0dG9uKGZsb2F0aW5nLCB7XG4gICAgdGV4dDogJ01lbnUnLFxuICAgIG9uQ2xpY2s6ICgpID0+IHtcbiAgICAgIGNvbnN0IHsgbGVmdCwgYm90dG9tIH0gPSBvcGVuZXIuZWwuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgICB1aS5tZW51KGl0ZW1zKCksIHsgeDogbGVmdCwgeTogYm90dG9tIH0sIHsgZG9jOiBvcGVuZXIuZWwub3duZXJEb2N1bWVudCB9KTtcbiAgICB9LFxuICB9KTtcbiAgdWkubWVudUJ1dHRvbihmbG9hdGluZywgeyB0ZXh0OiAnQWRkIHRvXHUyMDI2JywgaXRlbXMgfSk7XG4gIHVpLm1vcmVCdXR0b24oZmxvYXRpbmcsIGl0ZW1zKTtcblxuICBjb25zdCBub3RpY2VzID0gdWkudG9vbGJhcih1aS5zZXR0aW5ncy5zZWN0aW9uKGVsLCAnTm90aWNlcycpLCB7IGxhYmVsOiAnTm90aWNlcycgfSk7XG4gIGZvciAoY29uc3Qga2luZCBvZiBbJ2luZm8nLCAnc3VjY2VzcycsICdlcnJvciddIGFzIGNvbnN0KSB7XG4gICAgdWkuYnV0dG9uKG5vdGljZXMsIHsgdGV4dDoga2luZCwgb25DbGljazogKCkgPT4gdm9pZCB1aS5ub3RpY2UoYFRoaXMgaXMgYSAke2tpbmR9IG5vdGljZS5gLCB7IGtpbmQgfSkgfSk7XG4gIH1cbiAgdWkuYnV0dG9uKG5vdGljZXMsIHtcbiAgICB0ZXh0OiAnV2l0aCBhbiBhY3Rpb24nLFxuICAgIG9uQ2xpY2s6ICgpID0+IHZvaWQgdWkubm90aWNlKCcyIGl0ZW1zIG5lZWQgcmV2aWV3LicsIHsgYWN0aW9uOiB7IHRleHQ6ICdSZXZpZXcnLCBvbkNsaWNrOiAoKSA9PiB2b2lkIHVpLm5vdGljZSgnUmV2aWV3aW5nLicpIH0gfSksXG4gIH0pO1xuXG4gIC8vIEEgc3RhbmRhcmQgYWN0aW9uIGhhcyBpdHMgaWNvbiwgbGFiZWwgYW5kIGxvb2sgYWxyZWFkeS4gYGRlbGV0ZWAgYW5kIGByZW1vdmVgIGFzayBmaXJzdC5cbiAgY29uc3QgYWN0aW9ucyA9IHVpLnRvb2xiYXIodWkuc2V0dGluZ3Muc2VjdGlvbihlbCwgJ1N0YW5kYXJkIGFjdGlvbnMnKSwgeyBsYWJlbDogJ1N0YW5kYXJkIGFjdGlvbnMnIH0pO1xuICBmb3IgKGNvbnN0IGlkIG9mIE9iamVjdC5rZXlzKHVpLlNUQU5EQVJEX0FDVElPTlMpIGFzIEFjdGlvbklkW10pIHtcbiAgICB1aS5hY3Rpb24oYWN0aW9ucywgaWQsIHsgYXBwLCBzdWJqZWN0OiAnRXhhbXBsZScsIG9uQ2xpY2s6ICgpID0+IHZvaWQgdWkubm90aWNlKHVpLlNUQU5EQVJEX0FDVElPTlNbaWRdLmxhYmVsKSB9KTtcbiAgfVxufVxuIiwgIi8vIEJ1dHRvbnMgYW5kIGZvcm0gY29udHJvbHMuIGB1aS5zZXR0aW5ncy5zZWN0aW9uYCBpcyBhIGhlYWRpbmcgYW5kIGl0cyBjb250YWluZXIsIGluIGEgdmlldyBhcyBpbiBhIHNldHRpbmdzIHRhYi5cbmltcG9ydCB7IHVpIH0gZnJvbSAnaGVsZW5pdGUnO1xuXG5leHBvcnQgZnVuY3Rpb24gZHJhd0lucHV0cyhlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgY29uc3QgYnV0dG9ucyA9IHVpLnRvb2xiYXIodWkuc2V0dGluZ3Muc2VjdGlvbihlbCwgJ0J1dHRvbnMnKSwgeyBsYWJlbDogJ0J1dHRvbiB2YXJpYW50cycgfSk7XG4gIHVpLmJ1dHRvbihidXR0b25zLCB7IHRleHQ6ICdEZWZhdWx0JyB9KTtcbiAgdWkuYnV0dG9uKGJ1dHRvbnMsIHsgdGV4dDogJ1ByaW1hcnknLCB2YXJpYW50OiAncHJpbWFyeScgfSk7XG4gIHVpLmJ1dHRvbihidXR0b25zLCB7IHRleHQ6ICdEYW5nZXInLCB2YXJpYW50OiAnZGFuZ2VyJyB9KTtcbiAgdWkuYnV0dG9uKGJ1dHRvbnMsIHsgdGV4dDogJ0xpbmsnLCB2YXJpYW50OiAnbGluaycgfSk7XG4gIHVpLmJ1dHRvbihidXR0b25zLCB7IHZhcmlhbnQ6ICdpY29uJywgaWNvbjogJ3NldHRpbmdzJywgbGFiZWw6ICdDb25maWd1cmUnIH0pO1xuICB1aS5idXR0b24oYnV0dG9ucywgeyB0ZXh0OiAnUHJlc3NlZCcsIHByZXNzZWQ6IHRydWUgfSk7XG4gIHVpLmJ1dHRvbihidXR0b25zLCB7IHRleHQ6ICdEaXNhYmxlZCcsIGRpc2FibGVkOiB0cnVlIH0pO1xuXG4gIGNvbnN0IGZpZWxkcyA9IHVpLnNldHRpbmdzLnNlY3Rpb24oZWwsICdGaWVsZHMnKTtcbiAgLy8gQSBmaWVsZCBuYW1lcyBpdHMgY29udHJvbCBhbmQgc2hvd3MgaXRzIGhpbnQgYW5kIGVycm9yLlxuICBjb25zdCBuYW1lID0gdWkuZmllbGQoZmllbGRzLCB7IGxhYmVsOiAnTmFtZScsIGhpbnQ6ICdTaG93biBpbiB0aGUgbGlzdHMuJywgZmlsbDogdHJ1ZSB9KTtcbiAgdWkudGV4dElucHV0KG5hbWUuY29udHJvbCwgeyB2YWx1ZTogJ1JlYWRpbmcgbGlzdCcsIG9uSW5wdXQ6ICh2KSA9PiBuYW1lLnNldEVycm9yKHYudHJpbSgpID8gbnVsbCA6ICdFbnRlciBhIG5hbWUuJykgfSk7XG4gIGNvbnN0IGtleSA9IHVpLmZpZWxkKGZpZWxkcywgeyBsYWJlbDogJ0FQSSBrZXknLCBmaWxsOiB0cnVlIH0pO1xuICB1aS50ZXh0SW5wdXQoa2V5LmNvbnRyb2wsIHsgc2VjcmV0OiB0cnVlLCBwbGFjZWhvbGRlcjogJ1Bhc3RlIHRoZSBrZXknIH0pO1xuICBjb25zdCBub3RlID0gdWkuZmllbGQoZmllbGRzLCB7IGxhYmVsOiAnRGVzY3JpcHRpb24nLCBmaWxsOiB0cnVlIH0pO1xuICB1aS50ZXh0SW5wdXQobm90ZS5jb250cm9sLCB7IG11bHRpbGluZTogdHJ1ZSwgcm93czogMywgcGxhY2Vob2xkZXI6ICdXaGF0IHRoZSBpdGVtIGlzIGZvcicgfSk7XG4gIGNvbnN0IGludmFsaWQgPSB1aS5maWVsZChmaWVsZHMsIHsgbGFiZWw6ICdMaW1pdCcsIGlubGluZTogdHJ1ZSB9KTtcbiAgdWkudGV4dElucHV0KGludmFsaWQuY29udHJvbCwgeyB0eXBlOiAnbnVtYmVyJywgdmFsdWU6ICcwJyB9KTtcbiAgaW52YWxpZC5zZXRFcnJvcignRW50ZXIgYSBudW1iZXIgYWJvdmUgMC4nKTtcbiAgY29uc3Qga2luZCA9IHVpLmZpZWxkKGZpZWxkcywgeyBsYWJlbDogJ0tpbmQnLCBpbmxpbmU6IHRydWUgfSk7XG4gIHVpLmRyb3Bkb3duKGtpbmQuY29udHJvbCwgeyBvcHRpb25zOiBbeyB2YWx1ZTogJ25vdGUnLCB0ZXh0OiAnTm90ZScgfSwgeyB2YWx1ZTogJ2xpbmsnLCB0ZXh0OiAnTGluaycgfV0sIHZhbHVlOiAnbm90ZScgfSk7XG5cbiAgY29uc3Qgc3dpdGNoZXMgPSB1aS5zZXR0aW5ncy5zZWN0aW9uKGVsLCAnU3dpdGNoZXMgYW5kIHNsaWRlcnMnKTtcbiAgY29uc3QgdG9nZ2xlcyA9IHVpLnRvb2xiYXIoc3dpdGNoZXMsIHsgbGFiZWw6ICdTd2l0Y2hlcycgfSk7XG4gIHVpLnRvZ2dsZSh0b2dnbGVzLCB7IHZhbHVlOiB0cnVlLCBsYWJlbDogJ1Nob3cgZmluaXNoZWQgaXRlbXMnIH0pO1xuICB1aS50b2dnbGUodG9nZ2xlcywgeyB2YWx1ZTogZmFsc2UsIGxhYmVsOiAnU3luYyBpdGVtcycsIGRpc2FibGVkOiB0cnVlIH0pO1xuICB1aS5zbGlkZXIodWkuZmllbGQoc3dpdGNoZXMsIHsgbGFiZWw6ICdJdGVtcyBwZXIgcGFnZScsIGlubGluZTogdHJ1ZSB9KS5jb250cm9sLCB7IG1pbjogMTAsIG1heDogNTAsIHN0ZXA6IDUsIHZhbHVlOiAyNSwgbGFiZWw6ICdJdGVtcyBwZXIgcGFnZScsIG9uQ2hhbmdlOiAoKSA9PiB7fSB9KTtcblxuICBjb25zdCBsaXN0cyA9IHVpLnNldHRpbmdzLnNlY3Rpb24oZWwsICdMaXN0cyB0byBwaWNrIGZyb20nKTtcbiAgdWkuY2hlY2tMaXN0KHVpLmZpZWxkKGxpc3RzLCB7IGxhYmVsOiAnU2hvdyBraW5kcycsIGZpbGw6IHRydWUgfSkuY29udHJvbCwge1xuICAgIG9wdGlvbnM6IFtcbiAgICAgIHsgdmFsdWU6ICdub3RlJywgdGV4dDogJ05vdGVzJywgZGV0YWlsOiAnTWFya2Rvd24gZmlsZXMgaW4gdGhpcyB2YXVsdCcgfSxcbiAgICAgIHsgdmFsdWU6ICdsaW5rJywgdGV4dDogJ0xpbmtzJyB9LFxuICAgICAgeyB2YWx1ZTogJ2ZpbGUnLCB0ZXh0OiAnRmlsZXMnLCBkZXRhaWw6ICdOb3Qgc3VwcG9ydGVkIHlldCcsIGRpc2FibGVkOiB0cnVlIH0sXG4gICAgXSxcbiAgICB2YWx1ZTogWydub3RlJywgJ2xpbmsnXSxcbiAgfSk7XG4gIHVpLmNob2ljZUxpc3QodWkuZmllbGQobGlzdHMsIHsgbGFiZWw6ICdPcGVuIGl0ZW1zIGluJywgZmlsbDogdHJ1ZSB9KS5jb250cm9sLCB7XG4gICAgaW5kaWNhdG9yOiAncmFkaW8nLFxuICAgIG9wdGlvbnM6IFtcbiAgICAgIHsgdmFsdWU6ICd0YWInLCB0ZXh0OiAnQSBuZXcgdGFiJywgZGV0YWlsOiAnS2VlcHMgdGhpcyB2aWV3IG9wZW4nLCBpY29uOiAncGx1cy1zcXVhcmUnLCB0YWc6ICdEZWZhdWx0Jywga2V5OiAnMScgfSxcbiAgICAgIHsgdmFsdWU6ICdzcGxpdCcsIHRleHQ6ICdBIHNwbGl0JywgaWNvbjogJ2NvbHVtbnMtMicsIGtleTogJzInIH0sXG4gICAgICB7IHZhbHVlOiAnd2luZG93JywgdGV4dDogJ0EgbmV3IHdpbmRvdycsIGljb246ICdhcHAtd2luZG93Jywga2V5OiAnMycsIGRpc2FibGVkOiB0cnVlIH0sXG4gICAgXSxcbiAgICB2YWx1ZTogJ3RhYicsXG4gICAgb25DaGFuZ2U6ICgpID0+IHt9LFxuICB9KTtcblxuICBjb25zdCBjb21wb3NlID0gdWkuc2V0dGluZ3Muc2VjdGlvbihlbCwgJ0NvbXBvc2VyJyk7XG4gIHVpLmNvbXBvc2VyKGNvbXBvc2UsIHtcbiAgICBwbGFjZWhvbGRlcjogJ0FkZCBhIGNvbW1lbnQnLCBoaW50OiAnRW50ZXIgc2VuZHMsIFNoaWZ0K0VudGVyIHN0YXJ0cyBhIG5ldyBsaW5lLicsXG4gICAgb25BdHRhY2g6ICgpID0+IFt7IG5hbWU6ICdub3Rlcy5tZCcgfV0sXG4gICAgb25TdWJtaXQ6ICh0ZXh0KSA9PiB2b2lkIHVpLm5vdGljZShgU2VudDogJHt0ZXh0fWApLFxuICB9KTtcbn1cbiIsICIvLyBBIHRvb2xiYXIgb3ZlciB0aGUgaXRlbXMsIHNob3duIGFzIGdyb3VwZWQgbGlzdCByb3dzIG9yIGFzIGEgdGFibGUuXG5pbXBvcnQgeyB1aSB9IGZyb20gJ2hlbGVuaXRlJztcbmltcG9ydCB7IFNUQVRVU0VTLCBzdGF0dXNPZiwgdHlwZSBJdGVtIH0gZnJvbSAnLi4vZGF0YSc7XG5pbXBvcnQgeyBpdGVtTWVudSwgaXRlbVRhYmxlLCBvcGVuSXRlbSB9IGZyb20gJy4uL2l0ZW0tcGFydHMnO1xuaW1wb3J0IHR5cGUgU2FtcGxlRGVzaWduU3lzdGVtUGx1Z2luIGZyb20gJy4uL21haW4nO1xuXG5leHBvcnQgaW50ZXJmYWNlIEl0ZW1GaWx0ZXIge1xuICBxdWVyeTogc3RyaW5nO1xuICBraW5kOiBzdHJpbmc7XG4gIGxheW91dDogc3RyaW5nO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZHJhd0l0ZW1zKGVsOiBIVE1MRWxlbWVudCwgcGx1Z2luOiBTYW1wbGVEZXNpZ25TeXN0ZW1QbHVnaW4sIGZpbHRlcjogSXRlbUZpbHRlcik6IHZvaWQge1xuICBjb25zdCBiYXIgPSB1aS50b29sYmFyKGVsLCB7IGxhYmVsOiAnSXRlbSBmaWx0ZXJzJyB9KTtcbiAgdWkuc2VhcmNoSW5wdXQoYmFyLCB7XG4gICAgcGxhY2Vob2xkZXI6ICdTZWFyY2ggaXRlbXMnLCB2YWx1ZTogZmlsdGVyLnF1ZXJ5LFxuICAgIG9uU2VhcmNoOiAocSkgPT4ge1xuICAgICAgZmlsdGVyLnF1ZXJ5ID0gcTtcbiAgICAgIGRyYXcoKTtcbiAgICB9LFxuICB9KTtcbiAgdWkuZHJvcGRvd24oYmFyLCB7XG4gICAgbGFiZWw6ICdLaW5kJywgY29tcGFjdDogdHJ1ZSwgdmFsdWU6IGZpbHRlci5raW5kLFxuICAgIG9wdGlvbnM6IFt7IHZhbHVlOiAnYWxsJywgdGV4dDogJ0FsbCBraW5kcycgfSwgeyB2YWx1ZTogJ25vdGUnLCB0ZXh0OiAnTm90ZXMnIH0sIHsgdmFsdWU6ICdsaW5rJywgdGV4dDogJ0xpbmtzJyB9XSxcbiAgICBvbkNoYW5nZTogKGtpbmQpID0+IHtcbiAgICAgIGZpbHRlci5raW5kID0ga2luZDtcbiAgICAgIGRyYXcoKTtcbiAgICB9LFxuICB9KTtcbiAgdWkuc2VnbWVudGVkKGJhciwge1xuICAgIGxhYmVsOiAnVmlldzonLCB2YWx1ZTogZmlsdGVyLmxheW91dCxcbiAgICBvcHRpb25zOiBbeyB2YWx1ZTogJ2xpc3QnLCB0ZXh0OiAnTGlzdCcgfSwgeyB2YWx1ZTogJ3RhYmxlJywgdGV4dDogJ1RhYmxlJyB9XSxcbiAgICBvbkNoYW5nZTogKGxheW91dCkgPT4ge1xuICAgICAgZmlsdGVyLmxheW91dCA9IGxheW91dDtcbiAgICAgIGRyYXcoKTtcbiAgICB9LFxuICB9KTtcbiAgLy8gYGhlbC10b29sYmFyLWVuZGAgcHVzaGVzIGEgYnV0dG9uIHRvIHRoZSBmYXIgZW5kIG9mIGEgdG9vbGJhci5cbiAgdWkuYnV0dG9uKGJhciwgeyB0ZXh0OiAnQWRkIGl0ZW0nLCB2YXJpYW50OiAncHJpbWFyeScsIG9uQ2xpY2s6ICgpID0+IHZvaWQgcGx1Z2luLmFkZEl0ZW0oKSB9KS5lbC5jbGFzc0xpc3QuYWRkKCdoZWwtdG9vbGJhci1lbmQnKTtcblxuICBjb25zdCBsaXN0ID0gZWwuY3JlYXRlRGl2KCk7XG4gIGNvbnN0IGRyYXcgPSAoKTogdm9pZCA9PiB7XG4gICAgbGlzdC5lbXB0eSgpO1xuICAgIGNvbnN0IHEgPSBmaWx0ZXIucXVlcnkudG9Mb3dlckNhc2UoKTtcbiAgICBjb25zdCBpdGVtcyA9IHBsdWdpbi5kYXRhLml0ZW1zLmZpbHRlcigoaSkgPT4gaS5uYW1lLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSkgJiYgKGZpbHRlci5raW5kID09PSAnYWxsJyB8fCBpLmtpbmQgPT09IGZpbHRlci5raW5kKSk7XG4gICAgaWYgKCFpdGVtcy5sZW5ndGgpIHtcbiAgICAgIHVpLmVtcHR5U3RhdGUobGlzdCwgcGx1Z2luLmRhdGEuaXRlbXMubGVuZ3RoID8gJ05vIGl0ZW1zIG1hdGNoLicgOiAnTm8gaXRlbXMgeWV0LicpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoZmlsdGVyLmxheW91dCA9PT0gJ3RhYmxlJykgaXRlbVRhYmxlKGxpc3QsIHBsdWdpbiwgaXRlbXMpO1xuICAgIGVsc2UgZHJhd0dyb3VwcyhsaXN0LCBwbHVnaW4sIGl0ZW1zKTtcbiAgfTtcbiAgZHJhdygpO1xufVxuXG5mdW5jdGlvbiBkcmF3R3JvdXBzKGVsOiBIVE1MRWxlbWVudCwgcGx1Z2luOiBTYW1wbGVEZXNpZ25TeXN0ZW1QbHVnaW4sIGl0ZW1zOiBJdGVtW10pOiB2b2lkIHtcbiAgY29uc3QgZGV0YWlsZWQgPSBwbHVnaW4uZGF0YS5kZW5zaXR5ID09PSAnZGV0YWlsZWQnO1xuICBmb3IgKGNvbnN0IHN0YXR1cyBvZiBTVEFUVVNFUykge1xuICAgIGNvbnN0IHJvd3MgPSBpdGVtcy5maWx0ZXIoKGkpID0+IGkuc3RhdHVzID09PSBzdGF0dXMuaWQpO1xuICAgIGlmICghcm93cy5sZW5ndGgpIGNvbnRpbnVlO1xuICAgIGNvbnN0IGdyb3VwID0gdWkubGlzdEdyb3VwKGVsLCB7IHRpdGxlOiBzdGF0dXMudGV4dCwgY291bnQ6IHJvd3MubGVuZ3RoIH0pO1xuICAgIGZvciAoY29uc3QgaXRlbSBvZiByb3dzKSB7XG4gICAgICB1aS5saXN0Um93KGdyb3VwLmJvZHksIHtcbiAgICAgICAgdGl0bGU6IGl0ZW0ubmFtZSxcbiAgICAgICAgZG90OiB7IHRvbmU6IHN0YXR1c09mKGl0ZW0pLnRvbmUsIGxhYmVsOiBzdGF0dXNPZihpdGVtKS50ZXh0IH0sXG4gICAgICAgIHRhZzogaXRlbS5waW5uZWQgPyAnUGlubmVkJyA6IHVuZGVmaW5lZCxcbiAgICAgICAgbWV0YTogaXRlbS5raW5kLFxuICAgICAgICAvLyBUaGUgZGV0YWlsZWQgZGVuc2l0eSBhZGRzIGEgc2Vjb25kIGxpbmUgYW5kIGEgbGluZSBvZiBjaGlwcy5cbiAgICAgICAgc3ViOiBkZXRhaWxlZCA/IGAke3N0YXR1c09mKGl0ZW0pLnRleHR9IFx1MDBCNyBhZGRlZCBmcm9tIHRoZSBzYW1wbGVgIDogdW5kZWZpbmVkLFxuICAgICAgICBjaGlwczogZGV0YWlsZWQgJiYgaXRlbS5waW5uZWQgPyBbeyB0ZXh0OiAncGlubmVkJywgdG9uZTogJ2FjY2VudCcgfSwgaXRlbS5raW5kXSA6IHVuZGVmaW5lZCxcbiAgICAgICAgYWN0aW9uczogW3sgaWNvbjogJ3BlbmNpbCcsIGxhYmVsOiAnUmVuYW1lJywgaWQ6ICdyZW5hbWUnLCBvbkNsaWNrOiAoKSA9PiB2b2lkIHBsdWdpbi5yZW5hbWUoaXRlbSkgfV0sXG4gICAgICAgIG9uQ2xpY2s6ICgpID0+IHZvaWQgb3Blbkl0ZW0ocGx1Z2luLCBpdGVtKSxcbiAgICAgICAgbWVudTogKCkgPT4gaXRlbU1lbnUocGx1Z2luLCBpdGVtKSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuIiwgIi8vIFBhcnRzIHRoYXQgdGVsbCB0aGUgdXNlciBob3cgdGhpbmdzIHN0YW5kOiBtZXNzYWdlcywgbGFiZWxzLCByZWFkaW5ncywgYW5kIHdoYXQgdG8gc2hvdyB3aXRoIG5vdGhpbmcgdG8gc2hvdy5cbmltcG9ydCB7IHVpLCB0eXBlIFRvbmUgfSBmcm9tICdoZWxlbml0ZSc7XG5pbXBvcnQgeyBjb3VudCB9IGZyb20gJy4uL2RhdGEnO1xuXG5jb25zdCBUT05FUzogVG9uZVtdID0gWydkZWZhdWx0JywgJ2FjY2VudCcsICdzdWNjZXNzJywgJ3dhcm5pbmcnLCAnZGFuZ2VyJ107XG5cbmV4cG9ydCBmdW5jdGlvbiBkcmF3U3RhdHVzKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICBjb25zdCBjYWxsb3V0cyA9IHVpLnNldHRpbmdzLnNlY3Rpb24oZWwsICdDYWxsb3V0cycpO1xuICB1aS5jYWxsb3V0KGNhbGxvdXRzLCB7IHRvbmU6ICdpbmZvJywgdGV4dDogJ0l0ZW1zIGFyZSBzYXZlZCBpbiB0aGlzIHZhdWx0LicgfSk7XG4gIHVpLmNhbGxvdXQoY2FsbG91dHMsIHsgdG9uZTogJ2FjY2VudCcsIHRleHQ6ICcyIGl0ZW1zIGFyZSB3YWl0aW5nIGZvciB5b3UuJywgYWN0aW9uOiB7IHRleHQ6ICdSZXZpZXcnLCBvbkNsaWNrOiAoKSA9PiB2b2lkIHVpLm5vdGljZSgnTm90aGluZyB0byByZXZpZXcuJykgfSB9KTtcbiAgdWkuY2FsbG91dChjYWxsb3V0cywgeyB0b25lOiAnc3VjY2VzcycsIHRleHQ6ICdFdmVyeXRoaW5nIGlzIHVwIHRvIGRhdGUuJyB9KTtcbiAgdWkuY2FsbG91dChjYWxsb3V0cywgeyB0b25lOiAnd2FybmluZycsIHRleHQ6ICdUaGlzIGxpbmsgaGFzIG5vdCBiZWVuIGNoZWNrZWQgZm9yIGEgbW9udGguJyB9KTtcbiAgdWkuY2FsbG91dChjYWxsb3V0cywgeyB0b25lOiAnZGFuZ2VyJywgdGV4dDogJ0NvdWxkIG5vdCByZWFjaCB0aGUgc2VydmVyLicgfSk7XG4gIHVpLmNhbGxvdXQoY2FsbG91dHMsIHsgdG9uZTogJ2FjY2VudCcsIHNvbGlkOiB0cnVlLCB0ZXh0OiAnQW4gYWdlbnQgaXMgd2FpdGluZyBvbiB5b3UuJyB9KTtcblxuICAvLyBBIHNldHRpbmdzIHJvdydzIGNvbnRyb2wgYXJlYSBsYXlzIHNtYWxsIHRoaW5ncyBvdXQgc2lkZSBieSBzaWRlLiAoYHVpLnRvb2xiYXJgIGlzIGZvciBjb250cm9scy4pXG4gIGNvbnN0IGxhYmVscyA9IHVpLnNldHRpbmdzLnNlY3Rpb24oZWwsICdCYWRnZXMsIGRvdHMsIGNvdW50cywgY2hpcHMsIGF2YXRhcnMgYW5kIHN3YXRjaGVzJyk7XG4gIGNvbnN0IHJvdyA9IChuYW1lOiBzdHJpbmcpID0+IG5ldyB1aS5zZXR0aW5ncy5yb3cobGFiZWxzKS5zZXROYW1lKG5hbWUpLmNvbnRyb2xFbDtcbiAgY29uc3QgYmFkZ2VzID0gcm93KCdCYWRnZXMnKTtcbiAgZm9yIChjb25zdCB0b25lIG9mIFRPTkVTKSB1aS5iYWRnZShiYWRnZXMsIHRvbmUsIHRvbmUpO1xuICBjb25zdCBkb3RzID0gcm93KCdTdGF0dXMgZG90cycpO1xuICBmb3IgKGNvbnN0IHRvbmUgb2YgVE9ORVMpIHVpLnN0YXR1c0RvdChkb3RzLCB0b25lLCB0b25lKTtcbiAgdWkuc3RhdHVzRG90KGRvdHMsICd3YXJuaW5nJywgJ1dhaXRpbmcgZm9yIHlvdScsIHsgcHVsc2U6IHRydWUgfSk7XG4gIGNvbnN0IHdvcmRzID0gcm93KCdTdGF0dXMgdGV4dCcpO1xuICBmb3IgKGNvbnN0IHRvbmUgb2YgVE9ORVMpIHVpLnN0YXR1c1RleHQod29yZHMsIHRvbmUsIHRvbmUpO1xuICBjb25zdCBjb3VudHMgPSByb3coJ0NvdW50cycpO1xuICB1aS5jb3VudEJhZGdlKGNvdW50cywgMywgeyBsYWJlbDogJ3VucmVhZCcgfSk7XG4gIHVpLmNvdW50QmFkZ2UoY291bnRzLCAxMiwgeyBsYWJlbDogJ3dhaXRpbmcnLCB0b25lOiAnZGFuZ2VyJywgaWNvbjogJ2NpcmNsZS1oZWxwJyB9KTtcbiAgY29uc3QgY2hpcHMgPSByb3coJ0NoaXBzJyk7XG4gIHVpLmNoaXAoY2hpcHMsICdwcm9qZWN0Jyk7XG4gIHVpLmNoaXAoY2hpcHMsICdkcmFmdCcsIHsgdG9uZTogJ2FjY2VudCcsIG9uUmVtb3ZlOiAoKSA9PiB7fSB9KTtcbiAgdWkuY2hpcChjaGlwcywgJ2Jyb2tlbicsIHsgdG9uZTogJ2RhbmdlcicgfSk7XG4gIGNvbnN0IHBlb3BsZSA9IHJvdygnQXZhdGFycycpO1xuICBmb3IgKGNvbnN0IHNpemUgb2YgWydzbWFsbCcsICdtZWRpdW0nLCAnbGFyZ2UnXSBhcyBjb25zdCkgdWkuYXZhdGFyKHBlb3BsZSwgeyB0ZXh0OiAnQWRhIExvdmVsYWNlJywgc2l6ZSB9KTtcbiAgdWkuYXZhdGFyKHBlb3BsZSwgeyB0ZXh0OiAnKzMnIH0pO1xuICBjb25zdCB2YWx1ZXMgPSByb3coJ1N3YXRjaGVzJyk7XG4gIHVpLnN3YXRjaCh2YWx1ZXMsIHsga2luZDogJ2NvbG9yJywgdmFsdWU6ICd2YXIoLS1pbnRlcmFjdGl2ZS1hY2NlbnQpJywgbGFiZWw6ICctLWludGVyYWN0aXZlLWFjY2VudCcgfSk7XG4gIHVpLnN3YXRjaCh2YWx1ZXMsIHsga2luZDogJ3JhZGl1cycsIHZhbHVlOiAndmFyKC0tcmFkaXVzLW0pJywgbGFiZWw6ICctLXJhZGl1cy1tJyB9KTtcbiAgdWkuc3dhdGNoKHZhbHVlcywgeyBraW5kOiAnc2hhZG93JywgdmFsdWU6ICd2YXIoLS1zaGFkb3ctcyknLCBsYWJlbDogJy0tc2hhZG93LXMnIH0pO1xuICB1aS5zd2F0Y2godmFsdWVzLCB7IGtpbmQ6ICdzaXplJywgdmFsdWU6ICd2YXIoLS1zaXplLTQtNiknLCBsYWJlbDogJy0tc2l6ZS00LTYnIH0pO1xuICB1aS5zd2F0Y2godmFsdWVzLCB7IGtpbmQ6ICdmb250LWZhbWlseScsIHZhbHVlOiAndmFyKC0tZm9udC1tb25vc3BhY2UpJywgbGFiZWw6ICctLWZvbnQtbW9ub3NwYWNlJyB9KTtcblxuICBjb25zdCByZWFkaW5ncyA9IHVpLnNldHRpbmdzLnNlY3Rpb24oZWwsICdNZXRlcnMnKTtcbiAgY29uc3QgaW5saW5lID0gbmV3IHVpLnNldHRpbmdzLnJvdyhyZWFkaW5ncykuc2V0TmFtZSgnSW5saW5lJykuY29udHJvbEVsO1xuICB1aS5tZXRlcihpbmxpbmUsIHsgbGFiZWw6ICdTdG9yYWdlJywgdmFsdWU6IDMwLCB0ZXh0OiAnMzAlJywgdG9uZTogJ3N1Y2Nlc3MnIH0pO1xuICB1aS5tZXRlcihpbmxpbmUsIHsgbGFiZWw6ICdRdW90YScsIHZhbHVlOiA3NSwgdGV4dDogJzc1JScsIHRvbmU6ICd3YXJuaW5nJyB9KTtcbiAgdWkubWV0ZXIocmVhZGluZ3MsIHsgbGF5b3V0OiAnc3RhY2tlZCcsIGxhYmVsOiAnTW9udGhseSBidWRnZXQnLCB2YWx1ZTogOTYsIHRleHQ6ICckNDggb2YgJDUwJywgc3ViOiAncmVzZXRzIGluIDMgZGF5cycsIHRvbmU6ICdkYW5nZXInIH0pO1xuXG4gIGNvbnN0IGFkZGVkID0gWzIsIDUsIDMsIDAsIDYsIDgsIDQsIDcsIDEsIDldLm1hcCgodmFsdWUsIGkpID0+ICh7IGRheTogYE5vdiAke2kgKyAxMn1gLCB2YWx1ZSB9KSk7XG4gIGNvbnN0IGNoYXJ0ID0gdWkuc2V0dGluZ3Muc2VjdGlvbihlbCwgJ0JhciBjaGFydCcpO1xuICB1aS5iYXJDaGFydChjaGFydCwge1xuICAgIGxhYmVsOiAnSXRlbXMgYWRkZWQgcGVyIGRheScsXG4gICAgYnVja2V0czogYWRkZWQubWFwKCh7IGRheSwgdmFsdWUgfSkgPT4gKHsga2V5OiBkYXksIHZhbHVlLCB0aXRsZTogYCR7ZGF5fTogJHtjb3VudCh2YWx1ZSwgJ2l0ZW0nKX1gIH0pKSxcbiAgfSk7XG4gIC8vIEEgY2hhcnQgaXMgcmVhZCBhcyBvbmUgaW1hZ2U6IHB1dCB0aGUgZmlndXJlcyB0aGF0IG1hdHRlciBpbiB0ZXh0IGJlc2lkZSBpdC5cbiAgY29uc3QgbW9zdCA9IGFkZGVkLnJlZHVjZSgoYSwgYikgPT4gKGIudmFsdWUgPiBhLnZhbHVlID8gYiA6IGEpKTtcbiAgY29uc3QgdG90YWwgPSBhZGRlZC5yZWR1Y2UoKHN1bSwgZCkgPT4gc3VtICsgZC52YWx1ZSwgMCk7XG4gIHVpLnN0YXR1c1RleHQoY2hhcnQsIGAke2NvdW50KHRvdGFsLCAnaXRlbScpfSBhZGRlZDsgdGhlIG1vc3QsICR7bW9zdC52YWx1ZX0sIG9uICR7bW9zdC5kYXl9LmApO1xuXG4gIGNvbnN0IHdhaXRpbmcgPSB1aS5zZXR0aW5ncy5zZWN0aW9uKGVsLCAnTG9hZGluZycpO1xuICB1aS5sb2FkaW5nU3RhdGUod2FpdGluZywgJ0xvYWRpbmcgaXRlbXNcdTIwMjYnKTtcbiAgdWkubG9hZGluZ1N0YXRlKHdhaXRpbmcsICdJbXBvcnRpbmcnLCB7IHByb2dyZXNzOiAwLjQgfSk7XG5cbiAgdWkuZW1wdHlTdGF0ZSh1aS5zZXR0aW5ncy5zZWN0aW9uKGVsLCAnRW1wdHkgc3RhdGUnKSwgJ05vIGl0ZW1zIHlldC4nKTtcbiAgdWkuZXJyb3JTdGF0ZSh1aS5zZXR0aW5ncy5zZWN0aW9uKGVsLCAnRXJyb3Igc3RhdGUnKSwgJ0NvdWxkIG5vdCBsb2FkIHRoZSBpdGVtcy4nLCAoKSA9PiB2b2lkIHVpLm5vdGljZSgnVHJ5aW5nIGFnYWluLicpKTtcbiAgY29uc3Qgc21hbGwgPSB1aS5zZXR0aW5ncy5zZWN0aW9uKGVsLCAnSW5saW5lIHN0YXRlcywgZm9yIGEgc2V0dGluZ3MgbGlzdCcpO1xuICB1aS5lbXB0eVN0YXRlKHNtYWxsLCAnTm8gYWNjb3VudHMgeWV0LicsIHsgdmFyaWFudDogJ2lubGluZScgfSk7XG4gIHVpLmVycm9yU3RhdGUoc21hbGwsICdDb3VsZCBub3QgY29ubmVjdC4nLCAoKSA9PiB7fSwgeyB2YXJpYW50OiAnaW5saW5lJywgcmV0cnlMYWJlbDogJ1JlY29ubmVjdCcgfSk7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFHQSxJQUFBQSxtQkFBdUI7QUFHdkIsSUFBQUMsb0JBQTBDOzs7QUNjbkMsSUFBTSxXQUFtRjtBQUFBLEVBQzlGLEVBQUUsSUFBSSxRQUFRLE1BQU0sU0FBUyxNQUFNLFVBQVU7QUFBQSxFQUM3QyxFQUFFLElBQUksU0FBUyxNQUFNLFNBQVMsTUFBTSxTQUFTO0FBQUEsRUFDN0MsRUFBRSxJQUFJLFFBQVEsTUFBTSxRQUFRLE1BQU0sVUFBVTtBQUM5QztBQUdPLElBQU0sUUFBUSxDQUFDLEdBQVcsU0FBaUIsR0FBRyxDQUFDLElBQUksSUFBSSxHQUFHLE1BQU0sSUFBSSxLQUFLLEdBQUc7QUFFNUUsSUFBTSxXQUFXLENBQUMsU0FBZSxTQUFTLEtBQUssQ0FBQyxNQUFNLEVBQUUsT0FBTyxLQUFLLE1BQU0sS0FBSyxTQUFTLENBQUM7QUFFaEcsSUFBTSxPQUFlO0FBQUEsRUFDbkIsRUFBRSxJQUFJLEtBQUssTUFBTSxnQkFBZ0IsTUFBTSxRQUFRLFFBQVEsU0FBUyxRQUFRLEtBQUs7QUFBQSxFQUM3RSxFQUFFLElBQUksS0FBSyxNQUFNLHFCQUFxQixNQUFNLFFBQVEsUUFBUSxRQUFRLFFBQVEsTUFBTTtBQUFBLEVBQ2xGLEVBQUUsSUFBSSxLQUFLLE1BQU0saUJBQWlCLE1BQU0sUUFBUSxRQUFRLFFBQVEsUUFBUSxNQUFNO0FBQUEs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QUFVLENBQUMsTUFBTyxFQUFFLEtBQUssSUFBSSxPQUFPO0FBQUEsSUFDdEMsQ0FBQztBQUNELFFBQUksU0FBUyxLQUFNO0FBQ25CLFNBQUssT0FBTyxLQUFLLEtBQUs7QUFDdEIsVUFBTSxLQUFLLEtBQUs7QUFBQSxFQUNsQjtBQUFBLEVBRUEsTUFBTSxPQUFPLE1BQTJCO0FBQ3RDLFNBQUssS0FBSyxRQUFRLEtBQUssS0FBSyxNQUFNLE9BQU8sQ0FBQyxNQUFNLEVBQUUsT0FBTyxLQUFLLEVBQUU7QUFDaEUsVUFBTSxLQUFLLEtBQUs7QUFDaEIseUJBQUcsT0FBTyxXQUFXLEtBQUssSUFBSSxJQUFJLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFBQSxFQUN2RDtBQUNGOyIsCiAgIm5hbWVzIjogWyJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X2hlbGVuaXRlIiwgImltcG9ydF9oZWxlbml0ZSIsICJzY29wZSIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X2hlbGVuaXRlIiwgImltcG9ydF9oZWxlbml0ZSIsICJpbXBvcnRfaGVsZW5pdGUiLCAiaW1wb3J0X2hlbGVuaXRlIiwgImltcG9ydF9oZWxlbml0ZSIsICJpbXBvcnRfaGVsZW5pdGUiLCAiaW1wb3J0X2hlbGVuaXRlIl0KfQo=
