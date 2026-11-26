// Buttons and form controls. `ui.settings.section` is a heading and its container, in a view as in a settings tab.
import { ui } from 'helenite';

export function drawInputs(el: HTMLElement): void {
  const buttons = ui.toolbar(ui.settings.section(el, 'Buttons'), { label: 'Button variants' });
  ui.button(buttons, { text: 'Default' });
  ui.button(buttons, { text: 'Primary', variant: 'primary' });
  ui.button(buttons, { text: 'Danger', variant: 'danger' });
  ui.button(buttons, { text: 'Link', variant: 'link' });
  ui.button(buttons, { variant: 'icon', icon: 'settings', label: 'Configure' });
  ui.button(buttons, { text: 'Pressed', pressed: true });
  ui.button(buttons, { text: 'Disabled', disabled: true });

  const fields = ui.settings.section(el, 'Fields');
  // A field names its control and shows its hint and error.
  const name = ui.field(fields, { label: 'Name', hint: 'Shown in the lists.', fill: true });
  ui.textInput(name.control, { value: 'Reading list', onInput: (v) => name.setError(v.trim() ? null : 'Enter a name.') });
  const key = ui.field(fields, { label: 'API key', fill: true });
  ui.textInput(key.control, { secret: true, placeholder: 'Paste the key' });
  const note = ui.field(fields, { label: 'Description', fill: true });
  ui.textInput(note.control, { multiline: true, rows: 3, placeholder: 'What the item is for' });
  const invalid = ui.field(fields, { label: 'Limit', inline: true });
  ui.textInput(invalid.control, { type: 'number', value: '0' });
  invalid.setError('Enter a number above 0.');
  const kind = ui.field(fields, { label: 'Kind', inline: true });
  ui.dropdown(kind.control, { options: [{ value: 'note', text: 'Note' }, { value: 'link', text: 'Link' }], value: 'note' });

  const switches = ui.settings.section(el, 'Switches and sliders');
  const toggles = ui.toolbar(switches, { label: 'Switches' });
  ui.toggle(toggles, { value: true, label: 'Show finished items' });
  ui.toggle(toggles, { value: false, label: 'Sync items', disabled: true });
  ui.slider(ui.field(switches, { label: 'Items per page', inline: true }).control, { min: 10, max: 50, step: 5, value: 25, label: 'Items per page', onChange: () => {} });

  const lists = ui.settings.section(el, 'Lists to pick from');
  ui.checkList(ui.field(lists, { label: 'Show kinds', fill: true }).control, {
    options: [
      { value: 'note', text: 'Notes', detail: 'Markdown files in this vault' },
      { value: 'link', text: 'Links' },
      { value: 'file', text: 'Files', detail: 'Not supported yet', disabled: true },
    ],
    value: ['note', 'link'],
  });
  ui.choiceList(ui.field(lists, { label: 'Open items in', fill: true }).control, {
    indicator: 'radio',
    options: [
      { value: 'tab', text: 'A new tab', detail: 'Keeps this view open', icon: 'plus-square', tag: 'Default', key: '1' },
      { value: 'split', text: 'A split', icon: 'columns-2', key: '2' },
      { value: 'window', text: 'A new window', icon: 'app-window', key: '3', disabled: true },
    ],
    value: 'tab',
    onChange: () => {},
  });

  const compose = ui.settings.section(el, 'Composer');
  ui.composer(compose, {
    placeholder: 'Add a comment', hint: 'Enter sends, Shift+Enter starts a new line.',
    onAttach: () => [{ name: 'notes.md' }],
    onSubmit: (text) => void ui.notice(`Sent: ${text}`),
  });
}
