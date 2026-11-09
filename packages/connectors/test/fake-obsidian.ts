// Recording fakes for the obsidian classes used by the Secrets tab.
export const notices: string[] = [];
export class Notice { constructor(m: string) { notices.push(m); } }
export class Plugin {}
export class App {}
export class Button { text = ''; flags: string[] = []; click: () => unknown = () => {};
  setButtonText(t: string) { this.text = t; return this; } setCta() { this.flags.push('cta'); return this; } setWarning() { this.flags.push('warning'); return this; }
  onClick(cb: () => unknown) { this.click = cb; return this; } }
export class Text { inputEl: any = { type: 'text', autocomplete: '' }; change: (v: string) => unknown = () => {}; placeholder = '';
  setPlaceholder(t: string) { this.placeholder = t; return this; } onChange(cb: (v: string) => unknown) { this.change = cb; return this; } }
export class Setting {
  static all: Setting[] = [];
  name = ''; desc = ''; heading = false; texts: Text[] = []; buttons: Button[] = [];
  constructor(public host: any) { (host.settings ??= []).push(this); Setting.all.push(this); }
  setName(n: string) { this.name = n; return this; } setDesc(d: string) { this.desc = d; return this; } setHeading() { this.heading = true; return this; }
  addText(cb: (t: Text) => unknown) { const t = new Text(); this.texts.push(t); cb(t); return this; }
  addButton(cb: (b: Button) => unknown) { const b = new Button(); this.buttons.push(b); cb(b); return this; }
}
export class PluginSettingTab {
  id = ''; name = ''; icon = '';
  containerEl: any = { settings: [] as Setting[], empty() { this.settings = []; } };
  constructor(public app: any, public plugin: any) {}
  display() {}
}
