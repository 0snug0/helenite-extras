// Everything that opens over the page: modals, popovers, menus and notices, and the standard actions.
import { ui, type ActionId, type MenuItemSpec } from 'helenite';
import type SampleDesignSystemPlugin from '../main';

export function drawDialogs(el: HTMLElement, plugin: SampleDesignSystemPlugin): void {
  const { app } = plugin;

  const modals = ui.toolbar(ui.settings.section(el, 'Modals'), { label: 'Modals' });
  ui.button(modals, {
    text: 'Confirm',
    onClick: () => void ui.confirm(app, { title: 'Discard changes', message: 'Discard the changes to this item?', action: 'Discard', danger: true }),
  });
  ui.button(modals, { text: 'Prompt', onClick: () => void ui.prompt(app, { title: 'Rename item', label: 'Name', value: 'Reading list', action: 'Rename' }) });
  ui.button(modals, {
    text: 'Choose',
    onClick: () => void ui.choose(app, {
      title: 'Pick a template',
      options: [{ value: 'blank', text: 'Blank', detail: 'An empty note', icon: 'file' }, { value: 'daily', text: 'Daily note', detail: 'Headings for the day', icon: 'calendar' }],
    }),
  });
  ui.button(modals, {
    text: 'Form',
    onClick: () => void ui.form(app, {
      title: 'Import items', action: 'Import', message: 'Copies the items from a folder into this list.',
      fields: [
        { id: 'path', kind: 'text', label: 'Folder', placeholder: 'Notes/Lists' },
        { id: 'kind', kind: 'select', label: 'Kind', options: [{ value: 'note', label: 'Note' }, { value: 'link', label: 'Link' }] },
        { id: 'when', kind: 'choice', label: 'When', value: 'now', options: [{ value: 'now', label: 'Now' }, { value: 'later', label: 'Tonight' }] },
        { id: 'parts', kind: 'multi', label: 'Include', value: ['tags'], options: [{ value: 'tags', label: 'Tags' }, { value: 'links', label: 'Links' }] },
        { id: 'open', kind: 'checkbox', label: 'Open when done', value: true },
      ],
    }),
  });
  ui.button(modals, {
    text: 'Dialog',
    onClick: () => void ui.dialog(app, {
      title: 'Export items', icon: 'download',
      render: (body) => void ui.keyValue(body, [{ key: 'Items', value: String(plugin.data.items.length) }, { key: 'Format', value: 'Markdown' }]),
      actions: [{ text: 'Export', variant: 'primary', onClick: (ctx) => ctx.close('exported') }],
    }),
  });

  const items = (): MenuItemSpec[] => [
    { title: 'Rename', icon: 'pencil', onClick: () => void ui.notice('Rename') },
    { title: 'Pinned', checked: true, onClick: () => {} },
    'separator',
    { title: 'Delete', icon: 'trash-2', danger: true, onClick: () => void ui.notice('Delete') },
  ];
  const floating = ui.toolbar(ui.settings.section(el, 'Popovers and menus'), { label: 'Popovers and menus' });
  const anchor = ui.button(floating, {
    text: 'Popover',
    onClick: () => {
      const pop = ui.popover(anchor.el, { title: 'Quick note', icon: 'message-circle', quote: 'The text it is about.' });
      ui.textInput(pop.body, { placeholder: 'Add a note', label: 'Note' });
      ui.button(pop.footer, { text: 'Save', variant: 'primary', onClick: () => pop.close() });
    },
  });
  // Under the button, not at the pointer: a button pressed from the keyboard has no pointer position.
  const opener = ui.button(floating, {
    text: 'Menu',
    onClick: () => {
      const { left, bottom } = opener.el.getBoundingClientRect();
      ui.menu(items(), { x: left, y: bottom }, { doc: opener.el.ownerDocument });
    },
  });
  ui.menuButton(floating, { text: 'Add to…', items });
  ui.moreButton(floating, items);

  const notices = ui.toolbar(ui.settings.section(el, 'Notices'), { label: 'Notices' });
  for (const kind of ['info', 'success', 'error'] as const) {
    ui.button(notices, { text: kind, onClick: () => void ui.notice(`This is a ${kind} notice.`, { kind }) });
  }
  ui.button(notices, {
    text: 'With an action',
    onClick: () => void ui.notice('2 items need review.', { action: { text: 'Review', onClick: () => void ui.notice('Reviewing.') } }),
  });

  // A standard action has its icon, label and look already. `delete` and `remove` ask first.
  const actions = ui.toolbar(ui.settings.section(el, 'Standard actions'), { label: 'Standard actions' });
  for (const id of Object.keys(ui.STANDARD_ACTIONS) as ActionId[]) {
    ui.action(actions, id, { app, subject: 'Example', onClick: () => void ui.notice(ui.STANDARD_ACTIONS[id].label) });
  }
}
