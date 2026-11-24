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

// catalog/plugins/helenite-homepage/src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => HomepagePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian2 = require("obsidian");
var import_helenite2 = require("helenite");

// catalog/plugins/helenite-homepage/src/homepage.ts
var DEFAULT_SETTINGS = {
  kind: "note",
  target: "Home",
  openOnStartup: true,
  openInNewTab: false,
  openMode: "replace-all",
  view: "default",
  refresh: "switch",
  createIfMissing: true
};
function readSettings(saved) {
  const s = saved && typeof saved === "object" ? saved : {};
  const pick = (v, allowed, d) => allowed.includes(v) ? v : d;
  const bool = (v, d) => typeof v === "boolean" ? v : d;
  const D = DEFAULT_SETTINGS;
  return {
    kind: pick(s.kind, ["note", "random"], D.kind),
    target: typeof s.target === "string" ? s.target : D.target,
    openOnStartup: bool(s.openOnStartup, D.openOnStartup),
    openInNewTab: bool(s.openInNewTab, D.openInNewTab),
    openMode: pick(s.openMode, ["replace-all", "replace-last", "keep"], D.openMode),
    view: pick(s.view, ["default", "reading", "editing"], D.view),
    refresh: pick(s.refresh, ["switch", "reload", "duplicate"], D.refresh),
    createIfMissing: bool(s.createIfMissing, D.createIfMissing)
  };
}
function normalizeTarget(input) {
  let p = input.trim();
  const link = /^\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]$/.exec(p);
  if (link) p = link[1].trim();
  p = p.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/{2,}/g, "/");
  if (!p) return "";
  const name = p.slice(p.lastIndexOf("/") + 1);
  return /\.[A-Za-z0-9]+$/.test(name) ? p : `${p}.md`;
}
function resolveTarget(s, vault) {
  if (s.kind === "random") {
    const notes = vault.notes();
    if (!notes.length) return { ok: false, reason: "There are no notes to pick from." };
    return { ok: true, path: notes[Math.min(notes.length - 1, Math.floor(vault.random() * notes.length))], create: false };
  }
  const path = normalizeTarget(s.target);
  if (!path) return { ok: false, reason: "Choose a homepage note in Settings, Homepage." };
  if (vault.exists(path)) return { ok: true, path, create: false };
  if (s.createIfMissing && path.endsWith(".md")) return { ok: true, path, create: true };
  return { ok: false, reason: `${path} does not exist.` };
}
function planOpen(tabs, path, mode, refresh) {
  const closable = (keep) => mode === "replace-all" ? tabs.filter((t) => t.id !== keep && !t.pinned).map((t) => t.id) : [];
  const existing = refresh === "duplicate" ? void 0 : tabs.find((t) => t.path === path);
  if (existing) return { action: refresh === "reload" ? "reload" : "focus", leaf: existing.id, close: closable(existing.id) };
  const active = tabs.find((t) => t.active) ?? null;
  const usable = (t) => t && !t.pinned ? t : null;
  let leaf;
  if (mode === "keep") leaf = active?.empty ? active : null;
  else if (mode === "replace-last") leaf = usable(active);
  else leaf = usable(active) ?? tabs.find((t) => !t.pinned) ?? null;
  return { action: "open", leaf: leaf?.id ?? null, close: closable(leaf?.id ?? null) };
}
function openStateFor(view) {
  if (view === "reading") return { state: { mode: "preview" } };
  if (view === "editing") return { state: { mode: "source" } };
  return {};
}

// catalog/plugins/helenite-homepage/src/settings.ts
var import_obsidian = require("obsidian");
var import_helenite = require("helenite");
var NoteSuggest = class extends import_obsidian.AbstractInputSuggest {
  constructor(app, input, pick) {
    super(app, input);
    this.input = input;
    this.pick = pick;
  }
  input;
  pick;
  getSuggestions(query) {
    const q = query.trim().toLowerCase();
    return this.app.vault.getMarkdownFiles().filter((f) => f.path.toLowerCase().includes(q)).sort((a, b) => a.path.length - b.path.length).slice(0, 50);
  }
  renderSuggestion(file, el) {
    el.setText(file.path.replace(/\.md$/, ""));
  }
  selectSuggestion(file) {
    const value = file.path.replace(/\.md$/, "");
    this.input.value = value;
    this.pick(value);
    this.close();
  }
};
var OPEN_MODES = {
  "replace-all": "Replace all open tabs",
  "replace-last": "Replace the current tab",
  keep: "Keep tabs, open a new one"
};
var REFRESH_MODES = {
  switch: "Switch to it",
  reload: "Switch to it and reload it",
  duplicate: "Open it again"
};
var HomepageSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  plugin;
  set(key, value) {
    this.plugin.settings[key] = value;
    void this.plugin.save();
  }
  display() {
    const el = this.containerEl;
    el.empty();
    const s = this.plugin.settings;
    const what = import_helenite.ui.settings.section(el, "Homepage");
    const kind = new import_helenite.ui.settings.row(what).setName("Open").setDesc("A chosen note, or a different random note each time.");
    import_helenite.ui.segmented(kind.controlEl, {
      value: s.kind,
      options: [
        { value: "note", text: "A note" },
        { value: "random", text: "A random note" }
      ],
      onChange: (v) => {
        this.set("kind", v);
        this.display();
      }
    });
    if (s.kind === "note") {
      const note = new import_helenite.ui.settings.row(what).setName("Note").setDesc(this.noteDesc(s.target));
      note.addText((t) => {
        t.setPlaceholder("Home").setValue(s.target);
        const commit = (v) => {
          this.set("target", v.trim());
          note.setDesc(this.noteDesc(v));
        };
        t.onChange(commit);
        new NoteSuggest(this.app, t.inputEl, commit);
      });
      new import_helenite.ui.settings.row(what).setName("Create the note if it is missing").setDesc("Off shows an error instead.").addToggle((t) => t.setValue(s.createIfMissing).onChange((v) => this.set("createIfMissing", v)));
    }
    const when = import_helenite.ui.settings.section(el, "When to open it");
    new import_helenite.ui.settings.row(when).setName("When Helenite starts").addToggle((t) => t.setValue(s.openOnStartup).onChange((v) => this.set("openOnStartup", v)));
    new import_helenite.ui.settings.row(when).setName("In new empty tabs").setDesc("A new tab shows the homepage instead of an empty page.").addToggle((t) => t.setValue(s.openInNewTab).onChange((v) => this.set("openInNewTab", v)));
    const how = import_helenite.ui.settings.section(el, "How to open it");
    new import_helenite.ui.settings.row(how).setName("Tabs").setDesc("What happens to the tabs already open. Pinned tabs always stay.").addDropdown((d) => d.addOptions(OPEN_MODES).setValue(s.openMode).onChange((v) => this.set("openMode", v)));
    new import_helenite.ui.settings.row(how).setName("If it is already open").addDropdown((d) => d.addOptions(REFRESH_MODES).setValue(s.refresh).onChange((v) => this.set("refresh", v)));
    const view = new import_helenite.ui.settings.row(how).setName("View").setDesc("Default uses the mode set in Editor settings.");
    import_helenite.ui.segmented(view.controlEl, {
      value: s.view,
      options: [
        { value: "default", text: "Default" },
        { value: "reading", text: "Reading" },
        { value: "editing", text: "Editing" }
      ],
      onChange: (v) => this.set("view", v)
    });
    const now = new import_helenite.ui.settings.row(how).setName("Open the homepage now");
    import_helenite.ui.action(now.controlEl, "open", { onClick: () => this.plugin.openHomepage() });
  }
  noteDesc(target) {
    const path = normalizeTarget(target);
    if (!path) return "Type a note name or path.";
    return this.app.vault.getAbstractFileByPath(path) ? `Opens ${path}.` : `${path} does not exist yet.`;
  }
};

