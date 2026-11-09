import { defineConnector, query, requestJson, secretRef, type ConnectorContext } from '../sdk';

const API = 'https://api.themoviedb.org';
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

export const tmdb = defineConnector({
  id: 'tmdb',
  name: 'TMDB',
  description: 'The Movie Database (v4 read token as a bearer).',
  secrets: [{ name: 'TMDB_TOKEN', label: 'TMDB read access token', required: true, host: API }],
  settings: {},
  hosts: () => [API, 'https://image.tmdb.org'],
  client(ctx: ConnectorContext) {
    const headers = { Authorization: `Bearer ${secretRef('TMDB_TOKEN')}`, Accept: 'application/json' };
    const get = <T>(path: string, params = {}) => requestJson<T>('tmdb', ctx, { url: `${API}/3${path}${query(params)}`, headers });
    return {
      imageUrl: (path: string, size = 'w342') => `${TMDB_IMAGE_BASE}/${size}${path}`,
      getMovie: (id: number) => get<any>(`/movie/${id}`),
      searchMovie: (q: string, year?: number) => get<{ results: any[] }>('/search/movie', { query: q, year }).then((r) => r.results),
      getRecommendations: (id: number) => get<{ results: any[] }>(`/movie/${id}/recommendations`).then((r) => r.results),
      /** Streaming providers per country (default US). */
      async getProviders(id: number, country = 'US'): Promise<any> {
        const r = await get<{ results: Record<string, any> }>(`/movie/${id}/watch/providers`);
        return r.results?.[country] ?? null;
      },
      getReleaseDates: (id: number) => get<any>(`/movie/${id}/release_dates`),
      upcoming: () => get<{ results: any[] }>('/movie/upcoming').then((r) => r.results),
    };
  },
});
