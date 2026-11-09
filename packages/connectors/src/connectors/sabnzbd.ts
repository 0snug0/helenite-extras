import { defineConnector, originOf, query, requestJson, secretRef, settingString, type ConnectorContext } from '../sdk';

export const sabnzbd = defineConnector({
  id: 'sabnzbd',
  name: 'SABnzbd',
  description: 'Usenet downloader.',
  secrets: [{ name: 'SABNZBD_API_KEY', label: 'SABnzbd API key', required: true, hostSetting: 'SABNZBD_URL' }],
  settings: { SABNZBD_URL: { default: 'http://localhost:8080', label: 'SABnzbd URL' } },
  hosts: (s) => [originOf(s.SABNZBD_URL ?? 'http://localhost:8080')],
  client(ctx: ConnectorContext) {
    // SABnzbd only takes the key as a query parameter; the host encodes the placeholder's value for us.
    const call = async <T>(mode: string, params: Record<string, string | number | boolean | undefined> = {}): Promise<T> => {
      const url = `${settingString(ctx, 'SABNZBD_URL')}/api${query({ mode, output: 'json', ...params })}&apikey=${secretRef('SABNZBD_API_KEY')}`;
      return requestJson<T>('sabnzbd', ctx, { url });
    };
    return {
      async getQueue(): Promise<{ paused: boolean; speed: string; slots: any[] }> {
        const r = await call<{ queue: any }>('queue');
        return { paused: !!r.queue.paused, speed: String(r.queue.speed ?? ''), slots: r.queue.slots ?? [] };
      },
      async getHistory(limit = 50): Promise<any[]> {
        const r = await call<{ history: { slots: any[] } }>('history', { limit });
        return r.history.slots ?? [];
      },
      pauseQueue: () => call<any>('pause'),
      resumeQueue: () => call<any>('resume'),
      pauseJob: (nzoId: string) => call<any>('queue', { name: 'pause', value: nzoId }),
      resumeJob: (nzoId: string) => call<any>('queue', { name: 'resume', value: nzoId }),
      deleteJob: (nzoId: string, delFiles = true) => call<any>('queue', { name: 'delete', value: nzoId, del_files: delFiles ? 1 : 0 }),
      version: () => call<{ version: string }>('version'),
    };
  },
});
