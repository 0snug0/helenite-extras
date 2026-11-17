import { checkSchema, type JsonSchema } from './schema';

export interface Contract {
  name: string;
  records: JsonSchema;
  actions: Record<string, { args: JsonSchema[] }>;
}

const isObject = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);

// A contract file is either a bare records schema, or an object with a top-level `records` key (plus optional `actions`).
export function parseContract(name: string, text: string): { contract: Contract } | { error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { error: `${name}: not valid JSON` };
  }
  if (!isObject(raw)) return { error: `${name}: contract must be a JSON object` };
  const records: JsonSchema = 'records' in raw ? raw.records : raw;
  const rawActions = 'records' in raw ? (raw.actions ?? {}) : {};
  if (!isObject(records)) return { error: `${name}: records must be a schema object` };
  if (!isObject(rawActions)) return { error: `${name}: actions must be an object` };
  const errs = checkSchema(records).map((e) => `${name}: records ${e}`);
  const actions: Contract['actions'] = {};
  for (const [action, def] of Object.entries<any>(rawActions)) {
    if (!isObject(def) || !Array.isArray(def.args) || !def.args.every(isObject)) {
      errs.push(`${name}: actions.${action}.args must be an array of schemas`);
      continue;
    }
    def.args.forEach((a: JsonSchema, i: number) => errs.push(...checkSchema(a).map((e) => `${name}: actions.${action}.args[${i}] ${e}`)));
    actions[action] = { args: def.args };
  }
  return errs.length ? { error: errs.join('; ') } : { contract: { name, records, actions } };
}
