// Minimal ambient subset of the `obsidian` module this package uses, so it type-checks without the full API installed.
declare module 'obsidian' {
  export class Notice { constructor(message: string); }
  export class Plugin {}
  export class App {}
  export class ButtonComponent { setButtonText(t: string): this; setCta(): this; setWarning(): this; onClick(cb: () => unknown): this; }
  export class TextComponent { inputEl: HTMLInputElement; setPlaceholder(t: string): this; onChange(cb: (v: string) => unknown): this; }
  export class Setting {
    constructor(containerEl: HTMLElement);
    setName(n: string): this; setDesc(d: string): this; setHeading(): this;
    addText(cb: (t: TextComponent) => unknown): this; addButton(cb: (b: ButtonComponent) => unknown): this;
  }
  export class PluginSettingTab {
    constructor(app: App, plugin: Plugin);
    id: string; name: string; icon: string; containerEl: HTMLElement; display(): void;
  }
}
interface HTMLElement { empty(): void }
