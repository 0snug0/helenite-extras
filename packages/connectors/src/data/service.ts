import type { ProvidesSpec } from '../sdk';
import type { Contract } from './contract';
import type { DataFile } from './data-file';
import { project } from './project';
import { validate } from './schema';

export type SourceStatus = 'ready' | 'waiting-review' | 'rejected' | 'missing';

export interface DataSource {
  id: string;
  status: SourceStatus;
  provides: Record<string, ProvidesSpec>;
  invoke(method: string, args: unknown[]): Promise<unknown>;
}

export interface SourceError {
  source: string;
  kind: 'invalid' | 'waiting-review' | 'rejected' | 'missing' | 'failed';
  message: string;
  dropped?: number;
}

export interface ContractStatus {
  name: string;
  actions: string[];
  error?: string;
  sources: { id: string; status: SourceStatus }[];
}

export type DataRecord = Record<string, unknown> & { $source: string };
export type DataErrorCode = 'bad-request' | 'unsupported' | 'unavailable' | 'waiting-review';

export class DataError extends Error {
  constructor(public code: DataErrorCode, message: string) {
    super(message);
    this.name = 'DataError';
  }
}

export interface DataServiceDeps {
  contracts(): Map<string, Contract | { error: string }>;
  data(): DataFile;
  source(id: string): DataSource;
  onError?(contract: string, e: SourceError): void;
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const own = (o: object | undefined | null, k: string) => !!o && Object.hasOwn(o, k);

// Copy via defineProperty so an own `__proto__` key from untrusted JSON stays a plain property.
function copy(record: Record<string, unknown>, skip?: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) if (k !== skip) Object.defineProperty(out, k, { value: v, enumerable: true, writable: true, configurable: true });
  return out;
}
const tag = (record: Record<string, unknown>, id: string): DataRecord => {
  const out = copy(record, '$source');
  Object.defineProperty(out, '$source', { value: id, enumerable: true, writable: true, configurable: true });
  return out as DataRecord;
};

export function createDataService(deps: DataServiceDeps) {
  const contractOf = (name: string): Contract => {
    const map = deps.contracts();
    const c = map.get(name);
    if (!c) throw new DataError('unavailable', `No contract named ${name}.`);
    if ('error' in c) throw new DataError('unavailable', c.error);
    return c;
  };
  const boundIds = (name: string): string[] => {
    const b = deps.data().bindings;
    return own(b, name) && Array.isArray(b[name]) ? b[name].filter((id) => typeof id === 'string') : [];
  };

  async function listFrom(id: string, contract: Contract): Promise<{ records: DataRecord[]; error?: SourceError }> {
    const fail = (kind: SourceError['kind'], message: string, dropped?: number) => ({ records: [] as DataRecord[], error: { source: id, kind, message, ...(dropped ? { dropped } : {}) } as SourceError });
    try {
      const src = deps.source(id);
      if (src.status === 'waiting-review') return fail('waiting-review', `${id}: waiting for review`);
      if (src.status === 'rejected') return fail('rejected', `${id}: rejected`);
      if (src.status !== 'ready') return fail('missing', `${id}: not installed`);
      const spec = isObject(src.provides) && own(src.provides, contract.name) ? src.provides[contract.name] : undefined;
      if (!spec || typeof spec.list !== 'string') return fail('failed', `${id} doesn't provide ${contract.name}`);
      const raw = await src.invoke(spec.list, []);
      if (!Array.isArray(raw)) return fail('invalid', `${id}: list returned ${raw === null ? 'null' : typeof raw} instead of an array`);
      const records: DataRecord[] = [];
      let dropped = 0;
      let first = '';
      for (const item of raw) {
        const rec = isObject(item) ? project(item, contract.records) : item;
        const errs = isObject(rec) ? validate(rec, contract.records) : [`$: expected object`];
        if (errs.length || !isObject(rec)) {
          if (!dropped) first = errs[0] ?? '$: expected object';
          dropped++;
        } else records.push(tag(rec, id));
      }
      const error: SourceError | undefined = dropped
        ? { source: id, kind: 'invalid', dropped, message: `${id}: ${dropped} ${dropped === 1 ? 'record' : 'records'} didn't match ${contract.name}: ${first}` }
        : undefined;
      return { records, error };
    } catch (e) {
      return fail('failed', msg(e));
    }
  }

  return {
    async list(name: string): Promise<{ records: DataRecord[]; errors: SourceError[] }> {
      const contract = contractOf(name);
      const results = await Promise.all(boundIds(name).map((id) => listFrom(id, contract)));
      const records = results.flatMap((r) => r.records);
      const errors = results.flatMap((r) => (r.error ? [r.error] : []));
      for (const e of errors) {
        try { deps.onError?.(name, e); } catch { /* reporting must not break reads */ }
      }
      return { records, errors };
    },

    async act(name: string, action: string, record: unknown, args: unknown[]): Promise<unknown> {
      const contract = contractOf(name);
      if (!own(contract.actions, action)) throw new DataError('bad-request', `${name} has no action ${action}.`);
      if (!isObject(record)) throw new DataError('bad-request', 'record must be an object');
      const id = record.$source;
      if (typeof id !== 'string' || !boundIds(name).includes(id)) throw new DataError('bad-request', `record has no source bound to ${name}`);
      if (!Array.isArray(args)) throw new DataError('bad-request', 'args must be an array');
      const schemas = contract.actions[action].args;
      if (args.length !== schemas.length) throw new DataError('bad-request', `${action} takes ${schemas.length} argument${schemas.length === 1 ? '' : 's'}, got ${args.length}`);
      for (let i = 0; i < schemas.length; i++) {
        const errs = validate(args[i], schemas[i], `args[${i}]`);
        if (errs.length) throw new DataError('bad-request', errs[0]);
      }
      const bare = copy(record, '$source');
      const recErrs = validate(bare, contract.records);
      if (recErrs.length) throw new DataError('bad-request', `record doesn't match ${name}: ${recErrs[0]}`);

      let src: DataSource;
      try {
        src = deps.source(id);
      } catch (e) {
        throw new DataError('unavailable', msg(e));
      }
      if (src.status === 'waiting-review') throw new DataError('waiting-review', `${id}: waiting for review`);
      if (src.status !== 'ready') throw new DataError('unavailable', `${id}: ${src.status === 'rejected' ? 'rejected' : 'not installed'}`);
      const spec = isObject(src.provides) && own(src.provides, name) ? src.provides[name] : undefined;
      const method = spec && isObject(spec.actions) && own(spec.actions, action) ? spec.actions[action] : undefined;
      if (typeof method !== 'string') throw new DataError('unsupported', `${id} can't ${action}`);
      return src.invoke(method, [bare, ...args]);
    },

    contracts(names: string[]): ContractStatus[] {
      const map = deps.contracts();
      return names.map((name) => {
        const c = map.get(name);
        const sources = boundIds(name).map((id) => {
          try { return { id, status: deps.source(id).status }; } catch { return { id, status: 'missing' as SourceStatus }; }
        });
        if (!c) return { name, actions: [], error: `No contract named ${name}.`, sources };
        if ('error' in c) return { name, actions: [], error: c.error, sources };
        return { name, actions: Object.keys(c.actions), sources };
      });
    },
  };
}
