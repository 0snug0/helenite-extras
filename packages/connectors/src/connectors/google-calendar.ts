import { defineConnector, query, requestJson, secretRef, type ConnectorContext } from '../sdk';

const API = 'https://www.googleapis.com';
export const GCAL_SECRETS = { access: 'GCAL_ACCESS_TOKEN', refresh: 'GCAL_REFRESH_TOKEN', clientId: 'GCAL_CLIENT_ID', clientSecret: 'GCAL_CLIENT_SECRET' } as const;

export interface CalendarEvent { id: string; summary: string; start: string; end: string; allDay: boolean; location?: string; htmlLink?: string }

const norm = (e: any): CalendarEvent => ({
  id: e.id, summary: e.summary ?? '(no title)',
  start: e.start?.dateTime ?? e.start?.date, end: e.end?.dateTime ?? e.end?.date,
  allDay: !e.start?.dateTime, location: e.location, htmlLink: e.htmlLink,
});

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
