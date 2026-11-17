import { describe, expect, it, vi } from 'vitest';
import { calendar, googleCalendar, type ConnectorAccounts, type ConnectorContext } from '../src';

const ev = (account: string, id: string) => ({ id, calendarId: 'primary', summary: `S-${id}`, start: '2026-01-01T10:00:00Z', end: '2026-01-01T11:00:00Z', allDay: false, location: 'L', htmlLink: 'h', account });
const fakeAccounts = (): ConnectorAccounts & { calls: any[] } => {
  const calls: any[] = [];
  return {
    calls,
    list: () => [
      { id: 'g1', label: 'Work', provider: 'google', services: ['calendar', 'mail'] },
      { id: 'g2', label: 'Mail only', provider: 'google', services: ['mail'] },
      { id: 'i1', label: 'iCloud', provider: 'icloud', services: ['calendar'] },
    ],
    calendarEvents: async (o) => { calls.push(o); return { events: [ev('g1', 'a')], errors: [] }; },
  };
};
const ctxOf = (accounts?: ConnectorAccounts): ConnectorContext & { fetch: ReturnType<typeof vi.fn> } => ({ fetch: vi.fn(async () => ({ status: 500, headers: {}, text: '' })), settings: {}, accounts });

describe('calendar connector', () => {
  it('passes from/to/accounts through and returns the merged result', async () => {
    const acc = fakeAccounts();
    const c = calendar.client(ctxOf(acc));
    const r = await c.events({ from: 'F', to: 'T', accounts: ['g1'] });
    expect(acc.calls).toEqual([{ from: 'F', to: 'T', accounts: ['g1'] }]);
    expect(r.events[0].account).toBe('g1');
  });
  it('lists calendar-granted accounts only', async () => {
    expect(await calendar.client(ctxOf(fakeAccounts())).accounts()).toEqual([{ id: 'g1', label: 'Work' }, { id: 'i1', label: 'iCloud' }]);
  });
  it('rejects without ctx.accounts', async () => {
    const c = calendar.client(ctxOf());
    await expect(c.events({ from: 'F', to: 'T' })).rejects.toThrow("Accounts aren't available in this vault");
    await expect(c.accounts()).rejects.toThrow("Accounts aren't available in this vault");
  });
  it('declares no secrets and no hosts', () => {
    expect(calendar.secrets).toEqual([]);
    expect(calendar.hosts({})).toEqual([]);
  });
});

describe('google-calendar alias', () => {
  it('delegates listEvents to accounts for Google calendar accounts, with zero fetches', async () => {
    const acc = fakeAccounts();
    const ctx = ctxOf(acc);
    const out = await googleCalendar.client(ctx).listEvents({ timeMin: 'F', timeMax: 'T' });
    expect(ctx.fetch).not.toHaveBeenCalled();
    expect(acc.calls).toEqual([{ from: 'F', to: 'T', accounts: ['g1'] }]);
    expect(out).toEqual([{ id: 'a', summary: 'S-a', start: '2026-01-01T10:00:00Z', end: '2026-01-01T11:00:00Z', allDay: false, location: 'L', htmlLink: 'h' }]);
  });
  it('derives listCalendars from granted Google accounts without fetching', async () => {
    const ctx = ctxOf(fakeAccounts());
    expect(await googleCalendar.client(ctx).listCalendars()).toEqual([{ id: 'g1', summary: 'Work', primary: true }]);
    expect(ctx.fetch).not.toHaveBeenCalled();
  });
  it('throws the first account error instead of returning partial or empty results', async () => {
    const acc = {
      ...fakeAccounts(),
      calendarEvents: async () => ({ events: [ev('g1', 'a')], errors: [{ account: 'Work', message: 'Reconnect Work in Settings → Accounts' }, { account: 'Other', message: 'second' }] }),
    };
    await expect(googleCalendar.client(ctxOf(acc)).listEvents({ timeMin: 'F', timeMax: 'T' })).rejects.toThrow('Reconnect Work in Settings → Accounts');
  });
  it('returns no events when no Google account is granted', async () => {
    const acc = { ...fakeAccounts(), list: () => [] };
    expect(await googleCalendar.client(ctxOf(acc)).listEvents({ timeMin: 'F', timeMax: 'T' })).toEqual([]);
  });
});
