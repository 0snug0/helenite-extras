// Parts that group content: cards, disclosure cards, key-value lists, code blocks, comment threads, and the parts for
// collections with artwork and figures (media cards, ratings, stat tiles, headings, a month grid).
import { ui } from 'helenite';

export function drawCards(el: HTMLElement): void {
  const card = ui.card(ui.settings.section(el, 'Card'), { title: 'Reading list', icon: 'file-text' });
  ui.statusText(card.body, 'Synced a minute ago', 'success');
  ui.button(card.footer, { text: 'Open', onClick: () => void ui.notice('Opened Reading list') });

  const warning = ui.card(ui.settings.section(el, 'Card that needs attention'), { title: 'Which folder?', icon: 'circle-help', tone: 'warning', attention: true });
  ui.choiceList(warning.body, {
    label: 'Folder',
    options: [{ value: 'notes', text: 'Notes', key: '1' }, { value: 'archive', text: 'Archive', key: '2' }],
    onChange: (v) => void ui.notice(`Picked ${v}`),
  });

  // Without `onToggle` a disclosure card opens and closes itself.
  const more = ui.disclosure(ui.settings.section(el, 'Disclosure'), { title: 'About this list', summary: 'Notes and links', open: true });
  ui.badge(more.lead, '1', 'accent');
  ui.keyValue(more.body, [
    { key: 'Folder', value: 'Notes/Lists' },
    { key: 'Kinds', value: ['note', 'link'], isNew: (k) => k === 'link' },
    { key: 'Secrets', value: [], empty: 'None' },
  ]);

  ui.codeBlock(ui.settings.section(el, 'Code block'), "const card = ui.card(el, { title: 'Reading list', icon: 'file-text' });\nui.statusText(card.body, 'Synced a minute ago', 'success');", { label: 'Card code' });

  const heading = ui.sectionHeading(el, { title: 'Collection', extra: '3 items', level: 3 });
  ui.button(heading.actions, { text: 'Refresh', onClick: () => void ui.notice('Up to date') });
  ui.statTiles(el, [{ value: '3', label: 'Items', onClick: () => void ui.notice('3 items') }, { value: '1', label: 'Unread' }]);
  const grid = ui.mediaGrid(el, { minWidth: 120 });
  for (const title of ['Reading list', 'Ideas']) {
    const item = ui.mediaCard(grid, { art: { title }, title });
    ui.rating(item.body, { value: 4 });
    ui.figures(item.body, [{ text: '12', label: 'Notes', icon: 'file-text' }]);
    ui.button(item.footer, { text: 'Open', onClick: () => void ui.notice(`Opened ${title}`) });
  }
  ui.artwork(ui.mediaGrid(el, { layout: 'strip', minWidth: 80 }), { title: 'No cover', onClick: () => void ui.notice('No cover yet') });
  ui.monthGrid(ui.settings.section(el, 'Month'), { month: new Date(), events: (day) => (day.endsWith('-15') ? [{ title: 'Review', lead: '9:00' }] : []) });

  const talk = ui.thread(ui.settings.section(el, 'Thread'));
  talk.event('Nov 26, 9:00 AM · Item added');
  const asked = talk.entry();
  ui.threadText(ui.card(asked.el, { compact: true, title: 'Ada', icon: 'user' }).body, 'Should this go in the archive?');
  const answer = asked.replies().entry();
  ui.threadText(ui.card(answer.el, { compact: true, title: 'You', icon: 'user', tone: 'accent' }).body, 'Not yet.\nAfter the review.');
}
