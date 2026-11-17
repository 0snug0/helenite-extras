import { defineConnector, type ConnectorAccounts, type ConnectorContext } from '../sdk';

type Events = ConnectorAccounts['calendarEvents'];

/** Merged calendars from the accounts granted to this vault. No secrets, no network of its own: the host reads accounts in main. */
export const calendar = defineConnector({
  id: 'calendar',
  name: 'Calendar',
  description: 'Read-only events merged from the calendar accounts granted to this vault. Manage in Settings → Accounts.',
  secrets: [],
  settings: {},
  hosts: () => [],
  client(ctx: ConnectorContext) {
    const need = (): ConnectorAccounts => {
      if (!ctx.accounts) throw new Error("Accounts aren't available in this vault");
      return ctx.accounts;
    };
    return {
      /** Calendar-granted accounts only. */
      async accounts(): Promise<{ id: string; label: string }[]> {
        return need().list().filter((a) => a.services.includes('calendar')).map((a) => ({ id: a.id, label: a.label }));
      },
      async events(o: { from: string; to: string; accounts?: string[] }): ReturnType<Events> {
        return need().calendarEvents(o);
      },
    };
  },
});
