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
  default: () => LetterboxdVaultPlugin,
  diaryMarkdown: () => diaryMarkdown
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var import_helenite = require("helenite");
function diaryMarkdown(entries) {
  const lines = entries.map((e) => {
    const year = e.year ? ` (${e.year})` : "";
    const rating = e.rating != null ? ` \u2605 ${e.rating}` : "";
    const when = e.watchedDate ? ` \xB7 ${e.watchedDate}` : "";
    return `- [${e.title}${year}](${e.link})${rating}${when}${e.rewatch ? " \xB7 rewatch" : ""}`;
  });
  return lines.length ? `${lines.join("\n")}
` : "";
}
var LetterboxdVaultPlugin = class extends import_obsidian.Plugin {
  settings = { accountLabel: "" };
  async onload() {
    this.settings = { accountLabel: "", ...await this.loadData() ?? {} };
    this.addCommand({
      id: "insert-latest-diary",
      name: "Insert latest Letterboxd diary entries",
      editorCallback: (editor) => void this.insertDiary(editor)
    });
    this.addSettingTab(new LetterboxdSettingTab(this.app, this));
  }
  async insertDiary(editor) {
    const account = this.settings.accountLabel.trim();
    if (!account) {
      import_helenite.ui.notice("Set the Letterboxd account label in this plugin\u2019s settings first.");
      return;
    }
    try {
      const entries = await this.app.accounts.call({ account, method: "diary", args: { limit: 5 } });
      editor.replaceSelection(diaryMarkdown(entries));
    } catch (e) {
      import_helenite.ui.notice(`Letterboxd: ${e instanceof Error ? e.message : String(e)}`, { kind: "error" });
    }
  }
};
var LetterboxdSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  plugin;
  display() {
    this.containerEl.empty();
    new import_helenite.ui.settings.row(this.containerEl).setName("Account label").setDesc('The Letterboxd account to read, exactly as listed in Settings, Accounts. The vault must be granted "Read diary" on it.').addText((t) => t.setPlaceholder("Letterboxd (me)").setValue(this.plugin.settings.accountLabel).onChange(async (v) => {
      this.plugin.settings.accountLabel = v;
      await this.plugin.saveData(this.plugin.settings);
    }));
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  diaryMarkdown
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL21haW4udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8vIFRoZSB2YXVsdC1mZWF0dXJlIGVudHJ5IG9mIHRoZSBzYW1wbGUgcGx1Z2luIChgbWFpbi5qc2ApLiBJdCBsb2FkcyBpbiBhIHZhdWx0IHVuZGVyIHRoZSBub3JtYWwgZW5hYmxlIHJ1bGVzIGFuZCB1c2VzIHRoZVxuLy8gYWNjb3VudCBvbmx5IHRocm91Z2ggYGFwcC5hY2NvdW50cy5jYWxsYDsgdGhlIGFjY291bnQgdHlwZSBpdHNlbGYgbGl2ZXMgaW4gYWNjb3VudHMudHMuXG5pbXBvcnQgeyBQbHVnaW4sIFBsdWdpblNldHRpbmdUYWIsIHR5cGUgQXBwLCB0eXBlIEVkaXRvciB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IHVpIH0gZnJvbSAnaGVsZW5pdGUnO1xuaW1wb3J0IHR5cGUgeyBEaWFyeUVudHJ5IH0gZnJvbSAnLi9hY2NvdW50cyc7XG5cbmludGVyZmFjZSBTZXR0aW5ncyB7XG4gIC8qKiBMYWJlbCBvZiB0aGUgTGV0dGVyYm94ZCBhY2NvdW50IHRvIHJlYWQsIGFzIHNob3duIGluIFNldHRpbmdzLCBBY2NvdW50cy4gKi9cbiAgYWNjb3VudExhYmVsOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkaWFyeU1hcmtkb3duKGVudHJpZXM6IERpYXJ5RW50cnlbXSk6IHN0cmluZyB7XG4gIGNvbnN0IGxpbmVzID0gZW50cmllcy5tYXAoKGUpID0+IHtcbiAgICBjb25zdCB5ZWFyID0gZS55ZWFyID8gYCAoJHtlLnllYXJ9KWAgOiAnJztcbiAgICBjb25zdCByYXRpbmcgPSBlLnJhdGluZyAhPSBudWxsID8gYCBcdTI2MDUgJHtlLnJhdGluZ31gIDogJyc7XG4gICAgY29uc3Qgd2hlbiA9IGUud2F0Y2hlZERhdGUgPyBgIFx1MDBCNyAke2Uud2F0Y2hlZERhdGV9YCA6ICcnO1xuICAgIHJldHVybiBgLSBbJHtlLnRpdGxlfSR7eWVhcn1dKCR7ZS5saW5rfSkke3JhdGluZ30ke3doZW59JHtlLnJld2F0Y2ggPyAnIFx1MDBCNyByZXdhdGNoJyA6ICcnfWA7XG4gIH0pO1xuICByZXR1cm4gbGluZXMubGVuZ3RoID8gYCR7bGluZXMuam9pbignXFxuJyl9XFxuYCA6ICcnO1xufVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBMZXR0ZXJib3hkVmF1bHRQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xuICBzZXR0aW5nczogU2V0dGluZ3MgPSB7IGFjY291bnRMYWJlbDogJycgfTtcblxuICBhc3luYyBvbmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5zZXR0aW5ncyA9IHsgYWNjb3VudExhYmVsOiAnJywgLi4uKChhd2FpdCB0aGlzLmxvYWREYXRhKCkpID8/IHt9KSB9O1xuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogJ2luc2VydC1sYXRlc3QtZGlhcnknLFxuICAgICAgbmFtZTogJ0luc2VydCBsYXRlc3QgTGV0dGVyYm94ZCBkaWFyeSBlbnRyaWVzJyxcbiAgICAgIGVkaXRvckNhbGxiYWNrOiAoZWRpdG9yOiBFZGl0b3IpID0+IHZvaWQgdGhpcy5pbnNlcnREaWFyeShlZGl0b3IpLFxuICAgIH0pO1xuICAgIHRoaXMuYWRkU2V0dGluZ1RhYihuZXcgTGV0dGVyYm94ZFNldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcbiAgfVxuXG4gIGFzeW5jIGluc2VydERpYXJ5KGVkaXRvcjogRWRpdG9yKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgYWNjb3VudCA9IHRoaXMuc2V0dGluZ3MuYWNjb3VudExhYmVsLnRyaW0oKTtcbiAgICBpZiAoIWFjY291bnQpIHtcbiAgICAgIHVpLm5vdGljZSgnU2V0IHRoZSBMZXR0ZXJib3hkIGFjY291bnQgbGFiZWwgaW4gdGhpcyBwbHVnaW5cdTIwMTlzIHNldHRpbmdzIGZpcnN0LicpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgY29uc3QgZW50cmllcyA9IChhd2FpdCB0aGlzLmFwcC5hY2NvdW50cy5jYWxsKHsgYWNjb3VudCwgbWV0aG9kOiAnZGlhcnknLCBhcmdzOiB7IGxpbWl0OiA1IH0gfSkpIGFzIERpYXJ5RW50cnlbXTtcbiAgICAgIGVkaXRvci5yZXBsYWNlU2VsZWN0aW9uKGRpYXJ5TWFya2Rvd24oZW50cmllcykpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHVpLm5vdGljZShgTGV0dGVyYm94ZDogJHtlIGluc3RhbmNlb2YgRXJyb3IgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSl9YCwgeyBraW5kOiAnZXJyb3InIH0pO1xuICAgIH1cbiAgfVxufVxuXG5jbGFzcyBMZXR0ZXJib3hkU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcHJpdmF0ZSBwbHVnaW46IExldHRlcmJveGRWYXVsdFBsdWdpbikge1xuICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcbiAgfVxuXG4gIGRpc3BsYXkoKTogdm9pZCB7XG4gICAgdGhpcy5jb250YWluZXJFbC5lbXB0eSgpO1xuICAgIG5ldyB1aS5zZXR0aW5ncy5yb3codGhpcy5jb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKCdBY2NvdW50IGxhYmVsJylcbiAgICAgIC5zZXREZXNjKCdUaGUgTGV0dGVyYm94ZCBhY2NvdW50IHRvIHJlYWQsIGV4YWN0bHkgYXMgbGlzdGVkIGluIFNldHRpbmdzLCBBY2NvdW50cy4gVGhlIHZhdWx0IG11c3QgYmUgZ3JhbnRlZCBcIlJlYWQgZGlhcnlcIiBvbiBpdC4nKVxuICAgICAgLmFkZFRleHQoKHQpID0+IHQuc2V0UGxhY2Vob2xkZXIoJ0xldHRlcmJveGQgKG1lKScpLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmFjY291bnRMYWJlbCkub25DaGFuZ2UoYXN5bmMgKHYpID0+IHtcbiAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuYWNjb3VudExhYmVsID0gdjtcbiAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZURhdGEodGhpcy5wbHVnaW4uc2V0dGluZ3MpO1xuICAgICAgfSkpO1xuICB9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBRUEsc0JBQWdFO0FBQ2hFLHNCQUFtQjtBQVFaLFNBQVMsY0FBYyxTQUErQjtBQUMzRCxRQUFNLFFBQVEsUUFBUSxJQUFJLENBQUMsTUFBTTtBQUMvQixVQUFNLE9BQU8sRUFBRSxPQUFPLEtBQUssRUFBRSxJQUFJLE1BQU07QUFDdkMsVUFBTSxTQUFTLEVBQUUsVUFBVSxPQUFPLFdBQU0sRUFBRSxNQUFNLEtBQUs7QUFDckQsVUFBTSxPQUFPLEVBQUUsY0FBYyxTQUFNLEVBQUUsV0FBVyxLQUFLO0FBQ3JELFdBQU8sTUFBTSxFQUFFLEtBQUssR0FBRyxJQUFJLEtBQUssRUFBRSxJQUFJLElBQUksTUFBTSxHQUFHLElBQUksR0FBRyxFQUFFLFVBQVUsa0JBQWUsRUFBRTtBQUFBLEVBQ3pGLENBQUM7QUFDRCxTQUFPLE1BQU0sU0FBUyxHQUFHLE1BQU0sS0FBSyxJQUFJLENBQUM7QUFBQSxJQUFPO0FBQ2xEO0FBRUEsSUFBcUIsd0JBQXJCLGNBQW1ELHVCQUFPO0FBQUEsRUFDeEQsV0FBcUIsRUFBRSxjQUFjLEdBQUc7QUFBQSxFQUV4QyxNQUFNLFNBQXdCO0FBQzVCLFNBQUssV0FBVyxFQUFFLGNBQWMsSUFBSSxHQUFLLE1BQU0sS0FBSyxTQUFTLEtBQU0sQ0FBQyxFQUFHO0FBQ3ZFLFNBQUssV0FBVztBQUFBLE1BQ2QsSUFBSTtBQUFBLE1BQ0osTUFBTTtBQUFBLE1BQ04sZ0JBQWdCLENBQUMsV0FBbUIsS0FBSyxLQUFLLFlBQVksTUFBTTtBQUFBLElBQ2xFLENBQUM7QUFDRCxTQUFLLGNBQWMsSUFBSSxxQkFBcUIsS0FBSyxLQUFLLElBQUksQ0FBQztBQUFBLEVBQzdEO0FBQUEsRUFFQSxNQUFNLFlBQVksUUFBK0I7QUFDL0MsVUFBTSxVQUFVLEtBQUssU0FBUyxhQUFhLEtBQUs7QUFDaEQsUUFBSSxDQUFDLFNBQVM7QUFDWix5QkFBRyxPQUFPLHdFQUFtRTtBQUM3RTtBQUFBLElBQ0Y7QUFDQSxRQUFJO0FBQ0YsWUFBTSxVQUFXLE1BQU0sS0FBSyxJQUFJLFNBQVMsS0FBSyxFQUFFLFNBQVMsUUFBUSxTQUFTLE1BQU0sRUFBRSxPQUFPLEVBQUUsRUFBRSxDQUFDO0FBQzlGLGFBQU8saUJBQWlCLGNBQWMsT0FBTyxDQUFDO0FBQUEsSUFDaEQsU0FBUyxHQUFHO0FBQ1YseUJBQUcsT0FBTyxlQUFlLGFBQWEsUUFBUSxFQUFFLFVBQVUsT0FBTyxDQUFDLENBQUMsSUFBSSxFQUFFLE1BQU0sUUFBUSxDQUFDO0FBQUEsSUFDMUY7QUFBQSxFQUNGO0FBQ0Y7QUFFQSxJQUFNLHVCQUFOLGNBQW1DLGlDQUFpQjtBQUFBLEVBQ2xELFlBQVksS0FBa0IsUUFBK0I7QUFDM0QsVUFBTSxLQUFLLE1BQU07QUFEVztBQUFBLEVBRTlCO0FBQUEsRUFGOEI7QUFBQSxFQUk5QixVQUFnQjtBQUNkLFNBQUssWUFBWSxNQUFNO0FBQ3ZCLFFBQUksbUJBQUcsU0FBUyxJQUFJLEtBQUssV0FBVyxFQUNqQyxRQUFRLGVBQWUsRUFDdkIsUUFBUSx3SEFBd0gsRUFDaEksUUFBUSxDQUFDLE1BQU0sRUFBRSxlQUFlLGlCQUFpQixFQUFFLFNBQVMsS0FBSyxPQUFPLFNBQVMsWUFBWSxFQUFFLFNBQVMsT0FBTyxNQUFNO0FBQ3BILFdBQUssT0FBTyxTQUFTLGVBQWU7QUFDcEMsWUFBTSxLQUFLLE9BQU8sU0FBUyxLQUFLLE9BQU8sUUFBUTtBQUFBLElBQ2pELENBQUMsQ0FBQztBQUFBLEVBQ047QUFDRjsiLAogICJuYW1lcyI6IFtdCn0K
