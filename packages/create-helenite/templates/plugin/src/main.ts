// {{name}}: a Helenite plugin. Start with README.md; the guide is docs/dev/plugins.md in the helenite-extras repository.
import { Plugin, PluginSettingTab, Setting, type App } from 'obsidian';
// `helenite` is provided by Helenite at run time (build.mjs keeps it out of the bundle); types/helenite.d.ts types it.
// This static import makes the plugin Helenite-only. To run in Obsidian too, see "Run in Obsidian too" in README.md.
import { ui } from 'helenite';
import { withDefaults, type Greeting, type Settings } from './settings';

export default class HelenitePlugin extends Plugin {
  // Obsidian's Plugin declares `settings?: unknown` (Obsidian 1.13 and later); `declare` gives it this plugin's type.
  declare settings: Settings;

  async onload(): Promise<void> {
    this.settings = withDefaults(await this.loadData());
    // The palette shows it as "{{name}}: Say hello"; its id is "{{id}}:say-hello".
    this.addCommand({ id: 'say-hello', name: 'Say hello', callback: () => this.sayHello() });
    this.addRibbonIcon('smile', 'Add a greeting', () => void this.addGreeting());
    this.addSettingTab(new GreetingsSettingTab(this.app, this));
    if (this.settings.helloOnStart) this.app.workspace.onLayoutReady(() => this.sayHello());
  }

  save(): Promise<void> {
    return this.saveData(this.settings);
  }

  sayHello(): void {
    ui.notice(this.settings.greetings[0]?.text ?? 'Hello!');
  }

  /** A form modal. `onSubmit` runs inside it: a throw shows the message and keeps the modal open. */
  async addGreeting(): Promise<Greeting | null> {
    const values = await ui.form(this.app, {
      title: 'Add a greeting',
      action: 'Add greeting',
      fields: [{ id: 'text', kind: 'text', label: 'Greeting', placeholder: 'Good morning!' }],
      onSubmit: (v) => {
        if (!String(v.text).trim()) throw new Error('Enter a greeting.');
      },
    });
    if (!values) return null; // cancelled
    const greeting = { id: String(Date.now()), text: String(values.text).trim() };
    this.settings.greetings.push(greeting);
    await this.save();
    ui.notice(`Added "${greeting.text}"`, { kind: 'success' });
    return greeting;
  }
}

class GreetingsSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: HelenitePlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const general = ui.settings.section(containerEl, 'General');
    // Obsidian's Setting works as usual; ui.settings.row is the same class.
    new Setting(general)
      .setName('Say hello on startup')
      .setDesc('Show the first greeting when the vault opens.')
      .addToggle((t) =>
        t.setValue(this.plugin.settings.helloOnStart).onChange(async (on) => {
          this.plugin.settings.helloOnStart = on;
          await this.plugin.save();
        }),
      );
    const count = this.plugin.settings.greetings.length;
    ui.settings.subpageRow(this.app, general, {
      name: 'Greetings',
      desc: `${count} greeting${count === 1 ? '' : 's'}`,
      title: 'Greetings',
      render: (page) => this.renderGreetings(page),
    });
  }

  /** The sub-page: a table of greetings, a delete action per row (it asks first) and an Add button. */
  private renderGreetings(page: HTMLElement): void {
    const table = ui.table<Greeting>(page, {
      columns: [{ key: 'text', title: 'Greeting', cell: (g) => g.text }],
      rows: this.plugin.settings.greetings,
      empty: 'No greetings yet.',
      actions: (g, cell) => {
        ui.action(cell, 'delete', {
          app: this.app,
          subject: `"${g.text}"`,
          onClick: async () => {
            this.plugin.settings.greetings = this.plugin.settings.greetings.filter((x) => x.id !== g.id);
            await this.plugin.save();
            table.setRows(this.plugin.settings.greetings);
          },
        });
      },
    });
    ui.action(page, 'add', {
      onClick: async () => {
        if (await this.plugin.addGreeting()) table.setRows(this.plugin.settings.greetings);
      },
    });
  }
}
