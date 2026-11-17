import type { JsonSchema } from './schema';

// Drop keys the schema does not declare. Recurses through `properties` and `items`. Values under `anyOf` or an
// object-valued `additionalProperties` are kept unchanged: the schema permits shapes projection cannot pick between.
export function project(value: unknown, schema: JsonSchema): unknown {
  if (schema.anyOf) return value;
  if (Array.isArray(value)) return schema.items ? value.map((v) => project(v, schema.items)) : value;
  if (!value || typeof value !== 'object') return value;
  const extra = schema.additionalProperties;
  if (extra && extra !== false) return value;
  const props: Record<string, JsonSchema> = schema.properties ?? {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) if (k in props) out[k] = project(v, props[k]);
  return out;
}
