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
var import_obsidian = require("obsidian");
var import_helenite = require("helenite");
var SampleDesignSystemPlugin = class extends import_obsidian.Plugin {
  data = { items: [], editingDefaults: false };
  async onload() {
    const saved = await this.loadData() ?? {};
    this.data = {
      items: saved.items ?? [{ id: "1", name: "First item", kind: "note" }, { id: "2", name: "Second item", kind: "link" }],
      editingDefaults: saved.editingDefaults ?? false
    };
    this.addSettingTab(new SampleSettingTab(this.app, this));
    this.addRibbonIcon("plus", "Add item", () => void this.addItem());
  }
  save() {
    return this.saveData(this.data);
  }
  /** The ribbon icon: a form modal, then a notice that echoes the values. */
  async addItem() {
    const values = await import_helenite.ui.form(this.app, {
      title: "Add item",
      action: "Add",
      fields: [
        { id: "name", kind: "text", label: "Name", placeholder: "Item name" },
        { id: "kind", kind: "select", label: "Kind", value: "note", options: [{ value: "note", label: "Note" }, { value: "link", label: "Link" }] },
        { id: "pinned", kind: "checkbox", label: "Pin it", value: false }
      ]
    });
    if (!values) return;
    const name = String(values.name).trim() || "Untitled";
    this.data.items.push({ id: String(Date.now()), name, kind: String(values.kind) });
    await this.save();
    import_helenite.ui.notice(`Added ${name} (${values.kind}${values.pinned ? ", pinned" : ""})`, { kind: "success" });
  }
};
var SampleSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  plugin;
  display() {
    const el = this.containerEl;
    el.empty();
    import_helenite.ui.settings.scopeBar(el, {
      editingDefaults: this.plugin.data.editingDefaults,
      onChange: (editingDefaults) => {
        this.plugin.data.editingDefaults = editingDefaults;
        void this.plugin.save();
      }
    });
    const rows = import_helenite.ui.settings.section(el, "Items");
    import_helenite.ui.settings.subpageRow(this.app, rows, {
      name: "Manage items",
      desc: `${this.plugin.data.items.length} items`,
      title: "Items",
      render: (page) => this.renderItems(page)
    });
  }
  renderItems(page) {
    const t = import_helenite.ui.table(page, {
      columns: [
        { key: "name", title: "Name", cell: (r) => r.name },
        { key: "kind", title: "Kind", fit: true, cell: (r, td) => void import_helenite.ui.badge(td, r.kind) }
      ],
      rows: this.plugin.data.items,
      empty: "No items yet.",
      actions: (r, cell) => {
        import_helenite.ui.action(cell, "delete", {
          app: this.app,
          subject: r.name,
          onClick: async () => {
            this.plugin.data.items = this.plugin.data.items.filter((i) => i.id !== r.id);
            await this.plugin.save();
            t.setRows(this.plugin.data.items);
            import_helenite.ui.notice(`Deleted ${r.name}`, { kind: "success" });
          }
        });
      }
    });
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL21haW4udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8vIFNhbXBsZSBwbHVnaW4gZm9yIEhlbGVuaXRlJ3MgZGVzaWduIHN5c3RlbSAoYGltcG9ydCB7IHVpIH0gZnJvbSAnaGVsZW5pdGUnYCkuIFJlYWQgZG9jcy9kZXNpZ24tc3lzdGVtL1JFQURNRS5tZCBmaXJzdC5cbi8vIEl0IGlzIG5vdCBhIGNvcmUgcGx1Z2luIGFuZCBpcyBub3QgZW5hYmxlZCBieSBkZWZhdWx0LiBCdWlsZCBpdCB3aXRoIGBub2RlIHNjcmlwdHMvYnVpbGQtcGx1Z2luLm1qcyBzYW1wbGUtZGVzaWduLXN5c3RlbWAuXG5pbXBvcnQgeyBQbHVnaW4sIFBsdWdpblNldHRpbmdUYWIsIHR5cGUgQXBwIH0gZnJvbSAnb2JzaWRpYW4nO1xuLy8gSW1wb3J0ZWQgc3RhdGljYWxseSBiZWNhdXNlIHRoaXMgcGx1Z2luIGlzIEhlbGVuaXRlLW9ubHkuIEEgcGx1Z2luIHRoYXQgYWxzbyBydW5zIGluIE9ic2lkaWFuIG11c3QgZ3VhcmQgdGhlIHJlcXVpcmVcbi8vIChzZWUgXCJQbHVnaW5zIHRoYXQgcnVuIGluIE9ic2lkaWFuIHRvb1wiIGluIGRvY3MvZGVzaWduLXN5c3RlbS9SRUFETUUubWQpLlxuaW1wb3J0IHsgdWkgfSBmcm9tICdoZWxlbml0ZSc7XG5cbmludGVyZmFjZSBJdGVtIHtcbiAgaWQ6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xuICBraW5kOiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBEYXRhIHtcbiAgaXRlbXM6IEl0ZW1bXTtcbiAgZWRpdGluZ0RlZmF1bHRzOiBib29sZWFuO1xufVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBTYW1wbGVEZXNpZ25TeXN0ZW1QbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xuICBkYXRhOiBEYXRhID0geyBpdGVtczogW10sIGVkaXRpbmdEZWZhdWx0czogZmFsc2UgfTtcblxuICBhc3luYyBvbmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3Qgc2F2ZWQgPSAoKGF3YWl0IHRoaXMubG9hZERhdGEoKSkgPz8ge30pIGFzIFBhcnRpYWw8RGF0YT47XG4gICAgdGhpcy5kYXRhID0ge1xuICAgICAgaXRlbXM6IHNhdmVkLml0ZW1zID8/IFt7IGlkOiAnMScsIG5hbWU6ICdGaXJzdCBpdGVtJywga2luZDogJ25vdGUnIH0sIHsgaWQ6ICcyJywgbmFtZTogJ1NlY29uZCBpdGVtJywga2luZDogJ2xpbmsnIH1dLFxuICAgICAgZWRpdGluZ0RlZmF1bHRzOiBzYXZlZC5lZGl0aW5nRGVmYXVsdHMgPz8gZmFsc2UsXG4gICAgfTtcbiAgICB0aGlzLmFkZFNldHRpbmdUYWIobmV3IFNhbXBsZVNldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcbiAgICB0aGlzLmFkZFJpYmJvbkljb24oJ3BsdXMnLCAnQWRkIGl0ZW0nLCAoKSA9PiB2b2lkIHRoaXMuYWRkSXRlbSgpKTtcbiAgfVxuXG4gIHNhdmUoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgcmV0dXJuIHRoaXMuc2F2ZURhdGEodGhpcy5kYXRhKTtcbiAgfVxuXG4gIC8qKiBUaGUgcmliYm9uIGljb246IGEgZm9ybSBtb2RhbCwgdGhlbiBhIG5vdGljZSB0aGF0IGVjaG9lcyB0aGUgdmFsdWVzLiAqL1xuICBhc3luYyBhZGRJdGVtKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHZhbHVlcyA9IGF3YWl0IHVpLmZvcm0odGhpcy5hcHAsIHtcbiAgICAgIHRpdGxlOiAnQWRkIGl0ZW0nLFxuICAgICAgYWN0aW9uOiAnQWRkJyxcbiAgICAgIGZpZWxkczogW1xuICAgICAgICB7IGlkOiAnbmFtZScsIGtpbmQ6ICd0ZXh0JywgbGFiZWw6ICdOYW1lJywgcGxhY2Vob2xkZXI6ICdJdGVtIG5hbWUnIH0sXG4gICAgICAgIHsgaWQ6ICdraW5kJywga2luZDogJ3NlbGVjdCcsIGxhYmVsOiAnS2luZCcsIHZhbHVlOiAnbm90ZScsIG9wdGlvbnM6IFt7IHZhbHVlOiAnbm90ZScsIGxhYmVsOiAnTm90ZScgfSwgeyB2YWx1ZTogJ2xpbmsnLCBsYWJlbDogJ0xpbmsnIH1dIH0sXG4gICAgICAgIHsgaWQ6ICdwaW5uZWQnLCBraW5kOiAnY2hlY2tib3gnLCBsYWJlbDogJ1BpbiBpdCcsIHZhbHVlOiBmYWxzZSB9LFxuICAgICAgXSxcbiAgICB9KTtcbiAgICBpZiAoIXZhbHVlcykgcmV0dXJuO1xuICAgIGNvbnN0IG5hbWUgPSBTdHJpbmcodmFsdWVzLm5hbWUpLnRyaW0oKSB8fCAnVW50aXRsZWQnO1xuICAgIHRoaXMuZGF0YS5pdGVtcy5wdXNoKHsgaWQ6IFN0cmluZyhEYXRlLm5vdygpKSwgbmFtZSwga2luZDogU3RyaW5nKHZhbHVlcy5raW5kKSB9KTtcbiAgICBhd2FpdCB0aGlzLnNhdmUoKTtcbiAgICB1aS5ub3RpY2UoYEFkZGVkICR7bmFtZX0gKCR7dmFsdWVzLmtpbmR9JHt2YWx1ZXMucGlubmVkID8gJywgcGlubmVkJyA6ICcnfSlgLCB7IGtpbmQ6ICdzdWNjZXNzJyB9KTtcbiAgfVxufVxuXG5jbGFzcyBTYW1wbGVTZXR0aW5nVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwcml2YXRlIHBsdWdpbjogU2FtcGxlRGVzaWduU3lzdGVtUGx1Z2luKSB7XG4gICAgc3VwZXIoYXBwLCBwbHVnaW4pO1xuICB9XG5cbiAgZGlzcGxheSgpOiB2b2lkIHtcbiAgICBjb25zdCBlbCA9IHRoaXMuY29udGFpbmVyRWw7XG4gICAgZWwuZW1wdHkoKTtcbiAgICB1aS5zZXR0aW5ncy5zY29wZUJhcihlbCwge1xuICAgICAgZWRpdGluZ0RlZmF1bHRzOiB0aGlzLnBsdWdpbi5kYXRhLmVkaXRpbmdEZWZhdWx0cyxcbiAgICAgIG9uQ2hhbmdlOiAoZWRpdGluZ0RlZmF1bHRzKSA9PiB7XG4gICAgICAgIHRoaXMucGx1Z2luLmRhdGEuZWRpdGluZ0RlZmF1bHRzID0gZWRpdGluZ0RlZmF1bHRzO1xuICAgICAgICB2b2lkIHRoaXMucGx1Z2luLnNhdmUoKTtcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgY29uc3Qgcm93cyA9IHVpLnNldHRpbmdzLnNlY3Rpb24oZWwsICdJdGVtcycpO1xuICAgIHVpLnNldHRpbmdzLnN1YnBhZ2VSb3codGhpcy5hcHAsIHJvd3MsIHtcbiAgICAgIG5hbWU6ICdNYW5hZ2UgaXRlbXMnLFxuICAgICAgZGVzYzogYCR7dGhpcy5wbHVnaW4uZGF0YS5pdGVtcy5sZW5ndGh9IGl0ZW1zYCxcbiAgICAgIHRpdGxlOiAnSXRlbXMnLFxuICAgICAgcmVuZGVyOiAocGFnZSkgPT4gdGhpcy5yZW5kZXJJdGVtcyhwYWdlKSxcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgcmVuZGVySXRlbXMocGFnZTogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBjb25zdCB0ID0gdWkudGFibGU8SXRlbT4ocGFnZSwge1xuICAgICAgY29sdW1uczogW1xuICAgICAgICB7IGtleTogJ25hbWUnLCB0aXRsZTogJ05hbWUnLCBjZWxsOiAocikgPT4gci5uYW1lIH0sXG4gICAgICAgIHsga2V5OiAna2luZCcsIHRpdGxlOiAnS2luZCcsIGZpdDogdHJ1ZSwgY2VsbDogKHIsIHRkKSA9PiB2b2lkIHVpLmJhZGdlKHRkLCByLmtpbmQpIH0sXG4gICAgICBdLFxuICAgICAgcm93czogdGhpcy5wbHVnaW4uZGF0YS5pdGVtcyxcbiAgICAgIGVtcHR5OiAnTm8gaXRlbXMgeWV0LicsXG4gICAgICBhY3Rpb25zOiAociwgY2VsbCkgPT4ge1xuICAgICAgICB1aS5hY3Rpb24oY2VsbCwgJ2RlbGV0ZScsIHtcbiAgICAgICAgICBhcHA6IHRoaXMuYXBwLFxuICAgICAgICAgIHN1YmplY3Q6IHIubmFtZSxcbiAgICAgICAgICBvbkNsaWNrOiBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5kYXRhLml0ZW1zID0gdGhpcy5wbHVnaW4uZGF0YS5pdGVtcy5maWx0ZXIoKGkpID0+IGkuaWQgIT09IHIuaWQpO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZSgpO1xuICAgICAgICAgICAgdC5zZXRSb3dzKHRoaXMucGx1Z2luLmRhdGEuaXRlbXMpO1xuICAgICAgICAgICAgdWkubm90aWNlKGBEZWxldGVkICR7ci5uYW1lfWAsIHsga2luZDogJ3N1Y2Nlc3MnIH0pO1xuICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuICAgICAgfSxcbiAgICB9KTtcbiAgfVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBRUEsc0JBQW1EO0FBR25ELHNCQUFtQjtBQWFuQixJQUFxQiwyQkFBckIsY0FBc0QsdUJBQU87QUFBQSxFQUMzRCxPQUFhLEVBQUUsT0FBTyxDQUFDLEdBQUcsaUJBQWlCLE1BQU07QUFBQSxFQUVqRCxNQUFNLFNBQXdCO0FBQzVCLFVBQU0sUUFBVSxNQUFNLEtBQUssU0FBUyxLQUFNLENBQUM7QUFDM0MsU0FBSyxPQUFPO0FBQUEsTUFDVixPQUFPLE1BQU0sU0FBUyxDQUFDLEVBQUUsSUFBSSxLQUFLLE1BQU0sY0FBYyxNQUFNLE9BQU8sR0FBRyxFQUFFLElBQUksS0FBSyxNQUFNLGVBQWUsTUFBTSxPQUFPLENBQUM7QUFBQSxNQUNwSCxpQkFBaUIsTUFBTSxtQkFBbUI7QUFBQSxJQUM1QztBQUNBLFNBQUssY0FBYyxJQUFJLGlCQUFpQixLQUFLLEtBQUssSUFBSSxDQUFDO0FBQ3ZELFNBQUssY0FBYyxRQUFRLFlBQVksTUFBTSxLQUFLLEtBQUssUUFBUSxDQUFDO0FBQUEsRUFDbEU7QUFBQSxFQUVBLE9BQXNCO0FBQ3BCLFdBQU8sS0FBSyxTQUFTLEtBQUssSUFBSTtBQUFBLEVBQ2hDO0FBQUE7QUFBQSxFQUdBLE1BQU0sVUFBeUI7QUFDN0IsVUFBTSxTQUFTLE1BQU0sbUJBQUcsS0FBSyxLQUFLLEtBQUs7QUFBQSxNQUNyQyxPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixRQUFRO0FBQUEsUUFDTixF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
