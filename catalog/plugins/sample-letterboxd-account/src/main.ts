// The vault-feature entry of the sample plugin (`main.js`). It loads in a vault under the normal enable rules and uses the
// account only through `app.accounts.call`; the account type itself lives in accounts.ts.
import { Plugin, PluginSettingTab, Setting, type App, type Editor } from 'obsidian';
import { ui } from 'helenite';
import type { DiaryEntry } from './accounts';

interface Settings {
  /** Label of the Letterboxd account to read, as shown in Settings, Accounts. */
  accountLabel: string;
}

export function diaryMarkdown(entries: DiaryEntry[]): string {
  const lines = entries.map((e) => {
    const year = e.year ? ` (${e.year})` : '';
    const rating = e.rating != null ? ` ★ ${e.rating}` : '';
    const when = e.watchedDate ? ` · ${e.watchedDate}` : '';
    return `- [${e.title}${year}](${e.link})${rating}${when}${e.rewatch ? ' · rewatch' : ''}`;
  });
  return lines.length ? `${lines.join('\n')}\n` : '';
}

export default class LetterboxdVaultPlugin extends Plugin {
  settings: Settings = { accountLabel: '' };

  async onload(): Promise<void> {
    this.settings = { accountLabel: '', ...((await this.loadData()) ?? {}) };
    this.addCommand({
      id: 'insert-latest-diary',
      name: 'Insert latest Letterboxd diary entries',
      editorCallback: (editor: Editor) => void this.insertDiary(editor),
    });
    this.addSettingTab(new LetterboxdSettingTab(this.app, this));
  }

  async insertDiary(editor: Editor): Promise<void> {
    const account = this.settings.accountLabel.trim();
    if (!account) {
      ui.notice('Set the Letterboxd account label in this plugin’s settings first.');
      return;
    }
    try {
      const entries = (await this.app.accounts.call({ account, method: 'diary', args: { limit: 5 } })) as DiaryEntry[];
      editor.replaceSelection(diaryMarkdown(entries));
    } catch (e) {
      ui.notice(`Letterboxd: ${e instanceof Error ? e.message : String(e)}`, { kind: 'error' });
    }
  }
}

class LetterboxdSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: LetterboxdVaultPlugin) {
    super(app, plugin);
  }

  display(): void {
    this.containerEl.empty();
    new Setting(this.containerEl)
      .setName('Account label')
      .setDesc('The Letterboxd account to read, exactly as listed in Settings, Accounts. The vault must be granted "Read diary" on it.')
      .addText((t) => t.setPlaceholder('Letterboxd (me)').setValue(this.plugin.settings.accountLabel).onChange(async (v) => {
        this.plugin.settings.accountLabel = v;
        await this.plugin.saveData(this.plugin.settings);
      }));
  }
}
