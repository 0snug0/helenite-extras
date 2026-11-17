import { defineConnector, query, requestJson, secretRef, type ConnectorAccounts, type ConnectorContext } from '../sdk';

const API = 'https://www.googleapis.com';
export const GCAL_SECRETS = { access: 'GCAL_ACCESS_TOKEN', refresh: 'GCAL_REFRESH_TOKEN', clientId: 'GCAL_CLIENT_ID', clientSecret: 'GCAL_CLIENT_SECRET' } as const;

export interface CalendarEvent { id: string; summary: string; start: string; end: string; allDay: boolean; location?: string; htmlLink?: string }

const norm = (e: any): CalendarEvent => ({
  id: e.id, summary: e.summary ?? '(no title)',
  start: e.start?.dateTime ?? e.start?.date, end: e.end?.dateTime ?? e.end?.date,
  allDay: !e.start?.dateTime, location: e.location, htmlLink: e.htmlLink,
});

// With accounts present this connector is an alias: Google accounts granted to the vault, no GCAL_* secrets, no ctx.fetch.
const googleAccounts = (acc: ConnectorAccounts) => acc.list().filter((a) => a.provider === 'google' && a.services.includes('calendar'));

function accountBacked(acc: ConnectorAccounts) {
  return {
    async listCalendars(): Promise<{ id: string; summary: string; primary: boolean }[]> {
      return googleAccounts(acc).map((a, i) => ({ id: a.id, summary: a.label, primary: i === 0 }));
    },
    async listEvents(opts: { calendarId?: string; timeMin: string; timeMax: string; max?: number }): Promise<CalendarEvent[]> {
      const ids = googleAccounts(acc).map((a) => a.id);
      if (!ids.length) return [];
      const { events, errors } = await acc.calendarEvents({ from: opts.timeMin, to: opts.timeMax, accounts: ids });
      // The pre-accounts contract had no partial results: a failing account (e.g. "Reconnect …") is an error, not an empty list.
      if (errors.length) throw new Error(errors[0].message);
      const mapped = events.map(({ id, summary, start, end, allDay, location, htmlLink }): CalendarEvent => ({ id, summary, start, end, allDay, location, htmlLink }));
      return opts.max ? mapped.slice(0, opts.max) : mapped;
    },
  };
}

export const googleCalendar = defineConnector({
  id: 'google-calendar',
  name: 'Google Calendar',
  description: 'Read-only calendar events. Connect once in Settings → Secrets; tokens live in the keychain and are refreshed by the host.',
  secrets: [
    { name: GCAL_SECRETS.access, label: 'Google access token (managed)', required: false, host: API },
    { name: GCAL_SECRETS.refresh, label: 'Google refresh token (managed)', required: false, host: 'https://oauth2.googleapis.com' },
    { name: GCAL_SECRETS.clientId, label: 'Google OAuth client ID', required: true, host: 'https://oauth2.googleapis.com' },
    { name: GCAL_SECRETS.clientSecret, label: 'Google OAuth client secret', required: false, host: 'https://oauth2.googleapis.com' },
  ],
  settings: {},
  hosts: () => [API],
  client(ctx: ConnectorContext) {
    const acc = ctx.accounts;
    if (acc) return accountBacked(acc);
    const get = async <T>(path: string, params = {}): Promise<T> => {
      await ctx.ensureAuth?.('google-calendar');
      return requestJson<T>('google-calendar', ctx, { url: `${API}/calendar/v3${path}${query(params)}`, headers: { Authorization: `Bearer ${secretRef(GCAL_SECRETS.access)}` } });
    };
    return {
      async listCalendars(): Promise<{ id: string; summary: string; primary: boolean }[]> {
        return (await get<{ items: any[] }>('/users/me/calendarList')).items.map((c) => ({ id: c.id, summary: c.summary, primary: !!c.primary }));
      },
      async listEvents(opts: { calendarId?: string; timeMin: string; timeMax: string; max?: number }): Promise<CalendarEvent[]> {
        const r = await get<{ items: any[] }>(`/calendars/${encodeURIComponent(opts.calendarId ?? 'primary')}/events`, {
          timeMin: opts.timeMin, timeMax: opts.timeMax, singleEvents: true, orderBy: 'startTime', maxResults: opts.max ?? 100,
        });
        return (r.items ?? []).filter((e) => e.status !== 'cancelled').map(norm);
      },
    };
  },
});
