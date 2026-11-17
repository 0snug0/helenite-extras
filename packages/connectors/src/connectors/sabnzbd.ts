import { defineConnector, originOf, query, requestJson, secretRef, settingString, type ConnectorContext } from '../sdk';

const MB = 1048576;
const SAB_STATUS: Record<string, string> = { Paused: 'paused', Queued: 'queued', Grabbing: 'queued', Fetching: 'queued', Propagating: 'queued', Completed: 'completed', Failed: 'failed' };

/** One SABnzbd queue slot as a `download-queue` record. */
export function toDownload(slot: any) {
  const mb = Number(slot.mb) || 0;
  const mbLeft = Number(slot.mbleft) || 0;
  const rec: { id: string; name: string; status: string; progress: number; sizeBytes: number; leftBytes: number; etaSeconds?: number } = {
    id: String(slot.nzo_id),
    name: String(slot.filename ?? ''),
    status: SAB_STATUS[String(slot.status)] ?? 'downloading',
    progress: mb ? Math.min(1, Math.max(0, (mb - mbLeft) / mb)) : 0,
    sizeBytes: mb * MB,
    leftBytes: mbLeft * MB,
  };
  const t = String(slot.timeleft ?? '').match(/^(\d+):(\d{1,2}):(\d{1,2})$/);
  if (t) rec.etaSeconds = Number(t[1]) * 3600 + Number(t[2]) * 60 + Number(t[3]);
  return rec;
}

export const sabnzbd = defineConnector({
  id: 'sabnzbd',
  name: 'SABnzbd',
  description: 'Usenet downloader.',
  secrets: [{ name: 'SABNZBD_API_KEY', label: 'SABnzbd API key', required: true, hostSetting: 'SABNZBD_URL' }],
  settings: { SABNZBD_URL: { default: 'http://localhost:8080', label: 'SABnzbd URL' } },
  hosts: (s) => [originOf(s.SABNZBD_URL ?? 'http://localhost:8080')],
  provides: { 'download-queue': { list: 'listQueue', actions: { pause: 'pauseRecord', resume: 'resumeRecord', remove: 'removeRecord' } } },
  client(ctx: ConnectorContext) {
    // SABnzbd only takes the key as a query parameter; the host encodes the placeholder's value for us.
    const call = async <T>(mode: string, params: Record<string, string | number | boolean | undefined> = {}): Promise<T> => {
      const url = `${settingString(ctx, 'SABNZBD_URL')}/api${query({ mode, output: 'json', ...params })}&apikey=${secretRef('SABNZBD_API_KEY')}`;
      return requestJson<T>('sabnzbd', ctx, { url });
    };
    const client = {
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
      async listQueue() { return (await client.getQueue()).slots.map(toDownload); },
      pauseRecord: (rec: { id: string }) => client.pauseJob(rec.id),
      resumeRecord: (rec: { id: string }) => client.resumeJob(rec.id),
      removeRecord: (rec: { id: string }, deleteFiles = true) => client.deleteJob(rec.id, deleteFiles),
    };
    return client;
  },
});
