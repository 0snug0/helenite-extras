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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL21haW4udHMiLCAiLi4vc3JjL2RhdGEudHMiLCAiLi4vc3JjL3NldHRpbmdzLnRzIiwgIi4uL3NyYy9pdGVtLXBhcnRzLnRzIiwgIi4uL3NyYy92aWV3LnRzIiwgIi4uL3NyYy9wYWdlcy9ib2FyZC50cyIsICIuLi9zcmMvcGFnZXMvY2FyZHMudHMiLCAiLi4vc3JjL3BhZ2VzL2RpYWxvZ3MudHMiLCAiLi4vc3JjL3BhZ2VzL2lucHV0cy50cyIsICIuLi9zcmMvcGFnZXMvaXRlbXMudHMiLCAiLi4vc3JjL3BhZ2VzL3N0YXR1cy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLy8gU2FtcGxlIHBsdWdpbiBmb3IgSGVsZW5pdGUncyBkZXNpZ24gc3lzdGVtIChgaW1wb3J0IHsgdWkgfSBmcm9tICdoZWxlbml0ZSdgKS4gUmVhZCBkb2NzL2Rlc2lnbi1zeXN0ZW0vUkVBRE1FLm1kIGZpcnN0LlxuLy8gSXQgc2hvd3MgZXZlcnkgcGFydCwgYW5kIGl0IGhhcyBubyBzdHlsZXNoZWV0OiB0aGUgcGFydHMgYnJpbmcgdGhlIGxvb2ssIGluIGxpZ2h0IGFuZCBkYXJrLCB3aXRoIGV2ZXJ5IHRoZW1lLlxuLy8gSXQgaXMgbm90IGEgY29yZSBwbHVnaW4gYW5kIGlzIG5vdCBlbmFibGVkIGJ5IGRlZmF1bHQuIEJ1aWxkIGl0IHdpdGggYG5vZGUgc2NyaXB0cy9idWlsZC1wbHVnaW4ubWpzIHNhbXBsZS1kZXNpZ24tc3lzdGVtYC5cbmltcG9ydCB7IFBsdWdpbiB9IGZyb20gJ29ic2lkaWFuJztcbi8vIEltcG9ydGVkIHN0YXRpY2FsbHkgYmVjYXVzZSB0aGlzIHBsdWdpbiBpcyBIZWxlbml0ZS1vbmx5LiBBIHBsdWdpbiB0aGF0IGFsc28gcnVucyBpbiBPYnNpZGlhbiBtdXN0IGd1YXJkIHRoZSByZXF1aXJlXG4vLyAoc2VlIFwiUGx1Z2lucyB0aGF0IHJ1biBpbiBPYnNpZGlhbiB0b29cIiBpbiBkb2NzL2Rlc2lnbi1zeXN0ZW0vUkVBRE1FLm1kKS5cbmltcG9ydCB7IHVpLCB0eXBlIENvdW50QmFkZ2VIYW5kbGUgfSBmcm9tICdoZWxlbml0ZSc7XG5pbXBvcnQgeyBjb3VudCwgcmVhZERhdGEsIHR5cGUgRGF0YSwgdHlwZSBJdGVtLCB0eXBlIEtpbmQsIHR5cGUgU3RhdHVzIH0gZnJvbSAnLi9kYXRhJztcbmltcG9ydCB7IFNhbXBsZVNldHRpbmdUYWIgfSBmcm9tICcuL3NldHRpbmdzJztcbmltcG9ydCB7IFNhbXBsZVZpZXcsIFZJRVdfVFlQRSB9IGZyb20gJy4vdmlldyc7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFNhbXBsZURlc2lnblN5c3RlbVBsdWdpbiBleHRlbmRzIFBsdWdpbiB7XG4gIGRhdGE6IERhdGEgPSByZWFkRGF0YShudWxsKTtcbiAgcHJpdmF0ZSBzdGF0dXM6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgY291bnQ6IENvdW50QmFkZ2VIYW5kbGUgfCBudWxsID0gbnVsbDtcblxuICBhc3luYyBvbmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5kYXRhID0gcmVhZERhdGEoYXdhaXQgdGhpcy5sb2FkRGF0YSgpKTtcbiAgICB0aGlzLnJlZ2lzdGVyVmlldyhWSUVXX1RZUEUsIChsZWFmKSA9PiBuZXcgU2FtcGxlVmlldyhsZWFmLCB0aGlzKSk7XG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBTYW1wbGVTZXR0aW5nVGFiKHRoaXMuYXBwLCB0aGlzKSk7XG4gICAgdGhpcy5hZGRSaWJib25JY29uKCdwbHVzJywgJ0FkZCBpdGVtJywgKCkgPT4gdm9pZCB0aGlzLmFkZEl0ZW0oKSk7XG4gICAgY29uc3QgcmliYm9uID0gdGhpcy5hZGRSaWJib25JY29uKCdjb21wb25lbnQnLCAnU2hvdyBkZXNpZ24tc3lzdGVtIHBhcnRzJywgKCkgPT4gdm9pZCB0aGlzLm9wZW5WaWV3KCkpO1xuICAgIHRoaXMuY291bnQgPSB1aS5jb3VudEJhZGdlKHJpYmJvbiwgMCwgeyBvdmVybGF5OiB0cnVlLCBsYWJlbDogJ29wZW4gaXRlbXMnIH0pO1xuICAgIC8vIFN0YXR1cyB0ZXh0IGluIGEgc3RhdHVzIGJhciBpdGVtIHRha2VzIHRoZSBiYXIncyBzaXplIGJ5IGl0c2VsZi5cbiAgICB0aGlzLnN0YXR1cyA9IHVpLnN0YXR1c1RleHQodGhpcy5hZGRTdGF0dXNCYXJJdGVtKCksICcnKTtcbiAgICB0aGlzLmFkZENvbW1hbmQoeyBpZDogJ3Nob3ctcGFydHMnLCBuYW1lOiAnU2hvdyBkZXNpZ24tc3lzdGVtIHBhcnRzJywgY2FsbGJhY2s6ICgpID0+IHZvaWQgdGhpcy5vcGVuVmlldygpIH0pO1xuICAgIHRoaXMuYWRkQ29tbWFuZCh7IGlkOiAnYWRkLWl0ZW0nLCBuYW1lOiAnQWRkIGl0ZW0nLCBjYWxsYmFjazogKCkgPT4gdm9pZCB0aGlzLmFkZEl0ZW0oKSB9KTtcbiAgICB0aGlzLnNob3dDb3VudHMoKTtcbiAgfVxuXG4gIC8qKiBTYXZlcywgdGhlbiByZWRyYXdzIGV2ZXJ5dGhpbmcgdGhhdCBzaG93cyB0aGUgaXRlbXMuICovXG4gIGFzeW5jIHNhdmUoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGhpcy5zYXZlRGF0YSh0aGlzLmRhdGEpO1xuICAgIHRoaXMuc2hvd0NvdW50cygpO1xuICAgIGZvciAoY29uc3QgbGVhZiBvZiB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFZJRVdfVFlQRSkpIHtcbiAgICAgIGlmIChsZWFmLnZpZXcgaW5zdGFuY2VvZiBTYW1wbGVWaWV3KSBsZWFmLnZpZXcucmVmcmVzaCgpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgc2hvd0NvdW50cygpOiB2b2lkIHtcbiAgICBjb25zdCBvcGVuID0gdGhpcy5kYXRhLml0ZW1zLmZpbHRlcigoaSkgPT4gaS5zdGF0dXMgIT09ICdkb25lJykubGVuZ3RoO1xuICAgIHRoaXMuY291bnQ/LnNldChvcGVuKTtcbiAgICB0aGlzLnN0YXR1cz8uc2V0VGV4dChjb3VudChvcGVuLCAnb3BlbiBpdGVtJykpO1xuICB9XG5cbiAgYXN5bmMgb3BlblZpZXcoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyB3b3Jrc3BhY2UgfSA9IHRoaXMuYXBwO1xuICAgIGxldCBsZWFmID0gd29ya3NwYWNlLmdldExlYXZlc09mVHlwZShWSUVXX1RZUEUpWzBdO1xuICAgIGlmICghbGVhZikge1xuICAgICAgbGVhZiA9IHdvcmtzcGFjZS5nZXRMZWFmKCd0YWInKTtcbiAgICAgIGF3YWl0IGxlYWYuc2V0Vmlld1N0YXRlKHsgdHlwZTogVklFV19UWVBFLCBhY3RpdmU6IHRydWUgfSk7XG4gICAgfVxuICAgIGF3YWl0IHdvcmtzcGFjZS5yZXZlYWxMZWFmKGxlYWYpO1xuICB9XG5cbiAgLyoqIFRoZSByaWJib24gaWNvbjogYSBmb3JtIG1vZGFsLCB0aGVuIGEgbm90aWNlIHRoYXQgZWNob2VzIHRoZSB2YWx1ZXMuICovXG4gIGFzeW5jIGFkZEl0ZW0oKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgdmFsdWVzID0gYXdhaXQgdWkuZm9ybSh0aGlzLmFwcCwge1xuICAgICAgdGl0bGU6ICdBZGQgaXRlbScsXG4gICAgICBhY3Rpb246ICdBZGQnLFxuICAgICAgZmllbGRzOiBbXG4gICAgICAgIHsgaWQ6ICduYW1lJywga2luZDogJ3RleHQnLCBsYWJlbDogJ05hbWUnLCBwbGFjZWhvbGRlcjogJ0l0ZW0gbmFtZScgfSxcbiAgICAgICAgeyBpZDogJ2tpbmQnLCBraW5kOiAnc2VsZWN0JywgbGFiZWw6ICdLaW5kJywgdmFsdWU6ICdub3RlJywgb3B0aW9uczogW3sgdmFsdWU6ICdub3RlJywgbGFiZWw6ICdOb3RlJyB9LCB7IHZhbHVlOiAnbGluaycsIGxhYmVsOiAnTGluaycgfV0gfSxcbiAgICAgICAgeyBpZDogJ3Bpbm5lZCcsIGtpbmQ6ICdjaGVja2JveCcsIGxhYmVsOiAnUGluIGl0JywgZGV0YWlsOiAnTWFya3MgaXQgaW4gdGhlIGxpc3RzJywgdmFsdWU6IGZhbHNlIH0sXG4gICAgICBdLFxuICAgIH0pO1xuICAgIGlmICghdmFsdWVzKSByZXR1cm47XG4gICAgY29uc3QgbmFtZSA9IFN0cmluZyh2YWx1ZXMubmFtZSkudHJpbSgpIHx8ICdVbnRpdGxlZCc7XG4gICAgY29uc3QgcGlubmVkID0gdmFsdWVzLnBpbm5lZCA9PT0gdHJ1ZTtcbiAgICB0aGlzLmRhdGEuaXRlbXMucHVzaCh7IGlkOiBTdHJpbmcoRGF0ZS5ub3coKSksIG5hbWUsIGtpbmQ6IHZhbHVlcy5raW5kIGFzIEtpbmQsIHN0YXR1czogJ3RvZG8nLCBwaW5uZWQgfSk7XG4gICAgYXdhaXQgdGhpcy5zYXZlKCk7XG4gICAgdWkubm90aWNlKGBBZGRlZCAke25hbWV9ICgke3ZhbHVlcy5raW5kfSR7cGlubmVkID8gJywgcGlubmVkJyA6ICcnfSlgLCB7IGtpbmQ6ICdzdWNjZXNzJyB9KTtcbiAgfVxuXG4gIGFzeW5jIG1vdmUoaWQ6IHN0cmluZywgc3RhdHVzOiBTdGF0dXMsIGluZGV4PzogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgaXRlbSA9IHRoaXMuZGF0YS5pdGVtcy5maW5kKChpKSA9PiBpLmlkID09PSBpZCk7XG4gICAgaWYgKCFpdGVtKSByZXR1cm47XG4gICAgY29uc3QgcmVzdCA9IHRoaXMuZGF0YS5pdGVtcy5maWx0ZXIoKGkpID0+IGkgIT09IGl0ZW0pO1xuICAgIGl0ZW0uc3RhdHVzID0gc3RhdHVzO1xuICAgIC8vIGBpbmRleGAgaXMgdGhlIHBsYWNlIGFtb25nIHRoZSBsYW5lJ3Mgb3RoZXIgaXRlbXM7IHdpdGhvdXQgb25lIHRoZSBpdGVtIGdvZXMgbGFzdC5cbiAgICBjb25zdCBiZWZvcmUgPSBpbmRleCA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkIDogcmVzdC5maWx0ZXIoKGkpID0+IGkuc3RhdHVzID09PSBzdGF0dXMpW2luZGV4XTtcbiAgICByZXN0LnNwbGljZShiZWZvcmUgPyByZXN0LmluZGV4T2YoYmVmb3JlKSA6IHJlc3QubGVuZ3RoLCAwLCBpdGVtKTtcbiAgICB0aGlzLmRhdGEuaXRlbXMgPSByZXN0O1xuICAgIGF3YWl0IHRoaXMuc2F2ZSgpO1xuICB9XG5cbiAgYXN5bmMgcmVuYW1lKGl0ZW06IEl0ZW0pOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBuYW1lID0gYXdhaXQgdWkucHJvbXB0KHRoaXMuYXBwLCB7XG4gICAgICB0aXRsZTogJ1JlbmFtZSBpdGVtJywgbGFiZWw6ICdOYW1lJywgdmFsdWU6IGl0ZW0ubmFtZSwgYWN0aW9uOiAnUmVuYW1lJyxcbiAgICAgIHZhbGlkYXRlOiAodikgPT4gKHYudHJpbSgpID8gbnVsbCA6ICdFbnRlciBhIG5hbWUuJyksXG4gICAgfSk7XG4gICAgaWYgKG5hbWUgPT09IG51bGwpIHJldHVybjtcbiAgICBpdGVtLm5hbWUgPSBuYW1lLnRyaW0oKTtcbiAgICBhd2FpdCB0aGlzLnNhdmUoKTtcbiAgfVxuXG4gIGFzeW5jIHJlbW92ZShpdGVtOiBJdGVtKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5kYXRhLml0ZW1zID0gdGhpcy5kYXRhLml0ZW1zLmZpbHRlcigoaSkgPT4gaS5pZCAhPT0gaXRlbS5pZCk7XG4gICAgYXdhaXQgdGhpcy5zYXZlKCk7XG4gICAgdWkubm90aWNlKGBEZWxldGVkICR7aXRlbS5uYW1lfWAsIHsga2luZDogJ3N1Y2Nlc3MnIH0pO1xuICB9XG59XG4iLCAiLy8gVGhlIHBsdWdpbidzIHNhdmVkIGRhdGEuIFRoZSBzYW1wbGUga2VlcHMgYSBzbWFsbCBsaXN0IG9mIGl0ZW1zIHNvIGV2ZXJ5IHBhcnQgaGFzIHNvbWV0aGluZyByZWFsIHRvIHNob3cuXG5pbXBvcnQgdHlwZSB7IFZhdWx0U2NvcGUgfSBmcm9tICdoZWxlbml0ZSc7XG5cbmV4cG9ydCB0eXBlIFN0YXR1cyA9ICd0b2RvJyB8ICdkb2luZycgfCAnZG9uZSc7XG5leHBvcnQgdHlwZSBLaW5kID0gJ25vdGUnIHwgJ2xpbmsnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEl0ZW0ge1xuICBpZDogc3RyaW5nO1xuICBuYW1lOiBzdHJpbmc7XG4gIGtpbmQ6IEtpbmQ7XG4gIHN0YXR1czogU3RhdHVzO1xuICBwaW5uZWQ6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRGF0YSB7XG4gIGl0ZW1zOiBJdGVtW107XG4gIGRlbnNpdHk6ICdjb21wYWN0JyB8ICdkZXRhaWxlZCc7XG4gIHNjb3BlOiBWYXVsdFNjb3BlO1xufVxuXG5leHBvcnQgY29uc3QgU1RBVFVTRVM6IHsgaWQ6IFN0YXR1czsgdGV4dDogc3RyaW5nOyB0b25lOiAnZGVmYXVsdCcgfCAnYWNjZW50JyB8ICdzdWNjZXNzJyB9W10gPSBbXG4gIHsgaWQ6ICd0b2RvJywgdGV4dDogJ1RvIGRvJywgdG9uZTogJ2RlZmF1bHQnIH0sXG4gIHsgaWQ6ICdkb2luZycsIHRleHQ6ICdEb2luZycsIHRvbmU6ICdhY2NlbnQnIH0sXG4gIHsgaWQ6ICdkb25lJywgdGV4dDogJ0RvbmUnLCB0b25lOiAnc3VjY2VzcycgfSxcbl07XG5cbi8qKiBcIjEgaXRlbVwiLCBcIjIgaXRlbXNcIi4gKi9cbmV4cG9ydCBjb25zdCBjb3VudCA9IChuOiBudW1iZXIsIG5vdW46IHN0cmluZykgPT4gYCR7bn0gJHtub3VufSR7biA9PT0gMSA/ICcnIDogJ3MnfWA7XG5cbmV4cG9ydCBjb25zdCBzdGF0dXNPZiA9IChpdGVtOiBJdGVtKSA9PiBTVEFUVVNFUy5maW5kKChzKSA9PiBzLmlkID09PSBpdGVtLnN0YXR1cykgPz8gU1RBVFVTRVNbMF07XG5cbmNvbnN0IFNFRUQ6IEl0ZW1bXSA9IFtcbiAgeyBpZDogJzEnLCBuYW1lOiAnUmVhZGluZyBsaXN0Jywga2luZDogJ25vdGUnLCBzdGF0dXM6ICdkb2luZycsIHBpbm5lZDogdHJ1ZSB9LFxuICB7IGlkOiAnMicsIG5hbWU6ICdEZXNpZ24gcmVmZXJlbmNlcycsIGtpbmQ6ICdsaW5rJywgc3RhdHVzOiAndG9kbycsIHBpbm5lZDogZmFsc2UgfSxcbiAgeyBpZDogJzMnLCBuYW1lOiAnV2Vla2x5IHJldmlldycsIGtpbmQ6ICdub3RlJywgc3RhdHVzOiAndG9kbycsIHBpbm5lZDogZmFsc2UgfSxcbiAgeyBpZDogJzQnLCBuYW1lOiAnUmVsZWFzZSBjaGVja2xpc3QnLCBraW5kOiAnbm90ZScsIHN0YXR1czogJ2RvbmUnLCBwaW5uZWQ6IGZhbHNlIH0sXG5dO1xuXG4vKiogRmlsbHMgaW4gd2hhdCBzYXZlZCBkYXRhIGxhY2tzIChhbiBpdGVtIHNhdmVkIGJlZm9yZSBpdCBoYWQgYSBzdGF0dXMpLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlYWREYXRhKHNhdmVkOiB1bmtub3duKTogRGF0YSB7XG4gIGNvbnN0IHMgPSAoc2F2ZWQgPz8ge30pIGFzIFBhcnRpYWw8RGF0YT47XG4gIGNvbnN0IGl0ZW1zID0gcy5pdGVtcyA/PyBTRUVEO1xuICByZXR1cm4ge1xuICAgIGl0ZW1zOiBpdGVtcy5tYXAoKGkpID0+ICh7IC4uLmksIHN0YXR1czogaS5zdGF0dXMgPz8gJ3RvZG8nLCBwaW5uZWQ6IGkucGlubmVkID8/IGZhbHNlIH0pKSxcbiAgICBkZW5zaXR5OiBzLmRlbnNpdHkgPz8gJ2RldGFpbGVkJyxcbiAgICBzY29wZTogcy5zY29wZSA/PyAnYWxsJyxcbiAgfTtcbn1cbiIsICIvLyBUaGUgc2V0dGluZ3MgdGFiOiBldmVyeSBgdWkuc2V0dGluZ3NgIHBhcnQuXG5pbXBvcnQgeyBQbHVnaW5TZXR0aW5nVGFiLCB0eXBlIEFwcCB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IHVpIH0gZnJvbSAnaGVsZW5pdGUnO1xuaW1wb3J0IHsgY291bnQgfSBmcm9tICcuL2RhdGEnO1xuaW1wb3J0IHsgaXRlbVRhYmxlIH0gZnJvbSAnLi9pdGVtLXBhcnRzJztcbmltcG9ydCB0eXBlIFNhbXBsZURlc2lnblN5c3RlbVBsdWdpbiBmcm9tICcuL21haW4nO1xuXG5leHBvcnQgY2xhc3MgU2FtcGxlU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcHJpdmF0ZSBwbHVnaW46IFNhbXBsZURlc2lnblN5c3RlbVBsdWdpbikge1xuICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcbiAgfVxuXG4gIGRpc3BsYXkoKTogdm9pZCB7XG4gICAgY29uc3QgeyBwbHVnaW4gfSA9IHRoaXM7XG4gICAgY29uc3QgZWwgPSB0aGlzLmNvbnRhaW5lckVsO1xuICAgIGVsLmVtcHR5KCk7XG4gICAgY29uc3QgaXRlbXMgPSB1aS5zZXR0aW5ncy5zZWN0aW9uKGVsLCAnSXRlbXMnKTtcbiAgICBjb25zdCBtYW5hZ2UgPSB1aS5zZXR0aW5ncy5zdWJwYWdlUm93KHRoaXMuYXBwLCBpdGVtcywge1xuICAgICAgbmFtZTogJ01hbmFnZSBpdGVtcycsXG4gICAgICBkZXNjOiBjb3VudChwbHVnaW4uZGF0YS5pdGVtcy5sZW5ndGgsICdpdGVtJyksXG4gICAgICB0aXRsZTogJ0l0ZW1zJyxcbiAgICAgIC8vIFRoZSB0YWIgc3RheXMgZHJhd24gdW5kZXIgdGhlIHN1Yi1wYWdlLCBzbyBhIGNoYW5nZSB0aGVyZSB1cGRhdGVzIHRoaXMgcm93IHRvby5cbiAgICAgIHJlbmRlcjogKHBhZ2UpID0+IHRoaXMucmVuZGVySXRlbXMocGFnZSwgKCkgPT4gbWFuYWdlLnNldERlc2MoY291bnQocGx1Z2luLmRhdGEuaXRlbXMubGVuZ3RoLCAnaXRlbScpKSksXG4gICAgfSk7XG4gICAgdWkuc2V0dGluZ3Muc3VtbWFyeVJvdyhpdGVtcywge1xuICAgICAgbmFtZTogJ0Fib3V0IHRoaXMgc2FtcGxlJywgZGVzYzogJ1doZXJlIHRvIHNlZSBldmVyeSBwYXJ0LicsIGNoZXZyb246IHRydWUsXG4gICAgICBvbkNsaWNrOiAoKSA9PiB1aS5zZXR0aW5ncy5vcGVuU3VicGFnZSh0aGlzLmFwcCwgJ0Fib3V0IHRoaXMgc2FtcGxlJywgKHBhZ2UpID0+IHtcbiAgICAgICAgdWkuY2FsbG91dChwYWdlLCB7IHRvbmU6ICdpbmZvJywgdGV4dDogJ1RoZSBjb21wb25lbnQgcmliYm9uIGljb24sIG9yIHRoZSBjb21tYW5kIFx1MjAxQ1Nob3cgZGVzaWduLXN5c3RlbSBwYXJ0c1x1MjAxRCwgb3BlbnMgYSB0YWIgd2l0aCBldmVyeSBwYXJ0LicgfSk7XG4gICAgICB9KSxcbiAgICB9KTtcbiAgICBuZXcgdWkuc2V0dGluZ3Mucm93KGl0ZW1zKVxuICAgICAgLnNldE5hbWUoJ1R3by1saW5lIHJvd3MnKVxuICAgICAgLnNldERlc2MoJ1Nob3cgZGV0YWlscyB1bmRlciBlYWNoIGl0ZW0uJylcbiAgICAgIC5hZGRUb2dnbGUoKHQpID0+IHQuc2V0VmFsdWUocGx1Z2luLmRhdGEuZGVuc2l0eSA9PT0gJ2RldGFpbGVkJykub25DaGFuZ2UoKG9uKSA9PiB7XG4gICAgICAgIHBsdWdpbi5kYXRhLmRlbnNpdHkgPSBvbiA/ICdkZXRhaWxlZCcgOiAnY29tcGFjdCc7XG4gICAgICAgIHZvaWQgcGx1Z2luLnNhdmUoKTtcbiAgICAgIH0pKTtcbiAgICBuZXcgdWkuc2V0dGluZ3Mucm93KGl0ZW1zKVxuICAgICAgLnNldE5hbWUoJ1N5bmMnKVxuICAgICAgLnNldERlc2MoJ05vdCBhdmFpbGFibGUgaW4gdGhpcyBzYW1wbGUuJylcbiAgICAgIC5hZGREcm9wZG93bigoZCkgPT4gZC5hZGRPcHRpb24oJ29mZicsICdPZmYnKSlcbiAgICAgIC5zZXREaXNhYmxlZCh0cnVlKTtcblxuICAgIGNvbnN0IGFjY2VzcyA9IHVpLnNldHRpbmdzLnNlY3Rpb24oZWwsICdBY2Nlc3MnLCB7IGRlc2M6ICdEZW1vIHZhbHVlczogbm90aGluZyBpcyBzaGFyZWQuJyB9KTtcbiAgICBjb25zdCBjYXJkID0gdWkuc2V0dGluZ3MuY2FyZChhY2Nlc3MsIHsgbmFtZTogJ0l0ZW0gc3luYycsIGRlc2M6ICdzYW1wbGUnLCBpY29uOiAncmVmcmVzaC1jdycsIHN0YXR1czogeyB0ZXh0OiAnTm90IGNvbm5lY3RlZCcsIHRvbmU6ICd3YXJuaW5nJyB9IH0pO1xuICAgIHVpLmFjdGlvbihjYXJkLmhlYWQuY29udHJvbEVsLCAncmVjb25uZWN0JywgeyBvbkNsaWNrOiAoKSA9PiBjYXJkLnNldFN0YXR1cyh7IHRleHQ6ICdDb25uZWN0ZWQnLCB0b25lOiAnc3VjY2VzcycgfSkgfSk7XG4gICAgdWkuc2V0dGluZ3MudmF1bHRTY29wZShjYXJkLmJvZHksIHtcbiAgICAgIHZhbHVlOiBwbHVnaW4uZGF0YS5zY29wZSxcbiAgICAgIHZhdWx0czogW3sgaWQ6ICd3b3JrJywgbmFtZTogJ1dvcmsnIH0sIHsgaWQ6ICdub3RlcycsIG5hbWU6ICdOb3RlcycgfSwgeyBpZDogJ29sZCcsIG5hbWU6ICdBcmNoaXZlJywgZGlzYWJsZWQ6ICdDbG9zZWQgdmF1bHQnIH1dLFxuICAgICAgaG9tZU5vdGU6IHRydWUsXG4gICAgICBjb25maXJtQWxsOiAoKSA9PiB1aS5jb25maXJtKHRoaXMuYXBwLCB7IHRpdGxlOiAnQWxsb3cgYWxsIHZhdWx0cycsIG1lc3NhZ2U6ICdMZXQgZXZlcnkgdmF1bHQgdXNlIGl0ZW0gc3luYz8nLCBhY3Rpb246ICdBbGxvdyBhbGwnIH0pLFxuICAgICAgb25DaGFuZ2U6IChzY29wZSkgPT4ge1xuICAgICAgICBwbHVnaW4uZGF0YS5zY29wZSA9IHNjb3BlO1xuICAgICAgICB2b2lkIHBsdWdpbi5zYXZlKCk7XG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gSGVsZW5pdGUgZHJhd3MgdGhpcyBiYXIgYWJvdmUgYSBIb21lIHBsdWdpbidzIHBhZ2UgYnkgaXRzZWxmLCBzbyBhIHBsdWdpbiByYXJlbHkgbmVlZHMgdG8uIFRoaXMgb25lIGlzIGEgZGVtby5cbiAgICBjb25zdCBzY29wZSA9IHVpLnNldHRpbmdzLnNlY3Rpb24oZWwsICdTY29wZSBiYXInLCB7IGRlc2M6ICdGb3IgYSBwYWdlIHRoYXQgZWRpdHMgYm90aCBIb21lIGFuZCB0aGUgVmF1bHQgRGVmYXVsdHMuJyB9KTtcbiAgICB1aS5zZXR0aW5ncy5zY29wZUJhcihzY29wZSwgeyBlZGl0aW5nRGVmYXVsdHM6IGZhbHNlLCBvbkNoYW5nZTogKCkgPT4ge30gfSk7XG4gIH1cblxuICBwcml2YXRlIHJlbmRlckl0ZW1zKHBhZ2U6IEhUTUxFbGVtZW50LCBvbkNoYW5nZTogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIC8vIE5vdGhpbmcgZWxzZSByZWRyYXdzIHRoZSB0YWJsZTogYWZ0ZXIgYSBkZWxldGUgaXQgdGFrZXMgdGhlIG5ldyByb3dzLCBhbmQgdGhlIHN1Yi1wYWdlIHN0YXlzIG9wZW4uXG4gICAgY29uc3QgdGFibGUgPSBpdGVtVGFibGUocGFnZSwgdGhpcy5wbHVnaW4sIHRoaXMucGx1Z2luLmRhdGEuaXRlbXMsICgpID0+IHtcbiAgICAgIHRhYmxlLnNldFJvd3ModGhpcy5wbHVnaW4uZGF0YS5pdGVtcyk7XG4gICAgICBvbkNoYW5nZSgpO1xuICAgIH0pO1xuICB9XG59XG4iLCAiLy8gV2hhdCBtb3JlIHRoYW4gb25lIHBhZ2UgZHJhd3MgZm9yIGFuIGl0ZW06IGl0cyB0YWJsZSwgaXRzIG1lbnUgYW5kIGl0cyBkZXRhaWxzIGRpYWxvZy5cbmltcG9ydCB7IHVpLCB0eXBlIE1lbnVJdGVtU3BlYyB9IGZyb20gJ2hlbGVuaXRlJztcbmltcG9ydCB7IFNUQVRVU0VTLCBzdGF0dXNPZiwgdHlwZSBJdGVtIH0gZnJvbSAnLi9kYXRhJztcbmltcG9ydCB0eXBlIFNhbXBsZURlc2lnblN5c3RlbVBsdWdpbiBmcm9tICcuL21haW4nO1xuXG4vKiogYG9uUmVtb3ZlZGAgcnVucyBhZnRlciBhIGRlbGV0ZSwgZm9yIGEgdGFibGUgdGhhdCBub3RoaW5nIGVsc2UgcmVkcmF3cy4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpdGVtVGFibGUoZWw6IEhUTUxFbGVtZW50LCBwbHVnaW46IFNhbXBsZURlc2lnblN5c3RlbVBsdWdpbiwgcm93czogSXRlbVtdLCBvblJlbW92ZWQ/OiAoKSA9PiB2b2lkKSB7XG4gIHJldHVybiB1aS50YWJsZTxJdGVtPihlbCwge1xuICAgIGNvbHVtbnM6IFtcbiAgICAgIHsga2V5OiAnbmFtZScsIHRpdGxlOiAnTmFtZScsIGNlbGw6IChyKSA9PiByLm5hbWUgfSxcbiAgICAgIHsga2V5OiAna2luZCcsIHRpdGxlOiAnS2luZCcsIGZpdDogdHJ1ZSwgY2VsbDogKHIsIHRkKSA9PiB2b2lkIHVpLmJhZGdlKHRkLCByLmtpbmQpIH0sXG4gICAgICB7IGtleTogJ3N0YXR1cycsIHRpdGxlOiAnU3RhdHVzJywgZml0OiB0cnVlLCBjZWxsOiAociwgdGQpID0+IHZvaWQgdWkuc3RhdHVzVGV4dCh0ZCwgc3RhdHVzT2YocikudGV4dCwgc3RhdHVzT2YocikudG9uZSkgfSxcbiAgICBdLFxuICAgIHJvd3MsXG4gICAgZW1wdHk6ICdObyBpdGVtcyB5ZXQuJyxcbiAgICAvLyBgZGVsZXRlYCBhc2tzIGJlZm9yZSBpdCBydW5zLCBuYW1pbmcgdGhlIGl0ZW0uXG4gICAgYWN0aW9uczogKHIsIGNlbGwpID0+IHZvaWQgdWkuYWN0aW9uKGNlbGwsICdkZWxldGUnLCB7XG4gICAgICBhcHA6IHBsdWdpbi5hcHAsIHN1YmplY3Q6IHIubmFtZSxcbiAgICAgIG9uQ2xpY2s6IGFzeW5jICgpID0+IHtcbiAgICAgICAgYXdhaXQgcGx1Z2luLnJlbW92ZShyKTtcbiAgICAgICAgb25SZW1vdmVkPy4oKTtcbiAgICAgIH0sXG4gICAgfSksXG4gIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXRlbU1lbnUocGx1Z2luOiBTYW1wbGVEZXNpZ25TeXN0ZW1QbHVnaW4sIGl0ZW06IEl0ZW0pOiBNZW51SXRlbVNwZWNbXSB7XG4gIHJldHVybiBbXG4gICAgeyB0aXRsZTogJ09wZW4nLCBpY29uOiAncGFuZWwtcmlnaHQtb3BlbicsIG9uQ2xpY2s6ICgpID0+IHZvaWQgb3Blbkl0ZW0ocGx1Z2luLCBpdGVtKSB9LFxuICAgIHsgdGl0bGU6ICdSZW5hbWUnLCBpY29uOiAncGVuY2lsJywgb25DbGljazogKCkgPT4gdm9pZCBwbHVnaW4ucmVuYW1lKGl0ZW0pIH0sXG4gICAgJ3NlcGFyYXRvcicsXG4gICAgLi4uU1RBVFVTRVMubWFwKChzKSA9PiAoeyB0aXRsZTogcy50ZXh0LCBjaGVja2VkOiBpdGVtLnN0YXR1cyA9PT0gcy5pZCwgb25DbGljazogKCkgPT4gdm9pZCBwbHVnaW4ubW92ZShpdGVtLmlkLCBzLmlkKSB9KSksXG4gICAgJ3NlcGFyYXRvcicsXG4gICAge1xuICAgICAgdGl0bGU6ICdEZWxldGUnLCBpY29uOiAndHJhc2gtMicsIGRhbmdlcjogdHJ1ZSxcbiAgICAgIG9uQ2xpY2s6ICgpID0+IHZvaWQgdWkuY29uZmlybShwbHVnaW4uYXBwLCB7XG4gICAgICAgIHRpdGxlOiBgRGVsZXRlICR7aXRlbS5uYW1lfWAsIG1lc3NhZ2U6IGBEZWxldGUgJHtpdGVtLm5hbWV9PyBUaGlzIGNhbm5vdCBiZSB1bmRvbmUuYCwgYWN0aW9uOiAnRGVsZXRlJywgZGFuZ2VyOiB0cnVlLFxuICAgICAgICBvbkNvbmZpcm06ICgpID0+IHBsdWdpbi5yZW1vdmUoaXRlbSksXG4gICAgICB9KSxcbiAgICB9LFxuICBdO1xufVxuXG4vKiogQSBkaWFsb2cgd2l0aCB0aGUgY29udGVudCBvbiB0aGUgbGVmdCBhbmQgaXRzIHByb3BlcnRpZXMgb24gdGhlIHJpZ2h0LiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG9wZW5JdGVtKHBsdWdpbjogU2FtcGxlRGVzaWduU3lzdGVtUGx1Z2luLCBpdGVtOiBJdGVtKTogUHJvbWlzZTx1bmtub3duPiB7XG4gIGxldCBuYW1lID0gaXRlbS5uYW1lO1xuICByZXR1cm4gdWkuZGlhbG9nKHBsdWdpbi5hcHAsIHtcbiAgICB0aXRsZTogJ0VkaXQgaXRlbScsXG4gICAgd2lkdGg6ICd3aWRlJyxcbiAgICByZW5kZXI6IChib2R5LCBjdHgpID0+IHtcbiAgICAgIGNvbnN0IHsgbWFpbiwgc2lkZSB9ID0gY3R4LnNpZGVQYW5lbCgpO1xuICAgICAgdWkudGV4dElucHV0KHVpLmZpZWxkKG1haW4sIHsgbGFiZWw6ICdOYW1lJywgZmlsbDogdHJ1ZSB9KS5jb250cm9sLCB7IHZhbHVlOiBuYW1lLCBvbklucHV0OiAodikgPT4gKG5hbWUgPSB2KSB9KTtcbiAgICAgIHVpLmtleVZhbHVlKHNpZGUsIFtcbiAgICAgICAgeyBrZXk6ICdLaW5kJywgdmFsdWU6IGl0ZW0ua2luZCB9LFxuICAgICAgICB7IGtleTogJ1N0YXR1cycsIHZhbHVlOiBzdGF0dXNPZihpdGVtKS50ZXh0IH0sXG4gICAgICAgIHsga2V5OiAnUGlubmVkJywgdmFsdWU6IGl0ZW0ucGlubmVkID8gJ1llcycgOiAnTm8nIH0sXG4gICAgICBdKTtcbiAgICB9LFxuICAgIGFjdGlvbnM6IFt7XG4gICAgICB0ZXh0OiAnU2F2ZScsIHZhcmlhbnQ6ICdwcmltYXJ5Jywgb25DbGljazogYXN5bmMgKGN0eCkgPT4ge1xuICAgICAgICBpZiAoIW5hbWUudHJpbSgpKSB0aHJvdyBuZXcgRXJyb3IoJ0VudGVyIGEgbmFtZS4nKTtcbiAgICAgICAgaXRlbS5uYW1lID0gbmFtZS50cmltKCk7XG4gICAgICAgIGF3YWl0IHBsdWdpbi5zYXZlKCk7XG4gICAgICAgIGN0eC5jbG9zZShudWxsKTtcbiAgICAgIH0sXG4gICAgfV0sXG4gIH0pO1xufVxuIiwgIi8vIFRoZSBcIkRlc2lnbi1zeXN0ZW0gcGFydHNcIiB0YWI6IGEgcGFuZSBoZWFkZXIsIHRhYnMsIGFuZCBvbmUgcGFnZSBwZXIgdGFiLlxuaW1wb3J0IHsgSXRlbVZpZXcsIHR5cGUgV29ya3NwYWNlTGVhZiB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IHVpLCB0eXBlIFRhYnNIYW5kbGUgfSBmcm9tICdoZWxlbml0ZSc7XG5pbXBvcnQgdHlwZSBTYW1wbGVEZXNpZ25TeXN0ZW1QbHVnaW4gZnJvbSAnLi9tYWluJztcbmltcG9ydCB7IGRyYXdCb2FyZCB9IGZyb20gJy4vcGFnZXMvYm9hcmQnO1xuaW1wb3J0IHsgZHJhd0NhcmRzIH0gZnJvbSAnLi9wYWdlcy9jYXJkcyc7XG5pbXBvcnQgeyBkcmF3RGlhbG9ncyB9IGZyb20gJy4vcGFnZXMvZGlhbG9ncyc7XG5pbXBvcnQgeyBkcmF3SW5wdXRzIH0gZnJvbSAnLi9wYWdlcy9pbnB1dHMnO1xuaW1wb3J0IHsgZHJhd0l0ZW1zLCB0eXBlIEl0ZW1GaWx0ZXIgfSBmcm9tICcuL3BhZ2VzL2l0ZW1zJztcbmltcG9ydCB7IGRyYXdTdGF0dXMgfSBmcm9tICcuL3BhZ2VzL3N0YXR1cyc7XG5cbmV4cG9ydCBjb25zdCBWSUVXX1RZUEUgPSAnc2FtcGxlLWRlc2lnbi1zeXN0ZW0nO1xuXG5leHBvcnQgY29uc3QgUEFHRVMgPSBbXG4gIHsgaWQ6ICdpdGVtcycsIHRleHQ6ICdJdGVtcycgfSxcbiAgeyBpZDogJ2JvYXJkJywgdGV4dDogJ0JvYXJkJyB9LFxuICB7IGlkOiAnaW5wdXRzJywgdGV4dDogJ0lucHV0cycgfSxcbiAgeyBpZDogJ3N0YXR1cycsIHRleHQ6ICdTdGF0dXMnIH0sXG4gIHsgaWQ6ICdjYXJkcycsIHRleHQ6ICdDYXJkcycgfSxcbiAgeyBpZDogJ2RpYWxvZ3MnLCB0ZXh0OiAnRGlhbG9ncycgfSxcbl0gYXMgY29uc3Q7XG5cbmV4cG9ydCB0eXBlIFBhZ2VJZCA9ICh0eXBlb2YgUEFHRVMpW251bWJlcl1bJ2lkJ107XG5cbmV4cG9ydCBjbGFzcyBTYW1wbGVWaWV3IGV4dGVuZHMgSXRlbVZpZXcge1xuICBwYWdlOiBQYWdlSWQgPSAnaXRlbXMnO1xuICBwcml2YXRlIHRhYnM6IFRhYnNIYW5kbGU8UGFnZUlkPiB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIGhlYWRlcjogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBkcmFnZ2luZyA9IGZhbHNlO1xuICBwcml2YXRlIHN0YWxlID0gZmFsc2U7XG4gIC8qKiBLZXB0IGhlcmUgc28gYSByZWRyYXcgYWZ0ZXIgYSBzYXZlIGRvZXMgbm90IGxvc2UgdGhlIHNlYXJjaCBvciB0aGUgbGF5b3V0LiAqL1xuICBwcml2YXRlIGZpbHRlcjogSXRlbUZpbHRlciA9IHsgcXVlcnk6ICcnLCBraW5kOiAnYWxsJywgbGF5b3V0OiAnbGlzdCcgfTtcblxuICBjb25zdHJ1Y3RvcihsZWFmOiBXb3Jrc3BhY2VMZWFmLCBwcml2YXRlIHBsdWdpbjogU2FtcGxlRGVzaWduU3lzdGVtUGx1Z2luKSB7XG4gICAgc3VwZXIobGVhZik7XG4gIH1cblxuICBnZXRWaWV3VHlwZSgpOiBzdHJpbmcge1xuICAgIHJldHVybiBWSUVXX1RZUEU7XG4gIH1cblxuICBnZXREaXNwbGF5VGV4dCgpOiBzdHJpbmcge1xuICAgIHJldHVybiAnRGVzaWduLXN5c3RlbSBwYXJ0cyc7XG4gIH1cblxuICBnZXRJY29uKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuICdjb21wb25lbnQnO1xuICB9XG5cbiAgYXN5bmMgb25PcGVuKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuY29udGVudEVsLmVtcHR5KCk7XG4gICAgdGhpcy50YWJzID0gdWkudGFiczxQYWdlSWQ+KHRoaXMuY29udGVudEVsLCB7XG4gICAgICB0YWJzOiBQQUdFUy5tYXAoKHApID0+ICh7IC4uLnAgfSkpLFxuICAgICAgdmFsdWU6IHRoaXMucGFnZSxcbiAgICAgIG9uU2VsZWN0OiAoaWQpID0+IHtcbiAgICAgICAgdGhpcy5wYWdlID0gaWQ7XG4gICAgICAgIHRoaXMuZHJhd1BhZ2UoKTtcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgdGhpcy5yZWZyZXNoKCk7XG4gIH1cblxuICAvKiogUmVkcmF3cyB3aGF0IHNob3dzIHRoZSBwbHVnaW4ncyBkYXRhLCBhZnRlciBhIGRyYWcgaWYgb25lIGlzIHVuZGVyIHdheS4gVGhlIElucHV0cyBwYWdlIGhvbGRzIHdoYXQgdGhlIHVzZXIgdHlwZWQsIHNvIGl0IGlzIGxlZnQgYWxvbmUuICovXG4gIHJlZnJlc2goKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuZHJhZ2dpbmcpIHtcbiAgICAgIHRoaXMuc3RhbGUgPSB0cnVlO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLmRyYXdIZWFkZXIoKTtcbiAgICB0aGlzLnRhYnM/LnNldEJhZGdlKCdpdGVtcycsIHRoaXMucGx1Z2luLmRhdGEuaXRlbXMubGVuZ3RoKTtcbiAgICAvLyBSaWdodCBhZnRlciBvcGVuaW5nIHRoZXJlIGlzIG5vIHBhZ2UgeWV0LlxuICAgIGlmICh0aGlzLnBhZ2UgIT09ICdpbnB1dHMnIHx8ICF0aGlzLnRhYnM/LmVsLm5leHRFbGVtZW50U2libGluZykgdGhpcy5kcmF3UGFnZSgpO1xuICB9XG5cbiAgcHJpdmF0ZSBob2xkKGRyYWdnaW5nOiBib29sZWFuKTogdm9pZCB7XG4gICAgdGhpcy5kcmFnZ2luZyA9IGRyYWdnaW5nO1xuICAgIGlmIChkcmFnZ2luZyB8fCAhdGhpcy5zdGFsZSkgcmV0dXJuO1xuICAgIHRoaXMuc3RhbGUgPSBmYWxzZTtcbiAgICB0aGlzLnJlZnJlc2goKTtcbiAgfVxuXG4gIHByaXZhdGUgZHJhd0hlYWRlcigpOiB2b2lkIHtcbiAgICB0aGlzLmhlYWRlcj8ucmVtb3ZlKCk7XG4gICAgdGhpcy5oZWFkZXIgPSB1aS5wYW5lSGVhZGVyKHRoaXMuY29udGVudEVsLCBbXG4gICAgICB7IGljb246ICdwbHVzJywgbGFiZWw6ICdBZGQgaXRlbScsIGlkOiAnYWRkJywgb25DbGljazogKCkgPT4gdm9pZCB0aGlzLnBsdWdpbi5hZGRJdGVtKCkgfSxcbiAgICAgIC8vIE9uZSBsaW5lIG9yIHR3byBwZXIgcm93LiBUaGUgaGVhZGVyIGlzIHJlYnVpbHQgb24gYSBjaGFuZ2UsIHNvIHRoZSBpY29uIGZvbGxvd3MuXG4gICAgICB1aS5kZW5zaXR5QWN0aW9uKHRoaXMucGx1Z2luLmRhdGEuZGVuc2l0eSwgKGRlbnNpdHkpID0+IHtcbiAgICAgICAgdGhpcy5wbHVnaW4uZGF0YS5kZW5zaXR5ID0gZGVuc2l0eTtcbiAgICAgICAgdm9pZCB0aGlzLnBsdWdpbi5zYXZlKCk7XG4gICAgICB9KSxcbiAgICBdKTtcbiAgfVxuXG4gIHByaXZhdGUgZHJhd1BhZ2UoKTogdm9pZCB7XG4gICAgY29uc3QgZWwgPSB0aGlzLmNvbnRlbnRFbDtcbiAgICB3aGlsZSAodGhpcy50YWJzPy5lbC5uZXh0U2libGluZykgdGhpcy50YWJzLmVsLm5leHRTaWJsaW5nLnJlbW92ZSgpO1xuICAgIC8vIEEgYm9hcmQgZmlsbHMgaXRzIHBhbmU6IHRoZSBjbGFzcyBnb2VzIG9uIHRoZSBib2FyZCdzIGNvbnRhaW5lciwgYW5kIHRoZSBib2FyZCBpcyBkcmF3biBzdHJhaWdodCBpbnRvIGl0LlxuICAgIGVsLnRvZ2dsZUNsYXNzKCdoZWwtYm9hcmQtcGFnZScsIHRoaXMucGFnZSA9PT0gJ2JvYXJkJyk7XG4gICAgaWYgKHRoaXMucGFnZSA9PT0gJ2JvYXJkJykgcmV0dXJuIGRyYXdCb2FyZChlbCwgdGhpcy5wbHVnaW4sIChkcmFnZ2luZykgPT4gdGhpcy5ob2xkKGRyYWdnaW5nKSk7XG4gICAgY29uc3QgcGFnZSA9IGVsLmNyZWF0ZURpdigpO1xuICAgIGlmICh0aGlzLnBhZ2UgPT09ICdpdGVtcycpIGRyYXdJdGVtcyhwYWdlLCB0aGlzLnBsdWdpbiwgdGhpcy5maWx0ZXIpO1xuICAgIGVsc2UgaWYgKHRoaXMucGFnZSA9PT0gJ2lucHV0cycpIGRyYXdJbnB1dHMocGFnZSk7XG4gICAgZWxzZSBpZiAodGhpcy5wYWdlID09PSAnc3RhdHVzJykgZHJhd1N0YXR1cyhwYWdlKTtcbiAgICBlbHNlIGlmICh0aGlzLnBhZ2UgPT09ICdjYXJkcycpIGRyYXdDYXJkcyhwYWdlKTtcbiAgICBlbHNlIGRyYXdEaWFsb2dzKHBhZ2UsIHRoaXMucGx1Z2luKTtcbiAgfVxufVxuIiwgIi8vIFRoZSBpdGVtcyBhcyBhIGJvYXJkOiBkcmFnIGEgY2FyZCBiZXR3ZWVuIGxhbmVzLCBvciB1c2UgaXRzIG1lbnUgKGRyYWdnaW5nIGhhcyBubyBrZXlib2FyZCBlcXVpdmFsZW50KS5cbmltcG9ydCB7IHVpIH0gZnJvbSAnaGVsZW5pdGUnO1xuaW1wb3J0IHsgU1RBVFVTRVMgfSBmcm9tICcuLi9kYXRhJztcbmltcG9ydCB7IGl0ZW1NZW51LCBvcGVuSXRlbSB9IGZyb20gJy4uL2l0ZW0tcGFydHMnO1xuaW1wb3J0IHR5cGUgU2FtcGxlRGVzaWduU3lzdGVtUGx1Z2luIGZyb20gJy4uL21haW4nO1xuXG4vKiogYGhvbGRgIHN0b3BzIHJlZHJhd3Mgd2hpbGUgYSBjYXJkIGlzIGRyYWdnZWQ6IGEgcmVkcmF3IHdvdWxkIHRha2UgdGhlIGNhcmQgYXdheS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkcmF3Qm9hcmQoZWw6IEhUTUxFbGVtZW50LCBwbHVnaW46IFNhbXBsZURlc2lnblN5c3RlbVBsdWdpbiwgaG9sZDogKGRyYWdnaW5nOiBib29sZWFuKSA9PiB2b2lkKTogdm9pZCB7XG4gIGNvbnN0IGJvYXJkID0gdWkuYm9hcmQoZWwsIHtcbiAgICBsYWJlbDogJ0l0ZW1zJyxcbiAgICBvbkRyYWdTdGFydDogKCkgPT4gaG9sZCh0cnVlKSxcbiAgICBvbkRyYWdFbmQ6ICgpID0+IGhvbGQoZmFsc2UpLFxuICAgIG9uRHJvcDogKGlkLCBsYW5lLCBpbmRleCkgPT4ge1xuICAgICAgY29uc3Qgc3RhdHVzID0gU1RBVFVTRVMuZmluZCgocykgPT4gcy5pZCA9PT0gbGFuZSk7XG4gICAgICBpZiAoc3RhdHVzKSB2b2lkIHBsdWdpbi5tb3ZlKGlkLCBzdGF0dXMuaWQsIGluZGV4KTtcbiAgICB9LFxuICB9KTtcbiAgZm9yIChjb25zdCBzdGF0dXMgb2YgU1RBVFVTRVMpIHtcbiAgICBjb25zdCBpdGVtcyA9IHBsdWdpbi5kYXRhLml0ZW1zLmZpbHRlcigoaSkgPT4gaS5zdGF0dXMgPT09IHN0YXR1cy5pZCk7XG4gICAgY29uc3QgbGFuZSA9IGJvYXJkLmxhbmUoeyBpZDogc3RhdHVzLmlkLCBsYWJlbDogc3RhdHVzLnRleHQsIHRpdGxlOiBzdGF0dXMudGV4dCwgb25UaXRsZUNsaWNrOiAoKSA9PiB1aS5ub3RpY2UoYCR7aXRlbXMubGVuZ3RofSBpbiAke3N0YXR1cy50ZXh0fWApIH0pO1xuICAgIHVpLmJhZGdlKGxhbmUuaGVhZCwgU3RyaW5nKGl0ZW1zLmxlbmd0aCksIHN0YXR1cy50b25lKTtcbiAgICBpZiAoIWl0ZW1zLmxlbmd0aCkgdWkuZW1wdHlTdGF0ZShsYW5lLmxpc3QsICdObyBpdGVtcycsIHsgdmFyaWFudDogJ2lubGluZScgfSk7XG4gICAgZm9yIChjb25zdCBpdGVtIG9mIGl0ZW1zKSB7XG4gICAgICBjb25zdCBjYXJkID0gbGFuZS5jYXJkKHtcbiAgICAgICAgaWQ6IGl0ZW0uaWQsXG4gICAgICAgIGxhYmVsOiBpdGVtLm5hbWUsXG4gICAgICAgIG9uT3BlbjogKCkgPT4gdm9pZCBvcGVuSXRlbShwbHVnaW4sIGl0ZW0pLFxuICAgICAgICBjaGVjazogeyBjaGVja2VkOiBzdGF0dXMuaWQgPT09ICdkb25lJywgbGFiZWw6IGBEb25lOiAke2l0ZW0ubmFtZX1gLCBvblRvZ2dsZTogKGRvbmUpID0+IHZvaWQgcGx1Z2luLm1vdmUoaXRlbS5pZCwgZG9uZSA/ICdkb25lJyA6ICd0b2RvJywgMCkgfSxcbiAgICAgIH0pO1xuICAgICAgY2FyZC5jb250ZW50LnNldFRleHQoaXRlbS5uYW1lKTtcbiAgICAgIHVpLm1vcmVCdXR0b24oY2FyZC5hY3Rpb25zLCAoKSA9PiBpdGVtTWVudShwbHVnaW4sIGl0ZW0pKTtcbiAgICAgIHVpLmJhZGdlKGNhcmQubWV0YSwgaXRlbS5raW5kKTtcbiAgICAgIGlmIChpdGVtLnBpbm5lZCkgdWkuY2hpcChjYXJkLm1ldGEsICdQaW5uZWQnLCB7IHRvbmU6ICdhY2NlbnQnIH0pO1xuICAgIH1cbiAgICBpZiAoc3RhdHVzLmlkID09PSAndG9kbycpIHVpLmJ1dHRvbihsYW5lLmZvb3RlciwgeyB0ZXh0OiAnQWRkIGl0ZW0nLCBpY29uOiAncGx1cycsIHZhcmlhbnQ6ICdsaW5rJywgb25DbGljazogKCkgPT4gdm9pZCBwbHVnaW4uYWRkSXRlbSgpIH0pO1xuICB9XG59XG4iLCAiLy8gUGFydHMgdGhhdCBncm91cCBjb250ZW50OiBjYXJkcywgZGlzY2xvc3VyZSBjYXJkcywga2V5LXZhbHVlIGxpc3RzLCBjb2RlIGJsb2NrcyBhbmQgY29tbWVudCB0aHJlYWRzLlxuaW1wb3J0IHsgdWkgfSBmcm9tICdoZWxlbml0ZSc7XG5cbmV4cG9ydCBmdW5jdGlvbiBkcmF3Q2FyZHMoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gIGNvbnN0IGNhcmQgPSB1aS5jYXJkKHVpLnNldHRpbmdzLnNlY3Rpb24oZWwsICdDYXJkJyksIHsgdGl0bGU6ICdSZWFkaW5nIGxpc3QnLCBpY29uOiAnZmlsZS10ZXh0JyB9KTtcbiAgdWkuc3RhdHVzVGV4dChjYXJkLmJvZHksICdTeW5jZWQgYSBtaW51dGUgYWdvJywgJ3N1Y2Nlc3MnKTtcbiAgdWkuYnV0dG9uKGNhcmQuZm9vdGVyLCB7IHRleHQ6ICdPcGVuJywgb25DbGljazogKCkgPT4gdm9pZCB1aS5ub3RpY2UoJ09wZW5lZCBSZWFkaW5nIGxpc3QnKSB9KTtcblxuICBjb25zdCB3YXJuaW5nID0gdWkuY2FyZCh1aS5zZXR0aW5ncy5zZWN0aW9uKGVsLCAnQ2FyZCB0aGF0IG5lZWRzIGF0dGVudGlvbicpLCB7IHRpdGxlOiAnV2hpY2ggZm9sZGVyPycsIGljb246ICdjaXJjbGUtaGVscCcsIHRvbmU6ICd3YXJuaW5nJywgYXR0ZW50aW9uOiB0cnVlIH0pO1xuICB1aS5jaG9pY2VMaXN0KHdhcm5pbmcuYm9keSwge1xuICAgIGxhYmVsOiAnRm9sZGVyJyxcbiAgICBvcHRpb25zOiBbeyB2YWx1ZTogJ25vdGVzJywgdGV4dDogJ05vdGVzJywga2V5OiAnMScgfSwgeyB2YWx1ZTogJ2FyY2hpdmUnLCB0ZXh0OiAnQXJjaGl2ZScsIGtleTogJzInIH1dLFxuICAgIG9uQ2hhbmdlOiAodikgPT4gdm9pZCB1aS5ub3RpY2UoYFBpY2tlZCAke3Z9YCksXG4gIH0pO1xuXG4gIC8vIFdpdGhvdXQgYG9uVG9nZ2xlYCBhIGRpc2Nsb3N1cmUgY2FyZCBvcGVucyBhbmQgY2xvc2VzIGl0c2VsZi5cbiAgY29uc3QgbW9yZSA9IHVpLmRpc2Nsb3N1cmUodWkuc2V0dGluZ3Muc2VjdGlvbihlbCwgJ0Rpc2Nsb3N1cmUnKSwgeyB0aXRsZTogJ0Fib3V0IHRoaXMgbGlzdCcsIHN1bW1hcnk6ICdOb3RlcyBhbmQgbGlua3MnLCBvcGVuOiB0cnVlIH0pO1xuICB1aS5iYWRnZShtb3JlLmxlYWQsICcxJywgJ2FjY2VudCcpO1xuICB1aS5rZXlWYWx1ZShtb3JlLmJvZHksIFtcbiAgICB7IGtleTogJ0ZvbGRlcicsIHZhbHVlOiAnTm90ZXMvTGlzdHMnIH0sXG4gICAgeyBrZXk6ICdLaW5kcycsIHZhbHVlOiBbJ25vdGUnLCAnbGluayddLCBpc05ldzogKGspID0+IGsgPT09ICdsaW5rJyB9LFxuICAgIHsga2V5OiAnU2VjcmV0cycsIHZhbHVlOiBbXSwgZW1wdHk6ICdOb25lJyB9LFxuICBdKTtcblxuICB1aS5jb2RlQmxvY2sodWkuc2V0dGluZ3Muc2VjdGlvbihlbCwgJ0NvZGUgYmxvY2snKSwgXCJjb25zdCBjYXJkID0gdWkuY2FyZChlbCwgeyB0aXRsZTogJ1JlYWRpbmcgbGlzdCcsIGljb246ICdmaWxlLXRleHQnIH0pO1xcbnVpLnN0YXR1c1RleHQoY2FyZC5ib2R5LCAnU3luY2VkIGEgbWludXRlIGFnbycsICdzdWNjZXNzJyk7XCIsIHsgbGFiZWw6ICdDYXJkIGNvZGUnIH0pO1xuXG4gIGNvbnN0IHRhbGsgPSB1aS50aHJlYWQodWkuc2V0dGluZ3Muc2VjdGlvbihlbCwgJ1RocmVhZCcpKTtcbiAgdGFsay5ldmVudCgnTm92IDI2LCA5OjAwIEFNIFx1MDBCNyBJdGVtIGFkZGVkJyk7XG4gIGNvbnN0IGFza2VkID0gdGFsay5lbnRyeSgpO1xuICB1aS50aHJlYWRUZXh0KHVpLmNhcmQoYXNrZWQuZWwsIHsgY29tcGFjdDogdHJ1ZSwgdGl0bGU6ICdBZGEnLCBpY29uOiAndXNlcicgfSkuYm9keSwgJ1Nob3VsZCB0aGlzIGdvIGluIHRoZSBhcmNoaXZlPycpO1xuICBjb25zdCBhbnN3ZXIgPSBhc2tlZC5yZXBsaWVzKCkuZW50cnkoKTtcbiAgdWkudGhyZWFkVGV4dCh1aS5jYXJkKGFuc3dlci5lbCwgeyBjb21wYWN0OiB0cnVlLCB0aXRsZTogJ1lvdScsIGljb246ICd1c2VyJywgdG9uZTogJ2FjY2VudCcgfSkuYm9keSwgJ05vdCB5ZXQuXFxuQWZ0ZXIgdGhlIHJldmlldy4nKTtcbn1cbiIsICIvLyBFdmVyeXRoaW5nIHRoYXQgb3BlbnMgb3ZlciB0aGUgcGFnZTogbW9kYWxzLCBwb3BvdmVycywgbWVudXMgYW5kIG5vdGljZXMsIGFuZCB0aGUgc3RhbmRhcmQgYWN0aW9ucy5cbmltcG9ydCB7IHVpLCB0eXBlIEFjdGlvbklkLCB0eXBlIE1lbnVJdGVtU3BlYyB9IGZyb20gJ2hlbGVuaXRlJztcbmltcG9ydCB0eXBlIFNhbXBsZURlc2lnblN5c3RlbVBsdWdpbiBmcm9tICcuLi9tYWluJztcblxuZXhwb3J0IGZ1bmN0aW9uIGRyYXdEaWFsb2dzKGVsOiBIVE1MRWxlbWVudCwgcGx1Z2luOiBTYW1wbGVEZXNpZ25TeXN0ZW1QbHVnaW4pOiB2b2lkIHtcbiAgY29uc3QgeyBhcHAgfSA9IHBsdWdpbjtcblxuICBjb25zdCBtb2RhbHMgPSB1aS50b29sYmFyKHVpLnNldHRpbmdzLnNlY3Rpb24oZWwsICdNb2RhbHMnKSwgeyBsYWJlbDogJ01vZGFscycgfSk7XG4gIHVpLmJ1dHRvbihtb2RhbHMsIHtcbiAgICB0ZXh0OiAnQ29uZmlybScsXG4gICAgb25DbGljazogKCkgPT4gdm9pZCB1aS5jb25maXJtKGFwcCwgeyB0aXRsZTogJ0Rpc2NhcmQgY2hhbmdlcycsIG1lc3NhZ2U6ICdEaXNjYXJkIHRoZSBjaGFuZ2VzIHRvIHRoaXMgaXRlbT8nLCBhY3Rpb246ICdEaXNjYXJkJywgZGFuZ2VyOiB0cnVlIH0pLFxuICB9KTtcbiAgdWkuYnV0dG9uKG1vZGFscywgeyB0ZXh0OiAnUHJvbXB0Jywgb25DbGljazogKCkgPT4gdm9pZCB1aS5wcm9tcHQoYXBwLCB7IHRpdGxlOiAnUmVuYW1lIGl0ZW0nLCBsYWJlbDogJ05hbWUnLCB2YWx1ZTogJ1JlYWRpbmcgbGlzdCcsIGFjdGlvbjogJ1JlbmFtZScgfSkgfSk7XG4gIHVpLmJ1dHRvbihtb2RhbHMsIHtcbiAgICB0ZXh0OiAnQ2hvb3NlJyxcbiAgICBvbkNsaWNrOiAoKSA9PiB2b2lkIHVpLmNob29zZShhcHAsIHtcbiAgICAgIHRpdGxlOiAnUGljayBhIHRlbXBsYXRlJyxcbiAgICAgIG9wdGlvbnM6IFt7IHZhbHVlOiAnYmxhbmsnLCB0ZXh0OiAnQmxhbmsnLCBkZXRhaWw6ICdBbiBlbXB0eSBub3RlJywgaWNvbjogJ2ZpbGUnIH0sIHsgdmFsdWU6ICdkYWlseScsIHRleHQ6ICdEYWlseSBub3RlJywgZGV0YWlsOiAnSGVhZGluZ3MgZm9yIHRoZSBkYXknLCBpY29uOiAnY2FsZW5kYXInIH1dLFxuICAgIH0pLFxuICB9KTtcbiAgdWkuYnV0dG9uKG1vZGFscywge1xuICAgIHRleHQ6ICdGb3JtJyxcbiAgICBvbkNsaWNrOiAoKSA9PiB2b2lkIHVpLmZvcm0oYXBwLCB7XG4gICAgICB0aXRsZTogJ0ltcG9ydCBpdGVtcycsIGFjdGlvbjogJ0ltcG9ydCcsIG1lc3NhZ2U6ICdDb3BpZXMgdGhlIGl0ZW1zIGZyb20gYSBmb2xkZXIgaW50byB0aGlzIGxpc3QuJyxcbiAgICAgIGZpZWxkczogW1xuICAgICAgICB7IGlkOiAncGF0aCcsIGtpbmQ6ICd0ZXh0JywgbGFiZWw6ICdGb2xkZXInLCBwbGFjZWhvbGRlcjogJ05vdGVzL0xpc3RzJyB9LFxuICAgICAgICB7IGlkOiAna2luZCcsIGtpbmQ6ICdzZWxlY3QnLCBsYWJlbDogJ0tpbmQnLCBvcHRpb25zOiBbeyB2YWx1ZTogJ25vdGUnLCBsYWJlbDogJ05vdGUnIH0sIHsgdmFsdWU6ICdsaW5rJywgbGFiZWw6ICdMaW5rJyB9XSB9LFxuICAgICAgICB7IGlkOiAnd2hlbicsIGtpbmQ6ICdjaG9pY2UnLCBsYWJlbDogJ1doZW4nLCB2YWx1ZTogJ25vdycsIG9wdGlvbnM6IFt7IHZhbHVlOiAnbm93JywgbGFiZWw6ICdOb3cnIH0sIHsgdmFsdWU6ICdsYXRlcicsIGxhYmVsOiAnVG9uaWdodCcgfV0gfSxcbiAgICAgICAgeyBpZDogJ3BhcnRzJywga2luZDogJ211bHRpJywgbGFiZWw6ICdJbmNsdWRlJywgdmFsdWU6IFsndGFncyddLCBvcHRpb25zOiBbeyB2YWx1ZTogJ3RhZ3MnLCBsYWJlbDogJ1RhZ3MnIH0sIHsgdmFsdWU6ICdsaW5rcycsIGxhYmVsOiAnTGlua3MnIH1dIH0sXG4gICAgICAgIHsgaWQ6ICdvcGVuJywga2luZDogJ2NoZWNrYm94JywgbGFiZWw6ICdPcGVuIHdoZW4gZG9uZScsIHZhbHVlOiB0cnVlIH0sXG4gICAgICBdLFxuICAgIH0pLFxuICB9KTtcbiAgdWkuYnV0dG9uKG1vZGFscywge1xuICAgIHRleHQ6ICdEaWFsb2cnLFxuICAgIG9uQ2xpY2s6ICgpID0+IHZvaWQgdWkuZGlhbG9nKGFwcCwge1xuICAgICAgdGl0bGU6ICdFeHBvcnQgaXRlbXMnLCBpY29uOiAnZG93bmxvYWQnLFxuICAgICAgcmVuZGVyOiAoYm9keSkgPT4gdm9pZCB1aS5rZXlWYWx1ZShib2R5LCBbeyBrZXk6ICdJdGVtcycsIHZhbHVlOiBTdHJpbmcocGx1Z2luLmRhdGEuaXRlbXMubGVuZ3RoKSB9LCB7IGtleTogJ0Zvcm1hdCcsIHZhbHVlOiAnTWFya2Rvd24nIH1dKSxcbiAgICAgIGFjdGlvbnM6IFt7IHRleHQ6ICdFeHBvcnQnLCB2YXJpYW50OiAncHJpbWFyeScsIG9uQ2xpY2s6IChjdHgpID0+IGN0eC5jbG9zZSgnZXhwb3J0ZWQnKSB9XSxcbiAgICB9KSxcbiAgfSk7XG5cbiAgY29uc3QgaXRlbXMgPSAoKTogTWVudUl0ZW1TcGVjW10gPT4gW1xuICAgIHsgdGl0bGU6ICdSZW5hbWUnLCBpY29uOiAncGVuY2lsJywgb25DbGljazogKCkgPT4gdm9pZCB1aS5ub3RpY2UoJ1JlbmFtZScpIH0sXG4gICAgeyB0aXRsZTogJ1Bpbm5lZCcsIGNoZWNrZWQ6IHRydWUsIG9uQ2xpY2s6ICgpID0+IHt9IH0sXG4gICAgJ3NlcGFyYXRvcicsXG4gICAgeyB0aXRsZTogJ0RlbGV0ZScsIGljb246ICd0cmFzaC0yJywgZGFuZ2VyOiB0cnVlLCBvbkNsaWNrOiAoKSA9PiB2b2lkIHVpLm5vdGljZSgnRGVsZXRlJykgfSxcbiAgXTtcbiAgY29uc3QgZmxvYXRpbmcgPSB1aS50b29sYmFyKHVpLnNldHRpbmdzLnNlY3Rpb24oZWwsICdQb3BvdmVycyBhbmQgbWVudXMnKSwgeyBsYWJlbDogJ1BvcG92ZXJzIGFuZCBtZW51cycgfSk7XG4gIGNvbnN0IGFuY2hvciA9IHVpLmJ1dHRvbihmbG9hdGluZywge1xuICAgIHRleHQ6ICdQb3BvdmVyJyxcbiAgICBvbkNsaWNrOiAoKSA9PiB7XG4gICAgICBjb25zdCBwb3AgPSB1aS5wb3BvdmVyKGFuY2hvci5lbCwgeyB0aXRsZTogJ1F1aWNrIG5vdGUnLCBpY29uOiAnbWVzc2FnZS1jaXJjbGUnLCBxdW90ZTogJ1RoZSB0ZXh0IGl0IGlzIGFib3V0LicgfSk7XG4gICAgICB1aS50ZXh0SW5wdXQocG9wLmJvZHksIHsgcGxhY2Vob2xkZXI6ICdBZGQgYSBub3RlJywgbGFiZWw6ICdOb3RlJyB9KTtcbiAgICAgIHVpLmJ1dHRvbihwb3AuZm9vdGVyLCB7IHRleHQ6ICdTYXZlJywgdmFyaWFudDogJ3ByaW1hcnknLCBvbkNsaWNrOiAoKSA9PiBwb3AuY2xvc2UoKSB9KTtcbiAgICB9LFxuICB9KTtcbiAgLy8gVW5kZXIgdGhlIGJ1dHRvbiwgbm90IGF0IHRoZSBwb2ludGVyOiBhIGJ1dHRvbiBwcmVzc2VkIGZyb20gdGhlIGtleWJvYXJkIGhhcyBubyBwb2ludGVyIHBvc2l0aW9uLlxuICBjb25zdCBvcGVuZXIgPSB1aS5idXR0b24oZmxvYXRpbmcsIHtcbiAgICB0ZXh0OiAnTWVudScsXG4gICAgb25DbGljazogKCkgPT4ge1xuICAgICAgY29uc3QgeyBsZWZ0LCBib3R0b20gfSA9IG9wZW5lci5lbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICAgIHVpLm1lbnUoaXRlbXMoKSwgeyB4OiBsZWZ0LCB5OiBib3R0b20gfSwgeyBkb2M6IG9wZW5lci5lbC5vd25lckRvY3VtZW50IH0pO1xuICAgIH0sXG4gIH0pO1xuICB1aS5tZW51QnV0dG9uKGZsb2F0aW5nLCB7IHRleHQ6ICdBZGQgdG9cdTIwMjYnLCBpdGVtcyB9KTtcbiAgdWkubW9yZUJ1dHRvbihmbG9hdGluZywgaXRlbXMpO1xuXG4gIGNvbnN0IG5vdGljZXMgPSB1aS50b29sYmFyKHVpLnNldHRpbmdzLnNlY3Rpb24oZWwsICdOb3RpY2VzJyksIHsgbGFiZWw6ICdOb3RpY2VzJyB9KTtcbiAgZm9yIChjb25zdCBraW5kIG9mIFsnaW5mbycsICdzdWNjZXNzJywgJ2Vycm9yJ10gYXMgY29uc3QpIHtcbiAgICB1aS5idXR0b24obm90aWNlcywgeyB0ZXh0OiBraW5kLCBvbkNsaWNrOiAoKSA9PiB2b2lkIHVpLm5vdGljZShgVGhpcyBpcyBhICR7a2luZH0gbm90aWNlLmAsIHsga2luZCB9KSB9KTtcbiAgfVxuICB1aS5idXR0b24obm90aWNlcywge1xuICAgIHRleHQ6ICdXaXRoIGFuIGFjdGlvbicsXG4gICAgb25DbGljazogKCkgPT4gdm9pZCB1aS5ub3RpY2UoJzIgaXRlbXMgbmVlZCByZXZpZXcuJywgeyBhY3Rpb246IHsgdGV4dDogJ1JldmlldycsIG9uQ2xpY2s6ICgpID0+IHZvaWQgdWkubm90aWNlKCdSZXZpZXdpbmcuJykgfSB9KSxcbiAgfSk7XG5cbiAgLy8gQSBzdGFuZGFyZCBhY3Rpb24gaGFzIGl0cyBpY29uLCBsYWJlbCBhbmQgbG9vayBhbHJlYWR5LiBgZGVsZXRlYCBhbmQgYHJlbW92ZWAgYXNrIGZpcnN0LlxuICBjb25zdCBhY3Rpb25zID0gdWkudG9vbGJhcih1aS5zZXR0aW5ncy5zZWN0aW9uKGVsLCAnU3RhbmRhcmQgYWN0aW9ucycpLCB7IGxhYmVsOiAnU3RhbmRhcmQgYWN0aW9ucycgfSk7XG4gIGZvciAoY29uc3QgaWQgb2YgT2JqZWN0LmtleXModWkuU1RBTkRBUkRfQUNUSU9OUykgYXMgQWN0aW9uSWRbXSkge1xuICAgIHVpLmFjdGlvbihhY3Rpb25zLCBpZCwgeyBhcHAsIHN1YmplY3Q6ICdFeGFtcGxlJywgb25DbGljazogKCkgPT4gdm9pZCB1aS5ub3RpY2UodWkuU1RBTkRBUkRfQUNUSU9OU1tpZF0ubGFiZWwpIH0pO1xuICB9XG59XG4iLCAiLy8gQnV0dG9ucyBhbmQgZm9ybSBjb250cm9scy4gYHVpLnNldHRpbmdzLnNlY3Rpb25gIGlzIGEgaGVhZGluZyBhbmQgaXRzIGNvbnRhaW5lciwgaW4gYSB2aWV3IGFzIGluIGEgc2V0dGluZ3MgdGFiLlxuaW1wb3J0IHsgdWkgfSBmcm9tICdoZWxlbml0ZSc7XG5cbmV4cG9ydCBmdW5jdGlvbiBkcmF3SW5wdXRzKGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICBjb25zdCBidXR0b25zID0gdWkudG9vbGJhcih1aS5zZXR0aW5ncy5zZWN0aW9uKGVsLCAnQnV0dG9ucycpLCB7IGxhYmVsOiAnQnV0dG9uIHZhcmlhbnRzJyB9KTtcbiAgdWkuYnV0dG9uKGJ1dHRvbnMsIHsgdGV4dDogJ0RlZmF1bHQnIH0pO1xuICB1aS5idXR0b24oYnV0dG9ucywgeyB0ZXh0OiAnUHJpbWFyeScsIHZhcmlhbnQ6ICdwcmltYXJ5JyB9KTtcbiAgdWkuYnV0dG9uKGJ1dHRvbnMsIHsgdGV4dDogJ0RhbmdlcicsIHZhcmlhbnQ6ICdkYW5nZXInIH0pO1xuICB1aS5idXR0b24oYnV0dG9ucywgeyB0ZXh0OiAnTGluaycsIHZhcmlhbnQ6ICdsaW5rJyB9KTtcbiAgdWkuYnV0dG9uKGJ1dHRvbnMsIHsgdmFyaWFudDogJ2ljb24nLCBpY29uOiAnc2V0dGluZ3MnLCBsYWJlbDogJ0NvbmZpZ3VyZScgfSk7XG4gIHVpLmJ1dHRvbihidXR0b25zLCB7IHRleHQ6ICdQcmVzc2VkJywgcHJlc3NlZDogdHJ1ZSB9KTtcbiAgdWkuYnV0dG9uKGJ1dHRvbnMsIHsgdGV4dDogJ0Rpc2FibGVkJywgZGlzYWJsZWQ6IHRydWUgfSk7XG5cbiAgY29uc3QgZmllbGRzID0gdWkuc2V0dGluZ3Muc2VjdGlvbihlbCwgJ0ZpZWxkcycpO1xuICAvLyBBIGZpZWxkIG5hbWVzIGl0cyBjb250cm9sIGFuZCBzaG93cyBpdHMgaGludCBhbmQgZXJyb3IuXG4gIGNvbnN0IG5hbWUgPSB1aS5maWVsZChmaWVsZHMsIHsgbGFiZWw6ICdOYW1lJywgaGludDogJ1Nob3duIGluIHRoZSBsaXN0cy4nLCBmaWxsOiB0cnVlIH0pO1xuICB1aS50ZXh0SW5wdXQobmFtZS5jb250cm9sLCB7IHZhbHVlOiAnUmVhZGluZyBsaXN0Jywgb25JbnB1dDogKHYpID0+IG5hbWUuc2V0RXJyb3Iodi50cmltKCkgPyBudWxsIDogJ0VudGVyIGEgbmFtZS4nKSB9KTtcbiAgY29uc3Qga2V5ID0gdWkuZmllbGQoZmllbGRzLCB7IGxhYmVsOiAnQVBJIGtleScsIGZpbGw6IHRydWUgfSk7XG4gIHVpLnRleHRJbnB1dChrZXkuY29udHJvbCwgeyBzZWNyZXQ6IHRydWUsIHBsYWNlaG9sZGVyOiAnUGFzdGUgdGhlIGtleScgfSk7XG4gIGNvbnN0IG5vdGUgPSB1aS5maWVsZChmaWVsZHMsIHsgbGFiZWw6ICdEZXNjcmlwdGlvbicsIGZpbGw6IHRydWUgfSk7XG4gIHVpLnRleHRJbnB1dChub3RlLmNvbnRyb2wsIHsgbXVsdGlsaW5lOiB0cnVlLCByb3dzOiAzLCBwbGFjZWhvbGRlcjogJ1doYXQgdGhlIGl0ZW0gaXMgZm9yJyB9KTtcbiAgY29uc3QgaW52YWxpZCA9IHVpLmZpZWxkKGZpZWxkcywgeyBsYWJlbDogJ0xpbWl0JywgaW5saW5lOiB0cnVlIH0pO1xuICB1aS50ZXh0SW5wdXQoaW52YWxpZC5jb250cm9sLCB7IHR5cGU6ICdudW1iZXInLCB2YWx1ZTogJzAnIH0pO1xuICBpbnZhbGlkLnNldEVycm9yKCdFbnRlciBhIG51bWJlciBhYm92ZSAwLicpO1xuICBjb25zdCBraW5kID0gdWkuZmllbGQoZmllbGRzLCB7IGxhYmVsOiAnS2luZCcsIGlubGluZTogdHJ1ZSB9KTtcbiAgdWkuZHJvcGRvd24oa2luZC5jb250cm9sLCB7IG9wdGlvbnM6IFt7IHZhbHVlOiAnbm90ZScsIHRleHQ6ICdOb3RlJyB9LCB7IHZhbHVlOiAnbGluaycsIHRleHQ6ICdMaW5rJyB9XSwgdmFsdWU6ICdub3RlJyB9KTtcblxuICBjb25zdCBzd2l0Y2hlcyA9IHVpLnNldHRpbmdzLnNlY3Rpb24oZWwsICdTd2l0Y2hlcyBhbmQgc2xpZGVycycpO1xuICBjb25zdCB0b2dnbGVzID0gdWkudG9vbGJhcihzd2l0Y2hlcywgeyBsYWJlbDogJ1N3aXRjaGVzJyB9KTtcbiAgdWkudG9nZ2xlKHRvZ2dsZXMsIHsgdmFsdWU6IHRydWUsIGxhYmVsOiAnU2hvdyBmaW5pc2hlZCBpdGVtcycgfSk7XG4gIHVpLnRvZ2dsZSh0b2dnbGVzLCB7IHZhbHVlOiBmYWxzZSwgbGFiZWw6ICdTeW5jIGl0ZW1zJywgZGlzYWJsZWQ6IHRydWUgfSk7XG4gIHVpLnNsaWRlcih1aS5maWVsZChzd2l0Y2hlcywgeyBsYWJlbDogJ0l0ZW1zIHBlciBwYWdlJywgaW5saW5lOiB0cnVlIH0pLmNvbnRyb2wsIHsgbWluOiAxMCwgbWF4OiA1MCwgc3RlcDogNSwgdmFsdWU6IDI1LCBsYWJlbDogJ0l0ZW1zIHBlciBwYWdlJywgb25DaGFuZ2U6ICgpID0+IHt9IH0pO1xuXG4gIGNvbnN0IGxpc3RzID0gdWkuc2V0dGluZ3Muc2VjdGlvbihlbCwgJ0xpc3RzIHRvIHBpY2sgZnJvbScpO1xuICB1aS5jaGVja0xpc3QodWkuZmllbGQobGlzdHMsIHsgbGFiZWw6ICdTaG93IGtpbmRzJywgZmlsbDogdHJ1ZSB9KS5jb250cm9sLCB7XG4gICAgb3B0aW9uczogW1xuICAgICAgeyB2YWx1ZTogJ25vdGUnLCB0ZXh0OiAnTm90ZXMnLCBkZXRhaWw6ICdNYXJrZG93biBmaWxlcyBpbiB0aGlzIHZhdWx0JyB9LFxuICAgICAgeyB2YWx1ZTogJ2xpbmsnLCB0ZXh0OiAnTGlua3MnIH0sXG4gICAgICB7IHZhbHVlOiAnZmlsZScsIHRleHQ6ICdGaWxlcycsIGRldGFpbDogJ05vdCBzdXBwb3J0ZWQgeWV0JywgZGlzYWJsZWQ6IHRydWUgfSxcbiAgICBdLFxuICAgIHZhbHVlOiBbJ25vdGUnLCAnbGluayddLFxuICB9KTtcbiAgdWkuY2hvaWNlTGlzdCh1aS5maWVsZChsaXN0cywgeyBsYWJlbDogJ09wZW4gaXRlbXMgaW4nLCBmaWxsOiB0cnVlIH0pLmNvbnRyb2wsIHtcbiAgICBpbmRpY2F0b3I6ICdyYWRpbycsXG4gICAgb3B0aW9uczogW1xuICAgICAgeyB2YWx1ZTogJ3RhYicsIHRleHQ6ICdBIG5ldyB0YWInLCBkZXRhaWw6ICdLZWVwcyB0aGlzIHZpZXcgb3BlbicsIGljb246ICdwbHVzLXNxdWFyZScsIHRhZzogJ0RlZmF1bHQnLCBrZXk6ICcxJyB9LFxuICAgICAgeyB2YWx1ZTogJ3NwbGl0JywgdGV4dDogJ0Egc3BsaXQnLCBpY29uOiAnY29sdW1ucy0yJywga2V5OiAnMicgfSxcbiAgICAgIHsgdmFsdWU6ICd3aW5kb3cnLCB0ZXh0OiAnQSBuZXcgd2luZG93JywgaWNvbjogJ2FwcC13aW5kb3cnLCBrZXk6ICczJywgZGlzYWJsZWQ6IHRydWUgfSxcbiAgICBdLFxuICAgIHZhbHVlOiAndGFiJyxcbiAgICBvbkNoYW5nZTogKCkgPT4ge30sXG4gIH0pO1xuXG4gIGNvbnN0IGNvbXBvc2UgPSB1aS5zZXR0aW5ncy5zZWN0aW9uKGVsLCAnQ29tcG9zZXInKTtcbiAgdWkuY29tcG9zZXIoY29tcG9zZSwge1xuICAgIHBsYWNlaG9sZGVyOiAnQWRkIGEgY29tbWVudCcsIGhpbnQ6ICdFbnRlciBzZW5kcywgU2hpZnQrRW50ZXIgc3RhcnRzIGEgbmV3IGxpbmUuJyxcbiAgICBvbkF0dGFjaDogKCkgPT4gW3sgbmFtZTogJ25vdGVzLm1kJyB9XSxcbiAgICBvblN1Ym1pdDogKHRleHQpID0+IHZvaWQgdWkubm90aWNlKGBTZW50OiAke3RleHR9YCksXG4gIH0pO1xufVxuIiwgIi8vIEEgdG9vbGJhciBvdmVyIHRoZSBpdGVtcywgc2hvd24gYXMgZ3JvdXBlZCBsaXN0IHJvd3Mgb3IgYXMgYSB0YWJsZS5cbmltcG9ydCB7IHVpIH0gZnJvbSAnaGVsZW5pdGUnO1xuaW1wb3J0IHsgU1RBVFVTRVMsIHN0YXR1c09mLCB0eXBlIEl0ZW0gfSBmcm9tICcuLi9kYXRhJztcbmltcG9ydCB7IGl0ZW1NZW51LCBpdGVtVGFibGUsIG9wZW5JdGVtIH0gZnJvbSAnLi4vaXRlbS1wYXJ0cyc7XG5pbXBvcnQgdHlwZSBTYW1wbGVEZXNpZ25TeXN0ZW1QbHVnaW4gZnJvbSAnLi4vbWFpbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSXRlbUZpbHRlciB7XG4gIHF1ZXJ5OiBzdHJpbmc7XG4gIGtpbmQ6IHN0cmluZztcbiAgbGF5b3V0OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkcmF3SXRlbXMoZWw6IEhUTUxFbGVtZW50LCBwbHVnaW46IFNhbXBsZURlc2lnblN5c3RlbVBsdWdpbiwgZmlsdGVyOiBJdGVtRmlsdGVyKTogdm9pZCB7XG4gIGNvbnN0IGJhciA9IHVpLnRvb2xiYXIoZWwsIHsgbGFiZWw6ICdJdGVtIGZpbHRlcnMnIH0pO1xuICB1aS5zZWFyY2hJbnB1dChiYXIsIHtcbiAgICBwbGFjZWhvbGRlcjogJ1NlYXJjaCBpdGVtcycsIHZhbHVlOiBmaWx0ZXIucXVlcnksXG4gICAgb25TZWFyY2g6IChxKSA9PiB7XG4gICAgICBmaWx0ZXIucXVlcnkgPSBxO1xuICAgICAgZHJhdygpO1xuICAgIH0sXG4gIH0pO1xuICB1aS5kcm9wZG93bihiYXIsIHtcbiAgICBsYWJlbDogJ0tpbmQnLCBjb21wYWN0OiB0cnVlLCB2YWx1ZTogZmlsdGVyLmtpbmQsXG4gICAgb3B0aW9uczogW3sgdmFsdWU6ICdhbGwnLCB0ZXh0OiAnQWxsIGtpbmRzJyB9LCB7IHZhbHVlOiAnbm90ZScsIHRleHQ6ICdOb3RlcycgfSwgeyB2YWx1ZTogJ2xpbmsnLCB0ZXh0OiAnTGlua3MnIH1dLFxuICAgIG9uQ2hhbmdlOiAoa2luZCkgPT4ge1xuICAgICAgZmlsdGVyLmtpbmQgPSBraW5kO1xuICAgICAgZHJhdygpO1xuICAgIH0sXG4gIH0pO1xuICB1aS5zZWdtZW50ZWQoYmFyLCB7XG4gICAgbGFiZWw6ICdWaWV3OicsIHZhbHVlOiBmaWx0ZXIubGF5b3V0LFxuICAgIG9wdGlvbnM6IFt7IHZhbHVlOiAnbGlzdCcsIHRleHQ6ICdMaXN0JyB9LCB7IHZhbHVlOiAndGFibGUnLCB0ZXh0OiAnVGFibGUnIH1dLFxuICAgIG9uQ2hhbmdlOiAobGF5b3V0KSA9PiB7XG4gICAgICBmaWx0ZXIubGF5b3V0ID0gbGF5b3V0O1xuICAgICAgZHJhdygpO1xuICAgIH0sXG4gIH0pO1xuICAvLyBgaGVsLXRvb2xiYXItZW5kYCBwdXNoZXMgYSBidXR0b24gdG8gdGhlIGZhciBlbmQgb2YgYSB0b29sYmFyLlxuICB1aS5idXR0b24oYmFyLCB7IHRleHQ6ICdBZGQgaXRlbScsIHZhcmlhbnQ6ICdwcmltYXJ5Jywgb25DbGljazogKCkgPT4gdm9pZCBwbHVnaW4uYWRkSXRlbSgpIH0pLmVsLmNsYXNzTGlzdC5hZGQoJ2hlbC10b29sYmFyLWVuZCcpO1xuXG4gIGNvbnN0IGxpc3QgPSBlbC5jcmVhdGVEaXYoKTtcbiAgY29uc3QgZHJhdyA9ICgpOiB2b2lkID0+IHtcbiAgICBsaXN0LmVtcHR5KCk7XG4gICAgY29uc3QgcSA9IGZpbHRlci5xdWVyeS50b0xvd2VyQ2FzZSgpO1xuICAgIGNvbnN0IGl0ZW1zID0gcGx1Z2luLmRhdGEuaXRlbXMuZmlsdGVyKChpKSA9PiBpLm5hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKSAmJiAoZmlsdGVyLmtpbmQgPT09ICdhbGwnIHx8IGkua2luZCA9PT0gZmlsdGVyLmtpbmQpKTtcbiAgICBpZiAoIWl0ZW1zLmxlbmd0aCkge1xuICAgICAgdWkuZW1wdHlTdGF0ZShsaXN0LCBwbHVnaW4uZGF0YS5pdGVtcy5sZW5ndGggPyAnTm8gaXRlbXMgbWF0Y2guJyA6ICdObyBpdGVtcyB5ZXQuJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChmaWx0ZXIubGF5b3V0ID09PSAndGFibGUnKSBpdGVtVGFibGUobGlzdCwgcGx1Z2luLCBpdGVtcyk7XG4gICAgZWxzZSBkcmF3R3JvdXBzKGxpc3QsIHBsdWdpbiwgaXRlbXMpO1xuICB9O1xuICBkcmF3KCk7XG59XG5cbmZ1bmN0aW9uIGRyYXdHcm91cHMoZWw6IEhUTUxFbGVtZW50LCBwbHVnaW46IFNhbXBsZURlc2lnblN5c3RlbVBsdWdpbiwgaXRlbXM6IEl0ZW1bXSk6IHZvaWQge1xuICBjb25zdCBkZXRhaWxlZCA9IHBsdWdpbi5kYXRhLmRlbnNpdHkgPT09ICdkZXRhaWxlZCc7XG4gIGZvciAoY29uc3Qgc3RhdHVzIG9mIFNUQVRVU0VTKSB7XG4gICAgY29uc3Qgcm93cyA9IGl0ZW1zLmZpbHRlcigoaSkgPT4gaS5zdGF0dXMgPT09IHN0YXR1cy5pZCk7XG4gICAgaWYgKCFyb3dzLmxlbmd0aCkgY29udGludWU7XG4gICAgY29uc3QgZ3JvdXAgPSB1aS5saXN0R3JvdXAoZWwsIHsgdGl0bGU6IHN0YXR1cy50ZXh0LCBjb3VudDogcm93cy5sZW5ndGggfSk7XG4gICAgZm9yIChjb25zdCBpdGVtIG9mIHJvd3MpIHtcbiAgICAgIHVpLmxpc3RSb3coZ3JvdXAuYm9keSwge1xuICAgICAgICB0aXRsZTogaXRlbS5uYW1lLFxuICAgICAgICBkb3Q6IHsgdG9uZTogc3RhdHVzT2YoaXRlbSkudG9uZSwgbGFiZWw6IHN0YXR1c09mKGl0ZW0pLnRleHQgfSxcbiAgICAgICAgdGFnOiBpdGVtLnBpbm5lZCA/ICdQaW5uZWQnIDogdW5kZWZpbmVkLFxuICAgICAgICBtZXRhOiBpdGVtLmtpbmQsXG4gICAgICAgIC8vIFRoZSBkZXRhaWxlZCBkZW5zaXR5IGFkZHMgYSBzZWNvbmQgbGluZSBhbmQgYSBsaW5lIG9mIGNoaXBzLlxuICAgICAgICBzdWI6IGRldGFpbGVkID8gYCR7c3RhdHVzT2YoaXRlbSkudGV4dH0gXHUwMEI3IGFkZGVkIGZyb20gdGhlIHNhbXBsZWAgOiB1bmRlZmluZWQsXG4gICAgICAgIGNoaXBzOiBkZXRhaWxlZCAmJiBpdGVtLnBpbm5lZCA/IFt7IHRleHQ6ICdwaW5uZWQnLCB0b25lOiAnYWNjZW50JyB9LCBpdGVtLmtpbmRdIDogdW5kZWZpbmVkLFxuICAgICAgICBhY3Rpb25zOiBbeyBpY29uOiAncGVuY2lsJywgbGFiZWw6ICdSZW5hbWUnLCBpZDogJ3JlbmFtZScsIG9uQ2xpY2s6ICgpID0+IHZvaWQgcGx1Z2luLnJlbmFtZShpdGVtKSB9XSxcbiAgICAgICAgb25DbGljazogKCkgPT4gdm9pZCBvcGVuSXRlbShwbHVnaW4sIGl0ZW0pLFxuICAgICAgICBtZW51OiAoKSA9PiBpdGVtTWVudShwbHVnaW4sIGl0ZW0pLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG59XG4iLCAiLy8gUGFydHMgdGhhdCB0ZWxsIHRoZSB1c2VyIGhvdyB0aGluZ3Mgc3RhbmQ6IG1lc3NhZ2VzLCBsYWJlbHMsIHJlYWRpbmdzLCBhbmQgd2hhdCB0byBzaG93IHdpdGggbm90aGluZyB0byBzaG93LlxuaW1wb3J0IHsgdWksIHR5cGUgVG9uZSB9IGZyb20gJ2hlbGVuaXRlJztcbmltcG9ydCB7IGNvdW50IH0gZnJvbSAnLi4vZGF0YSc7XG5cbmNvbnN0IFRPTkVTOiBUb25lW10gPSBbJ2RlZmF1bHQnLCAnYWNjZW50JywgJ3N1Y2Nlc3MnLCAnd2FybmluZycsICdkYW5nZXInXTtcblxuZXhwb3J0IGZ1bmN0aW9uIGRyYXdTdGF0dXMoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gIGNvbnN0IGNhbGxvdXRzID0gdWkuc2V0dGluZ3Muc2VjdGlvbihlbCwgJ0NhbGxvdXRzJyk7XG4gIHVpLmNhbGxvdXQoY2FsbG91dHMsIHsgdG9uZTogJ2luZm8nLCB0ZXh0OiAnSXRlbXMgYXJlIHNhdmVkIGluIHRoaXMgdmF1bHQuJyB9KTtcbiAgdWkuY2FsbG91dChjYWxsb3V0cywgeyB0b25lOiAnYWNjZW50JywgdGV4dDogJzIgaXRlbXMgYXJlIHdhaXRpbmcgZm9yIHlvdS4nLCBhY3Rpb246IHsgdGV4dDogJ1JldmlldycsIG9uQ2xpY2s6ICgpID0+IHZvaWQgdWkubm90aWNlKCdOb3RoaW5nIHRvIHJldmlldy4nKSB9IH0pO1xuICB1aS5jYWxsb3V0KGNhbGxvdXRzLCB7IHRvbmU6ICdzdWNjZXNzJywgdGV4dDogJ0V2ZXJ5dGhpbmcgaXMgdXAgdG8gZGF0ZS4nIH0pO1xuICB1aS5jYWxsb3V0KGNhbGxvdXRzLCB7IHRvbmU6ICd3YXJuaW5nJywgdGV4dDogJ1RoaXMgbGluayBoYXMgbm90IGJlZW4gY2hlY2tlZCBmb3IgYSBtb250aC4nIH0pO1xuICB1aS5jYWxsb3V0KGNhbGxvdXRzLCB7IHRvbmU6ICdkYW5nZXInLCB0ZXh0OiAnQ291bGQgbm90IHJlYWNoIHRoZSBzZXJ2ZXIuJyB9KTtcbiAgdWkuY2FsbG91dChjYWxsb3V0cywgeyB0b25lOiAnYWNjZW50Jywgc29saWQ6IHRydWUsIHRleHQ6ICdBbiBhZ2VudCBpcyB3YWl0aW5nIG9uIHlvdS4nIH0pO1xuXG4gIC8vIEEgc2V0dGluZ3Mgcm93J3MgY29udHJvbCBhcmVhIGxheXMgc21hbGwgdGhpbmdzIG91dCBzaWRlIGJ5IHNpZGUuIChgdWkudG9vbGJhcmAgaXMgZm9yIGNvbnRyb2xzLilcbiAgY29uc3QgbGFiZWxzID0gdWkuc2V0dGluZ3Muc2VjdGlvbihlbCwgJ0JhZGdlcywgZG90cywgY291bnRzLCBjaGlwcywgYXZhdGFycyBhbmQgc3dhdGNoZXMnKTtcbiAgY29uc3Qgcm93ID0gKG5hbWU6IHN0cmluZykgPT4gbmV3IHVpLnNldHRpbmdzLnJvdyhsYWJlbHMpLnNldE5hbWUobmFtZSkuY29udHJvbEVsO1xuICBjb25zdCBiYWRnZXMgPSByb3coJ0JhZGdlcycpO1xuICBmb3IgKGNvbnN0IHRvbmUgb2YgVE9ORVMpIHVpLmJhZGdlKGJhZGdlcywgdG9uZSwgdG9uZSk7XG4gIGNvbnN0IGRvdHMgPSByb3coJ1N0YXR1cyBkb3RzJyk7XG4gIGZvciAoY29uc3QgdG9uZSBvZiBUT05FUykgdWkuc3RhdHVzRG90KGRvdHMsIHRvbmUsIHRvbmUpO1xuICB1aS5zdGF0dXNEb3QoZG90cywgJ3dhcm5pbmcnLCAnV2FpdGluZyBmb3IgeW91JywgeyBwdWxzZTogdHJ1ZSB9KTtcbiAgY29uc3Qgd29yZHMgPSByb3coJ1N0YXR1cyB0ZXh0Jyk7XG4gIGZvciAoY29uc3QgdG9uZSBvZiBUT05FUykgdWkuc3RhdHVzVGV4dCh3b3JkcywgdG9uZSwgdG9uZSk7XG4gIGNvbnN0IGNvdW50cyA9IHJvdygnQ291bnRzJyk7XG4gIHVpLmNvdW50QmFkZ2UoY291bnRzLCAzLCB7IGxhYmVsOiAndW5yZWFkJyB9KTtcbiAgdWkuY291bnRCYWRnZShjb3VudHMsIDEyLCB7IGxhYmVsOiAnd2FpdGluZycsIHRvbmU6ICdkYW5nZXInLCBpY29uOiAnY2lyY2xlLWhlbHAnIH0pO1xuICBjb25zdCBjaGlwcyA9IHJvdygnQ2hpcHMnKTtcbiAgdWkuY2hpcChjaGlwcywgJ3Byb2plY3QnKTtcbiAgdWkuY2hpcChjaGlwcywgJ2RyYWZ0JywgeyB0b25lOiAnYWNjZW50Jywgb25SZW1vdmU6ICgpID0+IHt9IH0pO1xuICB1aS5jaGlwKGNoaXBzLCAnYnJva2VuJywgeyB0b25lOiAnZGFuZ2VyJyB9KTtcbiAgY29uc3QgcGVvcGxlID0gcm93KCdBdmF0YXJzJyk7XG4gIGZvciAoY29uc3Qgc2l6ZSBvZiBbJ3NtYWxsJywgJ21lZGl1bScsICdsYXJnZSddIGFzIGNvbnN0KSB1aS5hdmF0YXIocGVvcGxlLCB7IHRleHQ6ICdBZGEgTG92ZWxhY2UnLCBzaXplIH0pO1xuICB1aS5hdmF0YXIocGVvcGxlLCB7IHRleHQ6ICcrMycgfSk7XG4gIGNvbnN0IHZhbHVlcyA9IHJvdygnU3dhdGNoZXMnKTtcbiAgdWkuc3dhdGNoKHZhbHVlcywgeyBraW5kOiAnY29sb3InLCB2YWx1ZTogJ3ZhcigtLWludGVyYWN0aXZlLWFjY2VudCknLCBsYWJlbDogJy0taW50ZXJhY3RpdmUtYWNjZW50JyB9KTtcbiAgdWkuc3dhdGNoKHZhbHVlcywgeyBraW5kOiAncmFkaXVzJywgdmFsdWU6ICd2YXIoLS1yYWRpdXMtbSknLCBsYWJlbDogJy0tcmFkaXVzLW0nIH0pO1xuICB1aS5zd2F0Y2godmFsdWVzLCB7IGtpbmQ6ICdzaGFkb3cnLCB2YWx1ZTogJ3ZhcigtLXNoYWRvdy1zKScsIGxhYmVsOiAnLS1zaGFkb3ctcycgfSk7XG4gIHVpLnN3YXRjaCh2YWx1ZXMsIHsga2luZDogJ3NpemUnLCB2YWx1ZTogJ3ZhcigtLXNpemUtNC02KScsIGxhYmVsOiAnLS1zaXplLTQtNicgfSk7XG4gIHVpLnN3YXRjaCh2YWx1ZXMsIHsga2luZDogJ2ZvbnQtZmFtaWx5JywgdmFsdWU6ICd2YXIoLS1mb250LW1vbm9zcGFjZSknLCBsYWJlbDogJy0tZm9udC1tb25vc3BhY2UnIH0pO1xuXG4gIGNvbnN0IHJlYWRpbmdzID0gdWkuc2V0dGluZ3Muc2VjdGlvbihlbCwgJ01ldGVycycpO1xuICBjb25zdCBpbmxpbmUgPSBuZXcgdWkuc2V0dGluZ3Mucm93KHJlYWRpbmdzKS5zZXROYW1lKCdJbmxpbmUnKS5jb250cm9sRWw7XG4gIHVpLm1ldGVyKGlubGluZSwgeyBsYWJlbDogJ1N0b3JhZ2UnLCB2YWx1ZTogMzAsIHRleHQ6ICczMCUnLCB0b25lOiAnc3VjY2VzcycgfSk7XG4gIHVpLm1ldGVyKGlubGluZSwgeyBsYWJlbDogJ1F1b3RhJywgdmFsdWU6IDc1LCB0ZXh0OiAnNzUlJywgdG9uZTogJ3dhcm5pbmcnIH0pO1xuICB1aS5tZXRlcihyZWFkaW5ncywgeyBsYXlvdXQ6ICdzdGFja2VkJywgbGFiZWw6ICdNb250aGx5IGJ1ZGdldCcsIHZhbHVlOiA5NiwgdGV4dDogJyQ0OCBvZiAkNTAnLCBzdWI6ICdyZXNldHMgaW4gMyBkYXlzJywgdG9uZTogJ2RhbmdlcicgfSk7XG5cbiAgY29uc3QgYWRkZWQgPSBbMiwgNSwgMywgMCwgNiwgOCwgNCwgNywgMSwgOV0ubWFwKCh2YWx1ZSwgaSkgPT4gKHsgZGF5OiBgTm92ICR7aSArIDEyfWAsIHZhbHVlIH0pKTtcbiAgY29uc3QgY2hhcnQgPSB1aS5zZXR0aW5ncy5zZWN0aW9uKGVsLCAnQmFyIGNoYXJ0Jyk7XG4gIHVpLmJhckNoYXJ0KGNoYXJ0LCB7XG4gICAgbGFiZWw6ICdJdGVtcyBhZGRlZCBwZXIgZGF5JyxcbiAgICBidWNrZXRzOiBhZGRlZC5tYXAoKHsgZGF5LCB2YWx1ZSB9KSA9PiAoeyBrZXk6IGRheSwgdmFsdWUsIHRpdGxlOiBgJHtkYXl9OiAke2NvdW50KHZhbHVlLCAnaXRlbScpfWAgfSkpLFxuICB9KTtcbiAgLy8gQSBjaGFydCBpcyByZWFkIGFzIG9uZSBpbWFnZTogcHV0IHRoZSBmaWd1cmVzIHRoYXQgbWF0dGVyIGluIHRleHQgYmVzaWRlIGl0LlxuICBjb25zdCBtb3N0ID0gYWRkZWQucmVkdWNlKChhLCBiKSA9PiAoYi52YWx1ZSA+IGEudmFsdWUgPyBiIDogYSkpO1xuICBjb25zdCB0b3RhbCA9IGFkZGVkLnJlZHVjZSgoc3VtLCBkKSA9PiBzdW0gKyBkLnZhbHVlLCAwKTtcbiAgdWkuc3RhdHVzVGV4dChjaGFydCwgYCR7Y291bnQodG90YWwsICdpdGVtJyl9IGFkZGVkOyB0aGUgbW9zdCwgJHttb3N0LnZhbHVlfSwgb24gJHttb3N0LmRheX0uYCk7XG5cbiAgY29uc3Qgd2FpdGluZyA9IHVpLnNldHRpbmdzLnNlY3Rpb24oZWwsICdMb2FkaW5nJyk7XG4gIHVpLmxvYWRpbmdTdGF0ZSh3YWl0aW5nLCAnTG9hZGluZyBpdGVtc1x1MjAyNicpO1xuICB1aS5sb2FkaW5nU3RhdGUod2FpdGluZywgJ0ltcG9ydGluZycsIHsgcHJvZ3Jlc3M6IDAuNCB9KTtcblxuICB1aS5lbXB0eVN0YXRlKHVpLnNldHRpbmdzLnNlY3Rpb24oZWwsICdFbXB0eSBzdGF0ZScpLCAnTm8gaXRlbXMgeWV0LicpO1xuICB1aS5lcnJvclN0YXRlKHVpLnNldHRpbmdzLnNlY3Rpb24oZWwsICdFcnJvciBzdGF0ZScpLCAnQ291bGQgbm90IGxvYWQgdGhlIGl0ZW1zLicsICgpID0+IHZvaWQgdWkubm90aWNlKCdUcnlpbmcgYWdhaW4uJykpO1xuICBjb25zdCBzbWFsbCA9IHVpLnNldHRpbmdzLnNlY3Rpb24oZWwsICdJbmxpbmUgc3RhdGVzLCBmb3IgYSBzZXR0aW5ncyBsaXN0Jyk7XG4gIHVpLmVtcHR5U3RhdGUoc21hbGwsICdObyBhY2NvdW50cyB5ZXQuJywgeyB2YXJpYW50OiAnaW5saW5lJyB9KTtcbiAgdWkuZXJyb3JTdGF0ZShzbWFsbCwgJ0NvdWxkIG5vdCBjb25uZWN0LicsICgpID0+IHt9LCB7IHZhcmlhbnQ6ICdpbmxpbmUnLCByZXRyeUxh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QkFBRyxPQUFPLFNBQVMsSUFBSSxLQUFLLE9BQU8sSUFBSSxHQUFHLFNBQVMsYUFBYSxFQUFFLEtBQUssRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUFBLEVBQzVGO0FBQUEsRUFFQSxNQUFNLEtBQUssSUFBWSxRQUFnQixPQUErQjtBQUNwRSxVQUFNLE9BQU8sS0FBSyxLQUFLLE1BQU0sS0FBSyxDQUFDLE1BQU0sRUFBRSxPQUFPLEVBQUU7QUFDcEQsUUFBSSxDQUFDLEtBQU07QUFDWCxVQUFNLE9BQU8sS0FBSyxLQUFLLE1BQU0sT0FBTyxDQUFDLE1BQU0sTUFBTSxJQUFJO0FBQ3JELFNBQUssU0FBUztBQUVkLFVBQU0sU0FBUyxVQUFVLFNBQVksU0FBWSxLQUFLLE9BQU8sQ0FBQyxNQUFNLEVBQUUsV0FBVyxNQUFNLEVBQUUsS0FBSztBQUM5RixTQUFLLE9BQU8sU0FBUyxLQUFLLFFBQVEsTUFBTSxJQUFJLEtBQUssUUFBUSxHQUFHLElBQUk7QUFDaEUsU0FBSyxLQUFLLFFBQVE7QUFDbEIsVUFBTSxLQUFLLEtBQUs7QUFBQSxFQUNsQjtBQUFBLEVBRUEsTUFBTSxPQUFPLE1BQTJCO0FBQ3RDLFVBQU0sT0FBTyxNQUFNLHFCQUFHLE9BQU8sS0FBSyxLQUFLO0FBQUEsTUFDckMsT0FBTztBQUFBLE1BQWUsT0FBTztBQUFBLE1BQVEsT0FBTyxLQUFLO0FBQUEsTUFBTSxRQUFRO0FBQUEsTUFDL0QsVUFBVSxDQUFDLE1BQU8sRUFBRSxLQUFLLElBQUksT0FBTztBQUFBLElBQ3RDLENBQUM7QUFDRCxRQUFJLFNBQVMsS0FBTTtBQUNuQixTQUFLLE9BQU8sS0FBSyxLQUFLO0FBQ3RCLFVBQU0sS0FBSyxLQUFLO0FBQUEsRUFDbEI7QUFBQSxFQUVBLE1BQU0sT0FBTyxNQUEyQjtBQUN0QyxTQUFLLEtBQUssUUFBUSxLQUFLLEtBQUssTUFBTSxPQUFPLENBQUMsTUFBTSxFQUFFLE9BQU8sS0FBSyxFQUFFO0FBQ2hFLFVBQU0sS0FBSyxLQUFLO0FBQ2hCLHlCQUFHLE9BQU8sV0FBVyxLQUFLLElBQUksSUFBSSxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBQUEsRUFDdkQ7QUFDRjsiLAogICJuYW1lcyI6IFsiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9oZWxlbml0ZSIsICJpbXBvcnRfaGVsZW5pdGUiLCAic2NvcGUiLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9oZWxlbml0ZSIsICJpbXBvcnRfaGVsZW5pdGUiLCAiaW1wb3J0X2hlbGVuaXRlIiwgImltcG9ydF9oZWxlbml0ZSIsICJpbXBvcnRfaGVsZW5pdGUiLCAiaW1wb3J0X2hlbGVuaXRlIiwgImltcG9ydF9oZWxlbml0ZSJdCn0K
