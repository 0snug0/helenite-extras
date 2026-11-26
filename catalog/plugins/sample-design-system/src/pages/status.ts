// Parts that tell the user how things stand: messages, labels, readings, and what to show with nothing to show.
import { ui, type Tone } from 'helenite';
import { count } from '../data';

const TONES: Tone[] = ['default', 'accent', 'success', 'warning', 'danger'];

export function drawStatus(el: HTMLElement): void {
  const callouts = ui.settings.section(el, 'Callouts');
  ui.callout(callouts, { tone: 'info', text: 'Items are saved in this vault.' });
  ui.callout(callouts, { tone: 'accent', text: '2 items are waiting for you.', action: { text: 'Review', onClick: () => void ui.notice('Nothing to review.') } });
  ui.callout(callouts, { tone: 'success', text: 'Everything is up to date.' });
  ui.callout(callouts, { tone: 'warning', text: 'This link has not been checked for a month.' });
  ui.callout(callouts, { tone: 'danger', text: 'Could not reach the server.' });
  ui.callout(callouts, { tone: 'accent', solid: true, text: 'An agent is waiting on you.' });

  // A settings row's control area lays small things out side by side. (`ui.toolbar` is for controls.)
  const labels = ui.settings.section(el, 'Badges, dots, counts, chips, avatars and swatches');
  const row = (name: string) => new ui.settings.row(labels).setName(name).controlEl;
  const badges = row('Badges');
  for (const tone of TONES) ui.badge(badges, tone, tone);
  const dots = row('Status dots');
  for (const tone of TONES) ui.statusDot(dots, tone, tone);
  ui.statusDot(dots, 'warning', 'Waiting for you', { pulse: true });
  const words = row('Status text');
  for (const tone of TONES) ui.statusText(words, tone, tone);
  const counts = row('Counts');
  ui.countBadge(counts, 3, { label: 'unread' });
  ui.countBadge(counts, 12, { label: 'waiting', tone: 'danger', icon: 'circle-help' });
  const chips = row('Chips');
  ui.chip(chips, 'project');
  ui.chip(chips, 'draft', { tone: 'accent', onRemove: () => {} });
  ui.chip(chips, 'broken', { tone: 'danger' });
  const people = row('Avatars');
  for (const size of ['small', 'medium', 'large'] as const) ui.avatar(people, { text: 'Ada Lovelace', size });
  ui.avatar(people, { text: '+3' });
  const values = row('Swatches');
  ui.swatch(values, { kind: 'color', value: 'var(--interactive-accent)', label: '--interactive-accent' });
  ui.swatch(values, { kind: 'radius', value: 'var(--radius-m)', label: '--radius-m' });
  ui.swatch(values, { kind: 'shadow', value: 'var(--shadow-s)', label: '--shadow-s' });
  ui.swatch(values, { kind: 'size', value: 'var(--size-4-6)', label: '--size-4-6' });
  ui.swatch(values, { kind: 'font-family', value: 'var(--font-monospace)', label: '--font-monospace' });

  const readings = ui.settings.section(el, 'Meters');
  const inline = new ui.settings.row(readings).setName('Inline').controlEl;
  ui.meter(inline, { label: 'Storage', value: 30, text: '30%', tone: 'success' });
  ui.meter(inline, { label: 'Quota', value: 75, text: '75%', tone: 'warning' });
  ui.meter(readings, { layout: 'stacked', label: 'Monthly budget', value: 96, text: '$48 of $50', sub: 'resets in 3 days', tone: 'danger' });

  const added = [2, 5, 3, 0, 6, 8, 4, 7, 1, 9].map((value, i) => ({ day: `Nov ${i + 12}`, value }));
  const chart = ui.settings.section(el, 'Bar chart');
  ui.barChart(chart, {
    label: 'Items added per day',
    buckets: added.map(({ day, value }) => ({ key: day, value, title: `${day}: ${count(value, 'item')}` })),
  });
  // A chart is read as one image: put the figures that matter in text beside it.
  const most = added.reduce((a, b) => (b.value > a.value ? b : a));
  const total = added.reduce((sum, d) => sum + d.value, 0);
  ui.statusText(chart, `${count(total, 'item')} added; the most, ${most.value}, on ${most.day}.`);

  const waiting = ui.settings.section(el, 'Loading');
  ui.loadingState(waiting, 'Loading items…');
  ui.loadingState(waiting, 'Importing', { progress: 0.4 });

  ui.emptyState(ui.settings.section(el, 'Empty state'), 'No items yet.');
  ui.errorState(ui.settings.section(el, 'Error state'), 'Could not load the items.', () => void ui.notice('Trying again.'));
  const small = ui.settings.section(el, 'Inline states, for a settings list');
  ui.emptyState(small, 'No accounts yet.', { variant: 'inline' });
  ui.errorState(small, 'Could not connect.', () => {}, { variant: 'inline', retryLabel: 'Reconnect' });
}
