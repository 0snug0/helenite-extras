// Homepage settings tab, built from the design system's settings parts.
import { AbstractInputSuggest, PluginSettingTab, TFile, type App } from 'obsidian';
import { ui } from 'helenite';
import { normalizeTarget, type HomepageKind, type OpenMode, type RefreshMode, type ViewMode } from './homepage';
import type HomepagePlugin from './main';

/** Suggests markdown notes while typing the homepage's path. */
class NoteSuggest extends AbstractInputSuggest<TFile> {
  constructor(app: App, private input: HTMLInputElement, private pick: (path: string) => void) {
    super(app, input);
  }

  getSuggestions(query: string): TFile[] {
    const q = query.trim().toLowerCase();
    return this.app.vault
      .getMarkdownFiles()
      .filter((f) => f.path.toLowerCase().includes(q))
      .sort((a, b) => a.path.length - b.path.length)
      .slice(0, 50);
  }

  renderSuggestion(file: TFile, el: HTMLElement): void {
    el.setText(file.path.replace(/\.md$/, ''));
  }

  selectSuggestion(file: TFile): void {
    const value = file.path.replace(/\.md$/, '');
    this.input.value = value;
    this.pick(value);
    this.close();
  }
}

const OPEN_MODES: Record<OpenMode, string> = {
  'replace-all': 'Replace all open tabs',
  'replace-last': 'Replace the current tab',
  keep: 'Keep tabs, open a new one',
};

const REFRESH_MODES: Record<RefreshMode, string> = {
  switch: 'Switch to it',
  reload: 'Switch to it and reload it',
  duplicate: 'Open it again',
};

export class HomepageSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: HomepagePlugin) {
    super(app, plugin);
  }

  private set<K extends keyof HomepagePlugin['settings']>(key: K, value: HomepagePlugin['settings'][K]): void {
    this.plugin.settings[key] = value;
    void this.plugin.save();
  }

  display(): void {
    const el = this.containerEl;
    el.empty();
    const s = this.plugin.settings;

    const what = ui.settings.section(el, 'Homepage');
    const kind = new ui.settings.row(what).setName('Open').setDesc('A chosen note, or a different random note each time.');
    ui.segmented<HomepageKind>(kind.controlEl, {
      value: s.kind,
      options: [
        { value: 'note', text: 'A note' },
        { value: 'random', text: 'A random note' },
      ],
      onChange: (v) => {
        this.set('kind', v);
        this.display();
      },
    });
    if (s.kind === 'note') {
      const note = new ui.settings.row(what).setName('Note').setDesc(this.noteDesc(s.target));
      note.addText((t) => {
        t.setPlaceholder('Home').setValue(s.target);
        const commit = (v: string) => {
          this.set('target', v.trim());
          note.setDesc(this.noteDesc(v));
        };
        t.onChange(commit);
        new NoteSuggest(this.app, t.inputEl, commit);
      });
      new ui.settings.row(what)
        .setName('Create the note if it is missing')
        .setDesc('Off shows an error instead.')
        .addToggle((t) => t.setValue(s.createIfMissing).onChange((v) => this.set('createIfMissing', v)));
    }

    const when = ui.settings.section(el, 'When to open it');
    new ui.settings.row(when)
      .setName('When Helenite starts')
      .addToggle((t) => t.setValue(s.openOnStartup).onChange((v) => this.set('openOnStartup', v)));
    new ui.settings.row(when)
      .setName('In new empty tabs')
      .setDesc('A new tab shows the homepage instead of an empty page.')
      .addToggle((t) => t.setValue(s.openInNewTab).onChange((v) => this.set('openInNewTab', v)));

    const how = ui.settings.section(el, 'How to open it');
    new ui.settings.row(how)
      .setName('Tabs')
      .setDesc('What happens to the tabs already open. Pinned tabs always stay.')
      .addDropdown((d) => d.addOptions(OPEN_MODES).setValue(s.openMode).onChange((v) => this.set('openMode', v as OpenMode)));
    new ui.settings.row(how)
      .setName('If it is already open')
      .addDropdown((d) => d.addOptions(REFRESH_MODES).setValue(s.refresh).onChange((v) => this.set('refresh', v as RefreshMode)));
    const view = new ui.settings.row(how).setName('View').setDesc('Default uses the mode set in Editor settings.');
    ui.segmented<ViewMode>(view.controlEl, {
      value: s.view,
      options: [
        { value: 'default', text: 'Default' },
        { value: 'reading', text: 'Reading' },
        { value: 'editing', text: 'Editing' },
      ],
      onChange: (v) => this.set('view', v),
    });

    const now = new ui.settings.row(how).setName('Open the homepage now');
    ui.action(now.controlEl, 'open', { onClick: () => this.plugin.openHomepage() });
  }

  private noteDesc(target: string): string {
    const path = normalizeTarget(target);
    if (!path) return 'Type a note name or path.';
    return this.app.vault.getAbstractFileByPath(path) ? `Opens ${path}.` : `${path} does not exist yet.`;
  }
}
