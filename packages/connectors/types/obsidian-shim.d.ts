// Minimal ambient subset of the `obsidian` module this package uses, so it type-checks without the full API installed.
declare module 'obsidian' {
  export class Notice { constructor(message: string); }
  export class Plugin {}
  export class App {}
  export class ButtonComponent { setButtonText(t: string): this; setCta(): this; setWarning(): this; onClick(cb: () => unknown): this; }
  export class TextComponent { inputEl: HTMLInputElement; setValue(v: string): this; setPlaceholder(t: string): this; onChange(cb: (v: string) => unknown): this; }
  export class DropdownComponent { addOption(v: string, label: string): this; setValue(v: string): this; onChange(cb: (v: string) => unknown): this; }
  export class ToggleComponent { setValue(v: boolean): this; onChange(cb: (v: boolean) => unknown): this; }
  export class Setting {
    constructor(containerEl: HTMLElement);
    setName(n: string): this; setDesc(d: string): this; setHeading(): this;
    addText(cb: (t: TextComponent) => unknown): this; addButton(cb: (b: ButtonComponent) => unknown): this;
    addDropdown(cb: (d: DropdownComponent) => unknown): this; addToggle(cb: (t: ToggleComponent) => unknown): this;
  }
  export class PluginSettingTab {
    constructor(app: App, plugin: Plugin);
    id: string; name: string; icon: string; containerEl: HTMLElement; display(): void;
  }
}
interface HTMLElement { empty(): void }
