import { defineConnector, originOf, query, requestJson, secretRef, settingString, type ConnectorContext } from '../sdk';

export const plex = defineConnector({
  id: 'plex',
  name: 'Plex',
  description: 'Plex Media Server library.',
  secrets: [{ name: 'PLEX_TOKEN', label: 'Plex token', required: true, hostSetting: 'PLEX_URL' }],
  settings: { PLEX_URL: { default: 'http://localhost:32400', label: 'Plex URL' } },
  hosts: (s) => [originOf(s.PLEX_URL ?? 'http://localhost:32400')],
  client(ctx: ConnectorContext) {
    const headers = { 'X-Plex-Token': secretRef('PLEX_TOKEN'), Accept: 'application/json' };
    const get = async <T>(path: string, params = {}): Promise<T> => (await requestJson<{ MediaContainer: T }>('plex', ctx, { url: `${settingString(ctx, 'PLEX_URL')}${path}${query(params)}`, headers })).MediaContainer;
    return {
      async getLibraries(): Promise<any[]> { return (await get<any>('/library/sections')).Directory ?? []; },
      async getLibraryItems(sectionKey: string | number): Promise<any[]> { return (await get<any>(`/library/sections/${sectionKey}/all`)).Metadata ?? []; },
      async search(q: string): Promise<any[]> { return (await get<any>('/library/search', { query: q, limit: 50 })).SearchResult ?? (await get<any>('/search', { query: q })).Metadata ?? []; },
      async recentlyAdded(): Promise<any[]> { return (await get<any>('/library/recentlyAdded')).Metadata ?? []; },
      /** Is a film (by title, optional year) in any movie library? Titles compare case-insensitively. */
      async hasMovie(title: string, year?: number): Promise<boolean> {
        const sections = (await get<any>('/library/sections')).Directory ?? [];
        const want = title.trim().toLowerCase();
        for (const s of sections.filter((d: any) => d.type === 'movie')) {
          const items = (await get<any>(`/library/sections/${s.key}/all`, { title: title })).Metadata ?? [];
          if (items.some((m: any) => String(m.title).toLowerCase() === want && (year == null || m.year === year))) return true;
        }
        return false;
      },
    };
  },
});
