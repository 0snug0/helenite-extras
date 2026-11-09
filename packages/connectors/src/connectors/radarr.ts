import { defineConnector, originOf, query, request, requestJson, secretRef, settingString, type ConnectorContext } from '../sdk';

export const radarr = defineConnector({
  id: 'radarr',
  name: 'Radarr',
  description: 'Movie collection manager (v3 API).',
  secrets: [{ name: 'RADARR_API_KEY', label: 'Radarr API key', required: true, hostSetting: 'RADARR_URL' }],
  settings: { RADARR_URL: { default: 'http://localhost:7878', label: 'Radarr URL' } },
  hosts: (s) => [originOf(s.RADARR_URL ?? 'http://localhost:7878')],
  client(ctx: ConnectorContext) {
    const base = () => `${settingString(ctx, 'RADARR_URL')}/api/v3`;
    const headers = { 'X-Api-Key': secretRef('RADARR_API_KEY') };
    const get = <T>(path: string, params = {}) => requestJson<T>('radarr', ctx, { url: `${base()}${path}${query(params)}`, headers });
    const send = <T>(method: string, path: string, body?: object) => requestJson<T>('radarr', ctx, { url: `${base()}${path}`, method, headers, body });
    return {
      status: () => get<any>('/system/status'),
      getMovies: () => get<any[]>('/movie'),
      getMovie: (id: number) => get<any>(`/movie/${id}`),
      async getQueue(): Promise<any[]> {
        const r = await get<{ records: any[] }>('/queue', { page: 1, pageSize: 200, includeMovie: true });
        return r.records;
      },
      lookup: (term: string) => get<any[]>('/movie/lookup', { term }),
      lookupTmdb: (tmdbId: number) => get<any>('/movie/lookup/tmdb', { tmdbId }),
      getRootFolders: () => get<any[]>('/rootfolder'),
      getQualityProfiles: () => get<any[]>('/qualityprofile'),
      getReleases: (movieId: number) => get<any[]>('/release', { movieId }),
      grabRelease: (release: { guid: string; indexerId: number }) => send<any>('POST', '/release', release),
      addMovie: (movie: object) => send<any>('POST', '/movie', movie),
      updateMovie: (movie: { id: number }) => send<any>('PUT', `/movie/${movie.id}`, movie),
      searchMovie: (movieIds: number[]) => send<any>('POST', '/command', { name: 'MoviesSearch', movieIds }),
      async removeQueueItem(id: number, opts: { removeFromClient?: boolean; blocklist?: boolean } = {}) {
        await request('radarr', ctx, { url: `${base()}/queue/${id}${query({ removeFromClient: opts.removeFromClient ?? true, blocklist: opts.blocklist ?? false })}`, method: 'DELETE', headers });
        return true;
      },
    };
  },
});
