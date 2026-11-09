import { defineConnector, originOf, query, request, requestJson, secretRef, settingString, type ConnectorContext } from '../sdk';

export const sonarr = defineConnector({
  id: 'sonarr',
  name: 'Sonarr',
  description: 'TV series manager (v3 API).',
  secrets: [{ name: 'SONARR_API_KEY', label: 'Sonarr API key', required: true, hostSetting: 'SONARR_URL' }],
  settings: { SONARR_URL: { default: 'http://localhost:8989', label: 'Sonarr URL' } },
  hosts: (s) => [originOf(s.SONARR_URL ?? 'http://localhost:8989')],
  client(ctx: ConnectorContext) {
    const base = () => `${settingString(ctx, 'SONARR_URL')}/api/v3`;
    const headers = { 'X-Api-Key': secretRef('SONARR_API_KEY') };
    const get = <T>(path: string, params = {}) => requestJson<T>('sonarr', ctx, { url: `${base()}${path}${query(params)}`, headers });
    const send = <T>(method: string, path: string, body?: object) => requestJson<T>('sonarr', ctx, { url: `${base()}${path}`, method, headers, body });
    return {
      status: () => get<any>('/system/status'),
      getSeries: () => get<any[]>('/series'),
      getSeriesById: (id: number) => get<any>(`/series/${id}`),
      getEpisodes: (seriesId: number) => get<any[]>('/episode', { seriesId }),
      async getQueue(): Promise<any[]> {
        const r = await get<{ records: any[] }>('/queue', { page: 1, pageSize: 200, includeSeries: true, includeEpisode: true });
        return r.records;
      },
      getCalendar: (start: string, end: string) => get<any[]>('/calendar', { start, end, includeSeries: true }),
      lookup: (term: string) => get<any[]>('/series/lookup', { term }),
      getRootFolders: () => get<any[]>('/rootfolder'),
      getQualityProfiles: () => get<any[]>('/qualityprofile'),
      getReleases: (episodeId: number) => get<any[]>('/release', { episodeId }),
      grabRelease: (release: { guid: string; indexerId: number }) => send<any>('POST', '/release', release),
      addSeries: (series: object) => send<any>('POST', '/series', series),
      searchSeries: (seriesId: number) => send<any>('POST', '/command', { name: 'SeriesSearch', seriesId }),
      async removeQueueItem(id: number, opts: { removeFromClient?: boolean; blocklist?: boolean } = {}) {
        await request('sonarr', ctx, { url: `${base()}/queue/${id}${query({ removeFromClient: opts.removeFromClient ?? true, blocklist: opts.blocklist ?? false })}`, method: 'DELETE', headers });
        return true;
      },
    };
  },
});