// catalog/plugins/helenite-homepage/src/main.ts
var HomepagePlugin = class extends import_obsidian2.Plugin {
  settings = readSettings(void 0);
  /** Main-area tabs that existed already, so only tabs opened later count as new. */
  seen = /* @__PURE__ */ new WeakSet();
  async onload() {
    this.settings = readSettings(await this.loadData());
    this.addSettingTab(new HomepageSettingTab(this.app, this));
    this.addRibbonIcon("home", "Open homepage", () => void this.openHomepage());
    this.addCommand({ id: "open", name: "Open homepage", callback: () => void this.openHomepage() });
    const atStartup = !this.app.workspace.layoutReady;
    this.app.workspace.onLayoutReady(async () => {
      this.app.workspace.iterateRootLeaves((leaf) => void this.seen.add(leaf));
      if (atStartup && this.settings.openOnStartup) await this.openHomepage();
      const check = () => this.checkNewTabs();
      this.registerEvent(this.app.workspace.on("layout-change", check));
      this.registerEvent(this.app.workspace.on("active-leaf-change", check));
    });
  }
  async save() {
    await this.saveData(this.settings);
  }
  /** A main-area tab that appeared since the last check and is still empty once its opener has had a turn. */
  checkNewTabs() {
    const fresh = [];
    this.app.workspace.iterateRootLeaves((leaf) => {
      if (this.seen.has(leaf)) return;
      this.seen.add(leaf);
      fresh.push(leaf);
    });
    if (!this.settings.openInNewTab || !fresh.length) return;
    window.setTimeout(() => {
      for (const leaf of fresh) {
        if (leaf.view?.getViewType() === "empty" && !leaf.working) void this.openHomepage(leaf);
      }
    }, 0);
  }
  tabs() {
    const ws = this.app.workspace;
    const active = ws.activeLeaf?.getRoot() === ws.rootSplit ? ws.activeLeaf : ws.getMostRecentLeaf();
    const leaves = [];
    ws.iterateRootLeaves((leaf) => void leaves.push(leaf));
    const info = leaves.map((leaf, i) => ({
      id: String(i),
      path: leaf.view?.file?.path ?? null,
      empty: leaf.view?.getViewType() === "empty",
      pinned: !!leaf.getViewState().pinned,
      active: leaf === active
    }));
    return { info, leaves };
  }
  /** Open the homepage the way the settings say, or into `into` (a new empty tab). */
  async openHomepage(into) {
    const { vault, workspace } = this.app;
    const s = this.settings;
    const res = resolveTarget(s, {
      exists: (p) => !!vault.getAbstractFileByPath(p),
      notes: () => vault.getMarkdownFiles().map((f) => f.path),
      random: Math.random
    });
    if (!res.ok) {
      import_helenite2.ui.notice(`Could not open the homepage. ${res.reason}`, { kind: "error" });
      return;
    }
    let file = vault.getAbstractFileByPath(res.path);
    if (res.create) {
      try {
        const dir = res.path.includes("/") ? res.path.slice(0, res.path.lastIndexOf("/")) : "";
        if (dir && !vault.getAbstractFileByPath(dir)) await vault.createFolder(dir);
        file = await vault.create(res.path, "");
      } catch (e) {
        import_helenite2.ui.notice(`Could not create ${res.path}: ${e instanceof Error ? e.message : String(e)}`, { kind: "error" });
        return;
      }
    }
    if (!(file instanceof import_obsidian2.TFile)) {
      import_helenite2.ui.notice(`Could not open the homepage. ${res.path} is not a file.`, { kind: "error" });
      return;
    }
    const open = { ...openStateFor(s.view), active: true };
    if (into) {
      await into.openFile(file, open);
      return;
    }
    const { info, leaves } = this.tabs();
    const plan = planOpen(info, file.path, s.openMode, s.refresh);
    let leaf = plan.leaf !== null ? leaves[Number(plan.leaf)] : null;
    if (leaf && plan.action !== "open") {
      if (plan.action === "reload") await leaf.rebuildView?.();
      workspace.setActiveLeaf(leaf, { focus: true });
    } else {
      if (!leaf) {
        leaf = workspace.getLeaf("tab");
        this.seen.add(leaf);
      }
      await leaf.openFile(file, open);
    }
    for (const id of plan.close) leaves[Number(id)]?.detach();
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL21haW4udHMiLCAiLi4vc3JjL2hvbWVwYWdlLnRzIiwgIi4uL3NyYy9zZXR0aW5ncy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLy8gSG9tZXBhZ2U6IGZpcnN0LXBhcnR5IEhlbGVuaXRlIHBvcnQgb2YgdGhlIE9ic2lkaWFuIEhvbWVwYWdlIHBsdWdpbiAoaWQgYGhvbWVwYWdlYCkuIE9wZW5zIGEgY2hvc2VuIG5vdGUgd2hlblxuLy8gSGVsZW5pdGUgc3RhcnRzLCBmcm9tIGEgY29tbWFuZCBvciByaWJib24gaWNvbiwgYW5kIG9wdGlvbmFsbHkgaW4gZXZlcnkgbmV3IGVtcHR5IHRhYi5cbmltcG9ydCB7IFBsdWdpbiwgVEZpbGUsIHR5cGUgV29ya3NwYWNlTGVhZiB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IHVpIH0gZnJvbSAnaGVsZW5pdGUnO1xuaW1wb3J0IHsgb3BlblN0YXRlRm9yLCBwbGFuT3BlbiwgcmVhZFNldHRpbmdzLCByZXNvbHZlVGFyZ2V0LCB0eXBlIEhvbWVwYWdlU2V0dGluZ3MsIHR5cGUgVGFiSW5mbyB9IGZyb20gJy4vaG9tZXBhZ2UnO1xuaW1wb3J0IHsgSG9tZXBhZ2VTZXR0aW5nVGFiIH0gZnJvbSAnLi9zZXR0aW5ncyc7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEhvbWVwYWdlUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcbiAgc2V0dGluZ3M6IEhvbWVwYWdlU2V0dGluZ3MgPSByZWFkU2V0dGluZ3ModW5kZWZpbmVkKTtcbiAgLyoqIE1haW4tYXJlYSB0YWJzIHRoYXQgZXhpc3RlZCBhbHJlYWR5LCBzbyBvbmx5IHRhYnMgb3BlbmVkIGxhdGVyIGNvdW50IGFzIG5ldy4gKi9cbiAgcHJpdmF0ZSBzZWVuID0gbmV3IFdlYWtTZXQ8V29ya3NwYWNlTGVhZj4oKTtcblxuICBhc3luYyBvbmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5zZXR0aW5ncyA9IHJlYWRTZXR0aW5ncyhhd2FpdCB0aGlzLmxvYWREYXRhKCkpO1xuICAgIHRoaXMuYWRkU2V0dGluZ1RhYihuZXcgSG9tZXBhZ2VTZXR0aW5nVGFiKHRoaXMuYXBwLCB0aGlzKSk7XG4gICAgdGhpcy5hZGRSaWJib25JY29uKCdob21lJywgJ09wZW4gaG9tZXBhZ2UnLCAoKSA9PiB2b2lkIHRoaXMub3BlbkhvbWVwYWdlKCkpO1xuICAgIHRoaXMuYWRkQ29tbWFuZCh7IGlkOiAnb3BlbicsIG5hbWU6ICdPcGVuIGhvbWVwYWdlJywgY2FsbGJhY2s6ICgpID0+IHZvaWQgdGhpcy5vcGVuSG9tZXBhZ2UoKSB9KTtcblxuICAgIC8vIFR1cm5pbmcgdGhlIHBsdWdpbiBvbiBtaWQtc2Vzc2lvbiBpcyBub3QgYSBzdGFydHVwOiBvbmx5IG9wZW4gb24gc3RhcnR1cCB3aGVuIHRoZSBsYXlvdXQgaXMgc3RpbGwgbG9hZGluZy5cbiAgICBjb25zdCBhdFN0YXJ0dXAgPSAhdGhpcy5hcHAud29ya3NwYWNlLmxheW91dFJlYWR5O1xuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbkxheW91dFJlYWR5KGFzeW5jICgpID0+IHtcbiAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5pdGVyYXRlUm9vdExlYXZlcygobGVhZjogV29ya3NwYWNlTGVhZikgPT4gdm9pZCB0aGlzLnNlZW4uYWRkKGxlYWYpKTtcbiAgICAgIGlmIChhdFN0YXJ0dXAgJiYgdGhpcy5zZXR0aW5ncy5vcGVuT25TdGFydHVwKSBhd2FpdCB0aGlzLm9wZW5Ib21lcGFnZSgpO1xuICAgICAgY29uc3QgY2hlY2sgPSAoKSA9PiB0aGlzLmNoZWNrTmV3VGFicygpO1xuICAgICAgdGhpcy5yZWdpc3RlckV2ZW50KHRoaXMuYXBwLndvcmtzcGFjZS5vbignbGF5b3V0LWNoYW5nZScsIGNoZWNrKSk7XG4gICAgICB0aGlzLnJlZ2lzdGVyRXZlbnQodGhpcy5hcHAud29ya3NwYWNlLm9uKCdhY3RpdmUtbGVhZi1jaGFuZ2UnLCBjaGVjaykpO1xuICAgIH0pO1xuICB9XG5cbiAgYXN5bmMgc2F2ZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpO1xuICB9XG5cbiAgLyoqIEEgbWFpbi1hcmVhIHRhYiB0aGF0IGFwcGVhcmVkIHNpbmNlIHRoZSBsYXN0IGNoZWNrIGFuZCBpcyBzdGlsbCBlbXB0eSBvbmNlIGl0cyBvcGVuZXIgaGFzIGhhZCBhIHR1cm4uICovXG4gIHByaXZhdGUgY2hlY2tOZXdUYWJzKCk6IHZvaWQge1xuICAgIGNvbnN0IGZyZXNoOiBXb3Jrc3BhY2VMZWFmW10gPSBbXTtcbiAgICB0aGlzLmFwcC53b3Jrc3BhY2UuaXRlcmF0ZVJvb3RMZWF2ZXMoKGxlYWY6IFdvcmtzcGFjZUxlYWYpID0+IHtcbiAgICAgIGlmICh0aGlzLnNlZW4uaGFzKGxlYWYpKSByZXR1cm47XG4gICAgICB0aGlzLnNlZW4uYWRkKGxlYWYpO1xuICAgICAgZnJlc2gucHVzaChsZWFmKTtcbiAgICB9KTtcbiAgICBpZiAoIXRoaXMuc2V0dGluZ3Mub3BlbkluTmV3VGFiIHx8ICFmcmVzaC5sZW5ndGgpIHJldHVybjtcbiAgICAvLyBBIHRhYiBvcGVuZWQgZm9yIGEgZmlsZSBpcyBlbXB0eSBmb3IgYSBtb21lbnQ7IHdhaXQgdW50aWwgd2hvZXZlciBvcGVuZWQgaXQgaGFzIHNldCBpdHMgdmlldy5cbiAgICB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICBmb3IgKGNvbnN0IGxlYWYgb2YgZnJlc2gpIHtcbiAgICAgICAgaWYgKGxlYWYudmlldz8uZ2V0Vmlld1R5cGUoKSA9PT0gJ2VtcHR5JyAmJiAhKGxlYWYgYXMgYW55KS53b3JraW5nKSB2b2lkIHRoaXMub3BlbkhvbWVwYWdlKGxlYWYpO1xuICAgICAgfVxuICAgIH0sIDApO1xuICB9XG5cbiAgcHJpdmF0ZSB0YWJzKCk6IHsgaW5mbzogVGFiSW5mb1tdOyBsZWF2ZXM6IFdvcmtzcGFjZUxlYWZbXSB9IHtcbiAgICBjb25zdCB3cyA9IHRoaXMuYXBwLndvcmtzcGFjZTtcbiAgICAvLyBhY3RpdmVMZWFmIHdoZW4gaXQgaXMgaW4gdGhlIG1haW4gYXJlYTsgYWN0aXZlVGltZSB0aWVzIHdpdGhpbiBhIG1pbGxpc2Vjb25kIG1ha2UgZ2V0TW9zdFJlY2VudExlYWYgdW5yZWxpYWJsZS5cbiAgICBjb25zdCBhY3RpdmUgPSB3cy5hY3RpdmVMZWFmPy5nZXRSb290KCkgPT09IHdzLnJvb3RTcGxpdCA/IHdzLmFjdGl2ZUxlYWYgOiB3cy5nZXRNb3N0UmVjZW50TGVhZigpO1xuICAgIGNvbnN0IGxlYXZlczogV29ya3NwYWNlTGVhZltdID0gW107XG4gICAgd3MuaXRlcmF0ZVJvb3RMZWF2ZXMoKGxlYWY6IFdvcmtzcGFjZUxlYWYpID0+IHZvaWQgbGVhdmVzLnB1c2gobGVhZikpO1xuICAgIGNvbnN0IGluZm8gPSBsZWF2ZXMubWFwKChsZWFmLCBpKSA9PiAoe1xuICAgICAgaWQ6IFN0cmluZyhpKSxcbiAgICAgIHBhdGg6ICgobGVhZi52aWV3IGFzIGFueSk/LmZpbGUgYXMgVEZpbGUgfCB1bmRlZmluZWQpPy5wYXRoID8/IG51bGwsXG4gICAgICBlbXB0eTogbGVhZi52aWV3Py5nZXRWaWV3VHlwZSgpID09PSAnZW1wdHknLFxuICAgICAgcGlubmVkOiAhIWxlYWYuZ2V0Vmlld1N0YXRlKCkucGlubmVkLFxuICAgICAgYWN0aXZlOiBsZWFmID09PSBhY3RpdmUsXG4gICAgfSkpO1xuICAgIHJldHVybiB7IGluZm8sIGxlYXZlcyB9O1xuICB9XG5cbiAgLyoqIE9wZW4gdGhlIGhvbWVwYWdlIHRoZSB3YXkgdGhlIHNldHRpbmdzIHNheSwgb3IgaW50byBgaW50b2AgKGEgbmV3IGVtcHR5IHRhYikuICovXG4gIGFzeW5jIG9wZW5Ib21lcGFnZShpbnRvPzogV29ya3NwYWNlTGVhZik6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHsgdmF1bHQsIHdvcmtzcGFjZSB9ID0gdGhpcy5hcHA7XG4gICAgY29uc3QgcyA9IHRoaXMuc2V0dGluZ3M7XG4gICAgY29uc3QgcmVzID0gcmVzb2x2ZVRhcmdldChzLCB7XG4gICAgICBleGlzdHM6IChwKSA9PiAhIXZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChwKSxcbiAgICAgIG5vdGVzOiAoKSA9PiB2YXVsdC5nZXRNYXJrZG93bkZpbGVzKCkubWFwKChmKSA9PiBmLnBhdGgpLFxuICAgICAgcmFuZG9tOiBNYXRoLnJhbmRvbSxcbiAgICB9KTtcbiAgICBpZiAoIXJlcy5vaykge1xuICAgICAgdWkubm90aWNlKGBDb3VsZCBub3Qgb3BlbiB0aGUgaG9tZXBhZ2UuICR7cmVzLnJlYXNvbn1gLCB7IGtpbmQ6ICdlcnJvcicgfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGxldCBmaWxlID0gdmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKHJlcy5wYXRoKTtcbiAgICBpZiAocmVzLmNyZWF0ZSkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgZGlyID0gcmVzLnBhdGguaW5jbHVkZXMoJy8nKSA/IHJlcy5wYXRoLnNsaWNlKDAsIHJlcy5wYXRoLmxhc3RJbmRleE9mKCcvJykpIDogJyc7XG4gICAgICAgIGlmIChkaXIgJiYgIXZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChkaXIpKSBhd2FpdCB2YXVsdC5jcmVhdGVGb2xkZXIoZGlyKTtcbiAgICAgICAgZmlsZSA9IGF3YWl0IHZhdWx0LmNyZWF0ZShyZXMucGF0aCwgJycpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICB1aS5ub3RpY2UoYENvdWxkIG5vdCBjcmVhdGUgJHtyZXMucGF0aH06ICR7ZSBpbnN0YW5jZW9mIEVycm9yID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpfWAsIHsga2luZDogJ2Vycm9yJyB9KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIShmaWxlIGluc3RhbmNlb2YgVEZpbGUpKSB7XG4gICAgICB1aS5ub3RpY2UoYENvdWxkIG5vdCBvcGVuIHRoZSBob21lcGFnZS4gJHtyZXMucGF0aH0gaXMgbm90IGEgZmlsZS5gLCB7IGtpbmQ6ICdlcnJvcicgfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IG9wZW4gPSB7IC4uLm9wZW5TdGF0ZUZvcihzLnZpZXcpLCBhY3RpdmU6IHRydWUgfTtcbiAgICBpZiAoaW50bykge1xuICAgICAgYXdhaXQgaW50by5vcGVuRmlsZShmaWxlLCBvcGVuKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCB7IGluZm8sIGxlYXZlcyB9ID0gdGhpcy50YWJzKCk7XG4gICAgY29uc3QgcGxhbiA9IHBsYW5PcGVuKGluZm8sIGZpbGUucGF0aCwgcy5vcGVuTW9kZSwgcy5yZWZyZXNoKTtcbiAgICBsZXQgbGVhZiA9IHBsYW4ubGVhZiAhPT0gbnVsbCA/IGxlYXZlc1tOdW1iZXIocGxhbi5sZWFmKV0gOiBudWxsO1xuICAgIGlmIChsZWFmICYmIHBsYW4uYWN0aW9uICE9PSAnb3BlbicpIHtcbiAgICAgIGlmIChwbGFuLmFjdGlvbiA9PT0gJ3JlbG9hZCcpIGF3YWl0IChsZWFmIGFzIGFueSkucmVidWlsZFZpZXc/LigpO1xuICAgICAgd29ya3NwYWNlLnNldEFjdGl2ZUxlYWYobGVhZiwgeyBmb2N1czogdHJ1ZSB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCFsZWFmKSB7XG4gICAgICAgIGxlYWYgPSB3b3Jrc3BhY2UuZ2V0TGVhZigndGFiJyk7XG4gICAgICAgIHRoaXMuc2Vlbi5hZGQobGVhZik7XG4gICAgICB9XG4gICAgICBhd2FpdCBsZWFmLm9wZW5GaWxlKGZpbGUsIG9wZW4pO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGlkIG9mIHBsYW4uY2xvc2UpIGxlYXZlc1tOdW1iZXIoaWQpXT8uZGV0YWNoKCk7XG4gIH1cbn1cbiIsICIvLyBXaGF0IHRoZSBob21lcGFnZSBpcyBhbmQgd2hlcmUgaXQgb3BlbnMuIFB1cmU6IG5vIERPTSwgbm8gT2JzaWRpYW4gQVBJLCBzbyBpdCBpcyB1bml0LXRlc3RlZCBvbiBpdHMgb3duLlxuXG5leHBvcnQgdHlwZSBIb21lcGFnZUtpbmQgPSAnbm90ZScgfCAncmFuZG9tJztcbi8qKiBSZXBsYWNlIGV2ZXJ5IG9wZW4gdGFiLCByZXBsYWNlIHRoZSB0YWIgaW4gdXNlLCBvciBrZWVwIHRhYnMgYW5kIG9wZW4gYSBuZXcgb25lLiAqL1xuZXhwb3J0IHR5cGUgT3Blbk1vZGUgPSAncmVwbGFjZS1hbGwnIHwgJ3JlcGxhY2UtbGFzdCcgfCAna2VlcCc7XG5leHBvcnQgdHlwZSBWaWV3TW9kZSA9ICdkZWZhdWx0JyB8ICdyZWFkaW5nJyB8ICdlZGl0aW5nJztcbi8qKiBXaGVuIHRoZSBob21lcGFnZSBpcyBhbHJlYWR5IG9wZW46IHN3aXRjaCB0byB0aGF0IHRhYiwgc3dpdGNoIGFuZCByZWxvYWQgaXQsIG9yIG9wZW4gYW5vdGhlciBjb3B5LiAqL1xuZXhwb3J0IHR5cGUgUmVmcmVzaE1vZGUgPSAnc3dpdGNoJyB8ICdyZWxvYWQnIHwgJ2R1cGxpY2F0ZSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSG9tZXBhZ2VTZXR0aW5ncyB7XG4gIGtpbmQ6IEhvbWVwYWdlS2luZDtcbiAgLyoqIFZhdWx0IHBhdGggb2YgdGhlIG5vdGUsIGFzIHR5cGVkOiBgSG9tZWAsIGBIb21lLm1kYCwgYFtbSG9tZV1dYCBhbmQgYC9Ib21lLm1kYCBhbGwgbWVhbiBgSG9tZS5tZGAuICovXG4gIHRhcmdldDogc3RyaW5nO1xuICBvcGVuT25TdGFydHVwOiBib29sZWFuO1xuICBvcGVuSW5OZXdUYWI6IGJvb2xlYW47XG4gIG9wZW5Nb2RlOiBPcGVuTW9kZTtcbiAgdmlldzogVmlld01vZGU7XG4gIHJlZnJlc2g6IFJlZnJlc2hNb2RlO1xuICBjcmVhdGVJZk1pc3Npbmc6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjb25zdCBERUZBVUxUX1NFVFRJTkdTOiBIb21lcGFnZVNldHRpbmdzID0ge1xuICBraW5kOiAnbm90ZScsXG4gIHRhcmdldDogJ0hvbWUnLFxuICBvcGVuT25TdGFydHVwOiB0cnVlLFxuICBvcGVuSW5OZXdUYWI6IGZhbHNlLFxuICBvcGVuTW9kZTogJ3JlcGxhY2UtYWxsJyxcbiAgdmlldzogJ2RlZmF1bHQnLFxuICByZWZyZXNoOiAnc3dpdGNoJyxcbiAgY3JlYXRlSWZNaXNzaW5nOiB0cnVlLFxufTtcblxuLyoqIFNhdmVkIGRhdGEgXHUyMTkyIHNldHRpbmdzLCBkcm9wcGluZyB1bmtub3duIG9yIGludmFsaWQgdmFsdWVzIGluIGZhdm91ciBvZiB0aGUgZGVmYXVsdHMuICovXG5leHBvcnQgZnVuY3Rpb24gcmVhZFNldHRpbmdzKHNhdmVkOiB1bmtub3duKTogSG9tZXBhZ2VTZXR0aW5ncyB7XG4gIGNvbnN0IHMgPSAoc2F2ZWQgJiYgdHlwZW9mIHNhdmVkID09PSAnb2JqZWN0JyA/IHNhdmVkIDoge30pIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuICBjb25zdCBwaWNrID0gPFQgZXh0ZW5kcyBzdHJpbmc+KHY6IHVua25vd24sIGFsbG93ZWQ6IHJlYWRvbmx5IFRbXSwgZDogVCk6IFQgPT4gKGFsbG93ZWQuaW5jbHVkZXModiBhcyBUKSA/ICh2IGFzIFQpIDogZCk7XG4gIGNvbnN0IGJvb2wgPSAodjogdW5rbm93biwgZDogYm9vbGVhbik6IGJvb2xlYW4gPT4gKHR5cGVvZiB2ID09PSAnYm9vbGVhbicgPyB2IDogZCk7XG4gIGNvbnN0IEQgPSBERUZBVUxUX1NFVFRJTkdTO1xuICByZXR1cm4ge1xuICAgIGtpbmQ6IHBpY2socy5raW5kLCBbJ25vdGUnLCAncmFuZG9tJ10sIEQua2luZCksXG4gICAgdGFyZ2V0OiB0eXBlb2Ygcy50YXJnZXQgPT09ICdzdHJpbmcnID8gcy50YXJnZXQgOiBELnRhcmdldCxcbiAgICBvcGVuT25TdGFydHVwOiBib29sKHMub3Blbk9uU3RhcnR1cCwgRC5vcGVuT25TdGFydHVwKSxcbiAgICBvcGVuSW5OZXdUYWI6IGJvb2wocy5vcGVuSW5OZXdUYWIsIEQub3BlbkluTmV3VGFiKSxcbiAgICBvcGVuTW9kZTogcGljayhzLm9wZW5Nb2RlLCBbJ3JlcGxhY2UtYWxsJywgJ3JlcGxhY2UtbGFzdCcsICdrZWVwJ10sIEQub3Blbk1vZGUpLFxuICAgIHZpZXc6IHBpY2socy52aWV3LCBbJ2RlZmF1bHQnLCAncmVhZGluZycsICdlZGl0aW5nJ10sIEQudmlldyksXG4gICAgcmVmcmVzaDogcGljayhzLnJlZnJlc2gsIFsnc3dpdGNoJywgJ3JlbG9hZCcsICdkdXBsaWNhdGUnXSwgRC5yZWZyZXNoKSxcbiAgICBjcmVhdGVJZk1pc3Npbmc6IGJvb2wocy5jcmVhdGVJZk1pc3NpbmcsIEQuY3JlYXRlSWZNaXNzaW5nKSxcbiAgfTtcbn1cblxuLyoqIGBbW0hvbWV8YWxpYXNdXWAsIGAvSG9tZWAsIGAgSG9tZS5tZCBgIFx1MjE5MiBgSG9tZS5tZGAuIEVtcHR5IGlucHV0IHN0YXlzIGVtcHR5LiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG5vcm1hbGl6ZVRhcmdldChpbnB1dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgbGV0IHAgPSBpbnB1dC50cmltKCk7XG4gIGNvbnN0IGxpbmsgPSAvXlxcW1xcWyhbXlxcXXwjXSspKD86WyN8XVteXFxdXSopP1xcXVxcXSQvLmV4ZWMocCk7XG4gIGlmIChsaW5rKSBwID0gbGlua1sxXS50cmltKCk7XG4gIHAgPSBwLnJlcGxhY2UoL1xcXFwvZywgJy8nKS5yZXBsYWNlKC9eXFwvKy8sICcnKS5yZXBsYWNlKC9cXC97Mix9L2csICcvJyk7XG4gIGlmICghcCkgcmV0dXJuICcnO1xuICBjb25zdCBuYW1lID0gcC5zbGljZShwLmxhc3RJbmRleE9mKCcvJykgKyAxKTtcbiAgcmV0dXJuIC9cXC5bQS1aYS16MC05XSskLy50ZXN0KG5hbWUpID8gcCA6IGAke3B9Lm1kYDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBWYXVsdExvb2t1cCB7XG4gIGV4aXN0cyhwYXRoOiBzdHJpbmcpOiBib29sZWFuO1xuICAvKiogQWxsIG1hcmtkb3duIG5vdGVzLCBmb3IgYSByYW5kb20gcGljay4gKi9cbiAgbm90ZXMoKTogc3RyaW5nW107XG4gIC8qKiBBIG51bWJlciBpbiBbMCwgMSk7IE1hdGgucmFuZG9tIGluIHRoZSBhcHAsIGZpeGVkIGluIHRlc3RzLiAqL1xuICByYW5kb20oKTogbnVtYmVyO1xufVxuXG5leHBvcnQgdHlwZSBSZXNvbHV0aW9uID0geyBvazogdHJ1ZTsgcGF0aDogc3RyaW5nOyBjcmVhdGU6IGJvb2xlYW4gfSB8IHsgb2s6IGZhbHNlOyByZWFzb246IHN0cmluZyB9O1xuXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZVRhcmdldChzOiBIb21lcGFnZVNldHRpbmdzLCB2YXVsdDogVmF1bHRMb29rdXApOiBSZXNvbHV0aW9uIHtcbiAgaWYgKHMua2luZCA9PT0gJ3JhbmRvbScpIHtcbiAgICBjb25zdCBub3RlcyA9IHZhdWx0Lm5vdGVzKCk7XG4gICAgaWYgKCFub3Rlcy5sZW5ndGgpIHJldHVybiB7IG9rOiBmYWxzZSwgcmVhc29uOiAnVGhlcmUgYXJlIG5vIG5vdGVzIHRvIHBpY2sgZnJvbS4nIH07XG4gICAgcmV0dXJuIHsgb2s6IHRydWUsIHBhdGg6IG5vdGVzW01hdGgubWluKG5vdGVzLmxlbmd0aCAtIDEsIE1hdGguZmxvb3IodmF1bHQucmFuZG9tKCkgKiBub3Rlcy5sZW5ndGgpKV0sIGNyZWF0ZTogZmFsc2UgfTtcbiAgfVxuICBjb25zdCBwYXRoID0gbm9ybWFsaXplVGFyZ2V0KHMudGFyZ2V0KTtcbiAgaWYgKCFwYXRoKSByZXR1cm4geyBvazogZmFsc2UsIHJlYXNvbjogJ0Nob29zZSBhIGhvbWVwYWdlIG5vdGUgaW4gU2V0dGluZ3MsIEhvbWVwYWdlLicgfTtcbiAgaWYgKHZhdWx0LmV4aXN0cyhwYXRoKSkgcmV0dXJuIHsgb2s6IHRydWUsIHBhdGgsIGNyZWF0ZTogZmFsc2UgfTtcbiAgaWYgKHMuY3JlYXRlSWZNaXNzaW5nICYmIHBhdGguZW5kc1dpdGgoJy5tZCcpKSByZXR1cm4geyBvazogdHJ1ZSwgcGF0aCwgY3JlYXRlOiB0cnVlIH07XG4gIHJldHVybiB7IG9rOiBmYWxzZSwgcmVhc29uOiBgJHtwYXRofSBkb2VzIG5vdCBleGlzdC5gIH07XG59XG5cbi8qKiBPbmUgdGFiIGluIHRoZSBtYWluIGFyZWEsIGFzIHRoZSBwbGFuIHNlZXMgaXQuICovXG5leHBvcnQgaW50ZXJmYWNlIFRhYkluZm8ge1xuICBpZDogc3RyaW5nO1xuICAvKiogVGhlIG9wZW4gZmlsZSdzIHBhdGgsIG9yIG51bGwgZm9yIGFuIGVtcHR5IHRhYiBvciBhIHZpZXcgd2l0aG91dCBhIGZpbGUuICovXG4gIHBhdGg6IHN0cmluZyB8IG51bGw7XG4gIGVtcHR5OiBib29sZWFuO1xuICBwaW5uZWQ6IGJvb2xlYW47XG4gIGFjdGl2ZTogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBPcGVuUGxhbiB7XG4gIC8qKiBmb2N1czogc2hvdyBgbGVhZmAgYXMgaXMuIHJlbG9hZDogc2hvdyBgbGVhZmAgYW5kIGxvYWQgdGhlIG5vdGUgYWdhaW4uIG9wZW46IGxvYWQgdGhlIG5vdGUgaW50byBgbGVhZmAsIG9yIGludG8gYVxuICAgKiAgbmV3IHRhYiB3aGVuIGBsZWFmYCBpcyBudWxsLiAqL1xuICBhY3Rpb246ICdmb2N1cycgfCAncmVsb2FkJyB8ICdvcGVuJztcbiAgbGVhZjogc3RyaW5nIHwgbnVsbDtcbiAgLyoqIFRhYnMgdG8gY2xvc2UgZmlyc3QuIFBpbm5lZCB0YWJzIGFyZSBuZXZlciBjbG9zZWQuICovXG4gIGNsb3NlOiBzdHJpbmdbXTtcbn1cblxuLyoqIERlY2lkZSB3aGljaCB0YWIgZ2V0cyB0aGUgaG9tZXBhZ2UgYW5kIHdoaWNoIHRhYnMgY2xvc2UuICovXG5leHBvcnQgZnVuY3Rpb24gcGxhbk9wZW4odGFiczogVGFiSW5mb1tdLCBwYXRoOiBzdHJpbmcsIG1vZGU6IE9wZW5Nb2RlLCByZWZyZXNoOiBSZWZyZXNoTW9kZSk6IE9wZW5QbGFuIHtcbiAgY29uc3QgY2xvc2FibGUgPSAoa2VlcDogc3RyaW5nIHwgbnVsbCkgPT4gKG1vZGUgPT09ICdyZXBsYWNlLWFsbCcgPyB0YWJzLmZpbHRlcigodCkgPT4gdC5pZCAhPT0ga2VlcCAmJiAhdC5waW5uZWQpLm1hcCgodCkgPT4gdC5pZCkgOiBbXSk7XG4gIGNvbnN0IGV4aXN0aW5nID0gcmVmcmVzaCA9PT0gJ2R1cGxpY2F0ZScgPyB1bmRlZmluZWQgOiB0YWJzLmZpbmQoKHQpID0+IHQucGF0aCA9PT0gcGF0aCk7XG4gIGlmIChleGlzdGluZykgcmV0dXJuIHsgYWN0aW9uOiByZWZyZXNoID09PSAncmVsb2FkJyA/ICdyZWxvYWQnIDogJ2ZvY3VzJywgbGVhZjogZXhpc3RpbmcuaWQsIGNsb3NlOiBjbG9zYWJsZShleGlzdGluZy5pZCkgfTtcblxuICBjb25zdCBhY3RpdmUgPSB0YWJzLmZpbmQoKHQpID0+IHQuYWN0aXZlKSA/PyBudWxsO1xuICBjb25zdCB1c2FibGUgPSAodDogVGFiSW5mbyB8IG51bGwgfCB1bmRlZmluZWQpID0+ICh0ICYmICF0LnBpbm5lZCA/IHQgOiBudWxsKTtcbiAgbGV0IGxlYWY6IFRhYkluZm8gfCBudWxsO1xuICBpZiAobW9kZSA9PT0gJ2tlZXAnKSBsZWFmID0gYWN0aXZlPy5lbXB0eSA/IGFjdGl2ZSA6IG51bGw7XG4gIGVsc2UgaWYgKG1vZGUgPT09ICdyZXBsYWNlLWxhc3QnKSBsZWFmID0gdXNhYmxlKGFjdGl2ZSk7XG4gIGVsc2UgbGVhZiA9IHVzYWJsZShhY3RpdmUpID8/IHRhYnMuZmluZCgodCkgPT4gIXQucGlubmVkKSA/PyBudWxsO1xuICByZXR1cm4geyBhY3Rpb246ICdvcGVuJywgbGVhZjogbGVhZj8uaWQgPz8gbnVsbCwgY2xvc2U6IGNsb3NhYmxlKGxlYWY/LmlkID8/IG51bGwpIH07XG59XG5cbi8qKiBUaGUgb3BlbiBzdGF0ZSBmb3IgYGxlYWYub3BlbkZpbGVgOiByZWFkaW5nIG9yIGVkaXRpbmcgbW9kZSwgb3Igbm90aGluZyBzbyB0aGUgbm90ZSBvcGVucyB0aGUgYXBwJ3MgZGVmYXVsdCB3YXkuICovXG5leHBvcnQgZnVuY3Rpb24gb3BlblN0YXRlRm9yKHZpZXc6IFZpZXdNb2RlKTogeyBzdGF0ZT86IHsgbW9kZTogJ3ByZXZpZXcnIHwgJ3NvdXJjZScgfSB9IHtcbiAgaWYgKHZpZXcgPT09ICdyZWFkaW5nJykgcmV0dXJuIHsgc3RhdGU6IHsgbW9kZTogJ3ByZXZpZXcnIH0gfTtcbiAgaWYgKHZpZXcgPT09ICdlZGl0aW5nJykgcmV0dXJuIHsgc3RhdGU6IHsgbW9kZTogJ3NvdXJjZScgfSB9O1xuICByZXR1cm4ge307XG59XG4iLCAiLy8gSG9tZXBhZ2Ugc2V0dGluZ3MgdGFiLCBidWlsdCBmcm9tIHRoZSBkZXNpZ24gc3lzdGVtJ3Mgc2V0dGluZ3MgcGFydHMuXG5pbXBvcnQgeyBBYnN0cmFjdElucHV0U3VnZ2VzdCwgUGx1Z2luU2V0dGluZ1RhYiwgVEZpbGUsIHR5cGUgQXBwIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgdWkgfSBmcm9tICdoZWxlbml0ZSc7XG5pbXBvcnQgeyBub3JtYWxpemVUYXJnZXQsIHR5cGUgSG9tZXBhZ2VLaW5kLCB0eXBlIE9wZW5Nb2RlLCB0eXBlIFJlZnJlc2hNb2RlLCB0eXBlIFZpZXdNb2RlIH0gZnJvbSAnLi9ob21lcGFnZSc7XG5pbXBvcnQgdHlwZSBIb21lcGFnZVBsdWdpbiBmcm9tICcuL21haW4nO1xuXG4vKiogU3VnZ2VzdHMgbWFya2Rvd24gbm90ZXMgd2hpbGUgdHlwaW5nIHRoZSBob21lcGFnZSdzIHBhdGguICovXG5jbGFzcyBOb3RlU3VnZ2VzdCBleHRlbmRzIEFic3RyYWN0SW5wdXRTdWdnZXN0PFRGaWxlPiB7XG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwcml2YXRlIGlucHV0OiBIVE1MSW5wdXRFbGVtZW50LCBwcml2YXRlIHBpY2s6IChwYXRoOiBzdHJpbmcpID0+IHZvaWQpIHtcbiAgICBzdXBlcihhcHAsIGlucHV0KTtcbiAgfVxuXG4gIGdldFN1Z2dlc3Rpb25zKHF1ZXJ5OiBzdHJpbmcpOiBURmlsZVtdIHtcbiAgICBjb25zdCBxID0gcXVlcnkudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG4gICAgcmV0dXJuIHRoaXMuYXBwLnZhdWx0XG4gICAgICAuZ2V0TWFya2Rvd25GaWxlcygpXG4gICAgICAuZmlsdGVyKChmKSA9PiBmLnBhdGgudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKSlcbiAgICAgIC5zb3J0KChhLCBiKSA9PiBhLnBhdGgubGVuZ3RoIC0gYi5wYXRoLmxlbmd0aClcbiAgICAgIC5zbGljZSgwLCA1MCk7XG4gIH1cblxuICByZW5kZXJTdWdnZXN0aW9uKGZpbGU6IFRGaWxlLCBlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5zZXRUZXh0KGZpbGUucGF0aC5yZXBsYWNlKC9cXC5tZCQvLCAnJykpO1xuICB9XG5cbiAgc2VsZWN0U3VnZ2VzdGlvbihmaWxlOiBURmlsZSk6IHZvaWQge1xuICAgIGNvbnN0IHZhbHVlID0gZmlsZS5wYXRoLnJlcGxhY2UoL1xcLm1kJC8sICcnKTtcbiAgICB0aGlzLmlucHV0LnZhbHVlID0gdmFsdWU7XG4gICAgdGhpcy5waWNrKHZhbHVlKTtcbiAgICB0aGlzLmNsb3NlKCk7XG4gIH1cbn1cblxuY29uc3QgT1BFTl9NT0RFUzogUmVjb3JkPE9wZW5Nb2RlLCBzdHJpbmc+ID0ge1xuICAncmVwbGFjZS1hbGwnOiAnUmVwbGFjZSBhbGwgb3BlbiB0YWJzJyxcbiAgJ3JlcGxhY2UtbGFzdCc6ICdSZXBsYWNlIHRoZSBjdXJyZW50IHRhYicsXG4gIGtlZXA6ICdLZWVwIHRhYnMsIG9wZW4gYSBuZXcgb25lJyxcbn07XG5cbmNvbnN0IFJFRlJFU0hfTU9ERVM6IFJlY29yZDxSZWZyZXNoTW9kZSwgc3RyaW5nPiA9IHtcbiAgc3dpdGNoOiAnU3dpdGNoIHRvIGl0JyxcbiAgcmVsb2FkOiAnU3dpdGNoIHRvIGl0IGFuZCByZWxvYWQgaXQnLFxuICBkdXBsaWNhdGU6ICdPcGVuIGl0IGFnYWluJyxcbn07XG5cbmV4cG9ydCBjbGFzcyBIb21lcGFnZVNldHRpbmdUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcbiAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHByaXZhdGUgcGx1Z2luOiBIb21lcGFnZVBsdWdpbikge1xuICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcbiAgfVxuXG4gIHByaXZhdGUgc2V0PEsgZXh0ZW5kcyBrZXlvZiBIb21lcGFnZVBsdWdpblsnc2V0dGluZ3MnXT4oa2V5OiBLLCB2YWx1ZTogSG9tZXBhZ2VQbHVnaW5bJ3NldHRpbmdzJ11bS10pOiB2b2lkIHtcbiAgICB0aGlzLnBsdWdpbi5zZXR0aW5nc1trZXldID0gdmFsdWU7XG4gICAgdm9pZCB0aGlzLnBsdWdpbi5zYXZlKCk7XG4gIH1cblxuICBkaXNwbGF5KCk6IHZvaWQge1xuICAgIGNvbnN0IGVsID0gdGhpcy5jb250YWluZXJFbDtcbiAgICBlbC5lbXB0eSgpO1xuICAgIGNvbnN0IHMgPSB0aGlzLnBsdWdpbi5zZXR0aW5ncztcblxuICAgIGNvbnN0IHdoYXQgPSB1aS5zZXR0aW5ncy5zZWN0aW9uKGVsLCAnSG9tZXBhZ2UnKTtcbiAgICBjb25zdCBraW5kID0gbmV3IHVpLnNldHRpbmdzLnJvdyh3aGF0KS5zZXROYW1lKCdPcGVuJykuc2V0RGVzYygnQSBjaG9zZW4gbm90ZSwgb3IgYSBkaWZmZXJlbnQgcmFuZG9tIG5vdGUgZWFjaCB0aW1lLicpO1xuICAgIHVpLnNlZ21lbnRlZDxIb21lcGFnZUtpbmQ+KGtpbmQuY29udHJvbEVsLCB7XG4gICAgICB2YWx1ZTogcy5raW5kLFxuICAgICAgb3B0aW9uczogW1xuICAgICAgICB7IHZhbHVlOiAnbm90ZScsIHRleHQ6ICdBIG5vdGUnIH0sXG4gICAgICAgIHsgdmFsdWU6ICdyYW5kb20nLCB0ZXh0OiAnQSByYW5kb20gbm90ZScgfSxcbiAgICAgIF0sXG4gICAgICBvbkNoYW5nZTogKHYpID0+IHtcbiAgICAgICAgdGhpcy5zZXQoJ2tpbmQnLCB2KTtcbiAgICAgICAgdGhpcy5kaXNwbGF5KCk7XG4gICAgICB9LFxuICAgIH0pO1xuICAgIGlmIChzLmtpbmQgPT09ICdub3RlJykge1xuICAgICAgY29uc3Qgbm90ZSA9IG5ldyB1aS5zZXR0aW5ncy5yb3cod2hhdCkuc2V0TmFtZSgnTm90ZScpLnNldERlc2ModGhpcy5ub3RlRGVzYyhzLnRhcmdldCkpO1xuICAgICAgbm90ZS5hZGRUZXh0KCh0KSA9PiB7XG4gICAgICAgIHQuc2V0UGxhY2Vob2xkZXIoJ0hvbWUnKS5zZXRWYWx1ZShzLnRhcmdldCk7XG4gICAgICAgIGNvbnN0IGNvbW1pdCA9ICh2OiBzdHJpbmcpID0+IHtcbiAgICAgICAgICB0aGlzLnNldCgndGFyZ2V0Jywgdi50cmltKCkpO1xuICAgICAgICAgIG5vdGUuc2V0RGVzYyh0aGlzLm5vdGVEZXNjKHYpKTtcbiAgICAgICAgfTtcbiAgICAgICAgdC5vbkNoYW5nZShjb21taXQpO1xuICAgICAgICBuZXcgTm90ZVN1Z2dlc3QodGhpcy5hcHAsIHQuaW5wdXRFbCwgY29tbWl0KTtcbiAgICAgIH0pO1xuICAgICAgbmV3IHVpLnNldHRpbmdzLnJvdyh3aGF0KVxuICAgICAgICAuc2V0TmFtZSgnQ3JlYXRlIHRoZSBub3RlIGlmIGl0IGlzIG1pc3NpbmcnKVxuICAgICAgICAuc2V0RGVzYygnT2ZmIHNob3dzIGFuIGVycm9yIGluc3RlYWQuJylcbiAgICAgICAgLmFkZFRvZ2dsZSgodCkgPT4gdC5zZXRWYWx1ZShzLmNyZWF0ZUlmTWlzc2luZykub25DaGFuZ2UoKHYpID0+IHRoaXMuc2V0KCdjcmVhdGVJZk1pc3NpbmcnLCB2KSkpO1xuICAgIH1cblxuICAgIGNvbnN0IHdoZW4gPSB1aS5zZXR0aW5ncy5zZWN0aW9uKGVsLCAnV2hlbiB0byBvcGVuIGl0Jyk7XG4gICAgbmV3IHVpLnNldHRpbmdzLnJvdyh3aGVuKVxuICAgICAgLnNldE5hbWUoJ1doZW4gSGVsZW5pdGUgc3RhcnRzJylcbiAgICAgIC5hZGRUb2dnbGUoKHQpID0+IHQuc2V0VmFsdWUocy5vcGVuT25TdGFydHVwKS5vbkNoYW5nZSgodikgPT4gdGhpcy5zZXQoJ29wZW5PblN0YXJ0dXAnLCB2KSkpO1xuICAgIG5ldyB1aS5zZXR0aW5ncy5yb3cod2hlbilcbiAgICAgIC5zZXROYW1lKCdJbiBuZXcgZW1wdHkgdGFicycpXG4gICAgICAuc2V0RGVzYygnQSBuZXcgdGFiIHNob3dzIHRoZSBob21lcGFnZSBpbnN0ZWFkIG9mIGFuIGVtcHR5IHBhZ2UuJylcbiAgICAgIC5hZGRUb2dnbGUoKHQpID0+IHQuc2V0VmFsdWUocy5vcGVuSW5OZXdUYWIpLm9uQ2hhbmdlKCh2KSA9PiB0aGlzLnNldCgnb3BlbkluTmV3VGFiJywgdikpKTtcblxuICAgIGNvbnN0IGhvdyA9IHVpLnNldHRpbmdzLnNlY3Rpb24oZWwsICdIb3cgdG8gb3BlbiBpdCcpO1xuICAgIG5ldyB1aS5zZXR0aW5ncy5yb3coaG93KVxuICAgICAgLnNldE5hbWUoJ1RhYnMnKVxuICAgICAgLnNldERlc2MoJ1doYXQgaGFwcGVucyB0byB0aGUgdGFicyBhbHJlYWR5IG9wZW4uIFBpbm5lZCB0YWJzIGFsd2F5cyBzdGF5LicpXG4gICAgICAuYWRkRHJvcGRvd24oKGQpID0+IGQuYWRkT3B0aW9ucyhPUEVOX01PREVTKS5zZXRWYWx1ZShzLm9wZW5Nb2RlKS5vbkNoYW5nZSgodikgPT4gdGhpcy5zZXQoJ29wZW5Nb2RlJywgdiBhcyBPcGVuTW9kZSkpKTtcbiAgICBuZXcgdWkuc2V0dGluZ3Mucm93KGhvdylcbiAgICAgIC5zZXROYW1lKCdJZiBpdCBpcyBhbHJlYWR5IG9wZW4nKVxuICAgICAgLmFkZERyb3Bkb3duKChkKSA9PiBkLmFkZE9wdGlvbnMoUkVGUkVTSF9NT0RFUykuc2V0VmFsdWUocy5yZWZyZXNoKS5vbkNoYW5nZSgodikgPT4gdGhpcy5zZXQoJ3JlZnJlc2gnLCB2IGFzIFJlZnJlc2hNb2RlKSkpO1xuICAgIGNvbnN0IHZpZXcgPSBuZXcgdWkuc2V0dGluZ3Mucm93KGhvdykuc2V0TmFtZSgnVmlldycpLnNldERlc2MoJ0RlZmF1bHQgdXNlcyB0aGUgbW9kZSBzZXQgaW4gRWRpdG9yIHNldHRpbmdzLicpO1xuICAgIHVpLnNlZ21lbnRlZDxWaWV3TW9kZT4odmlldy5jb250cm9sRWwsIHtcbiAgICAgIHZhbHVlOiBzLnZpZXcsXG4gICAgICBvcHRpb25zOiBbXG4gICAgICAgIHsgdmFsdWU6ICdkZWZhdWx0JywgdGV4dDogJ0RlZmF1bHQnIH0sXG4gICAgICAgIHsgdmFsdWU6ICdyZWFkaW5nJywgdGV4dDogJ1JlYWRpbmcnIH0sXG4gICAgICAgIHsgdmFsdWU6ICdlZGl0aW5nJywgdGV4dDogJ0VkaXRpbmcnIH0sXG4gICAgICBdLFxuICAgICAgb25DaGFuZ2U6ICh2KSA9PiB0aGlzLnNldCgndmlldycsIHYpLFxuICAgIH0pO1xuXG4gICAgY29uc3Qgbm93ID0gbmV3IHVpLnNldHRpbmdzLnJvdyhob3cpLnNldE5hbWUoJ09wZW4gdGhlIGhvbWVwYWdlIG5vdycpO1xuICAgIHVpLmFjdGlvbihub3cuY29udHJvbEVsLCAnb3BlbicsIHsgb25DbGljazogKCkgPT4gdGhpcy5wbHVnaW4ub3BlbkhvbWVwYWdlKCkgfSk7XG4gIH1cblxuICBwcml2YXRlIG5vdGVEZXNjKHRhcmdldDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCBwYXRoID0gbm9ybWFsaXplVGFyZ2V0KHRhcmdldCk7XG4gICAgaWYgKCFwYXRoKSByZXR1cm4gJ1R5cGUgYSBub3RlIG5hbWUgb3IgcGF0aC4nO1xuICAgIHJldHVybiB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgocGF0aCkgPyBgT3BlbnMgJHtwYXRofS5gIDogYCR7cGF0aH0gZG9lcyBub3QgZXhpc3QgeWV0LmA7XG4gIH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUVBLElBQUFBLG1CQUFrRDtBQUNsRCxJQUFBQyxtQkFBbUI7OztBQ2tCWixJQUFNLG1CQUFxQztBQUFBLEVBQ2hELE1BQU07QUFBQSxFQUNOLFFBQVE7QUFBQSxFQUNSLGVBQWU7QUFBQSxFQUNmLGNBQWM7QUFBQSxFQUNkLFVBQVU7QUFBQSxFQUNWLE1BQU07QUFBQSxFQUNOLFNBQVM7QUFBQSxFQUNULGlC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QWEsRUFBRSxJQUFJLEdBQUcsUUFBUSxLQUFLO0FBQ3JELFFBQUksTUFBTTtBQUNSLFlBQU0sS0FBSyxTQUFTLE1BQU0sSUFBSTtBQUM5QjtBQUFBLElBQ0Y7QUFFQSxVQUFNLEVBQUUsTUFBTSxPQUFPLElBQUksS0FBSyxLQUFLO0FBQ25DLFVBQU0sT0FBTyxTQUFTLE1BQU0sS0FBSyxNQUFNLEVBQUUsVUFBVSxFQUFFLE9BQU87QUFDNUQsUUFBSSxPQUFPLEtBQUssU0FBUyxPQUFPLE9BQU8sT0FBTyxLQUFLLElBQUksQ0FBQyxJQUFJO0FBQzVELFFBQUksUUFBUSxLQUFLLFdBQVcsUUFBUTtBQUNsQyxVQUFJLEtBQUssV0FBVyxTQUFVLE9BQU8sS0FBYSxjQUFjO0FBQ2hFLGdCQUFVLGNBQWMsTUFBTSxFQUFFLE9BQU8sS0FBSyxDQUFDO0FBQUEsSUFDL0MsT0FBTztBQUNMLFVBQUksQ0FBQyxNQUFNO0FBQ1QsZUFBTyxVQUFVLFFBQVEsS0FBSztBQUM5QixhQUFLLEtBQUssSUFBSSxJQUFJO0FBQUEsTUFDcEI7QUFDQSxZQUFNLEtBQUssU0FBUyxNQUFNLElBQUk7QUFBQSxJQUNoQztBQUNBLGVBQVcsTUFBTSxLQUFLLE1BQU8sUUFBTyxPQUFPLEVBQUUsQ0FBQyxHQUFHLE9BQU87QUFBQSxFQUMxRDtBQUNGOyIsCiAgIm5hbWVzIjogWyJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X2hlbGVuaXRlIl0KfQo=
