// JSON Schema subset validator for agent-job output: type, enum, const, properties, required, additionalProperties,
// items, minItems/maxItems, minimum/maximum, minLength/maxLength, pattern, anyOf. Enough for an output contract;
// unknown keywords are rejected so a schema never silently validates nothing.
export type JsonSchema = Record<string, any>;
type Schema = JsonSchema;
const KNOWN = new Set(['type', 'enum', 'const', 'properties', 'required', 'additionalProperties', 'items', 'minItems', 'maxItems', 'minimum', 'maximum', 'minLength', 'maxLength', 'pattern', 'anyOf', 'description', 'title', '$schema', 'default']);

/** Longer patterns are refused: a contract is vault-controlled and a regex runs on every record. */
export const MAX_PATTERN = 200;
const patternError = (p: unknown): string | null => {
  if (typeof p !== 'string') return 'pattern must be a string';
  if (p.length > MAX_PATTERN) return `pattern is longer than ${MAX_PATTERN} chars`;
  try {
    new RegExp(p);
    return null;
  } catch {
    return 'pattern is not a valid regular expression';
  }
};

const typeOf = (v: unknown) => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v);
const isType = (v: unknown, t: string) => (t === 'number' ? typeof v === 'number' : t === 'integer' ? Number.isInteger(v) : typeOf(v) === t);

export function validate(value: unknown, schema: Schema, at = '$'): string[] {
  const errs: string[] = [];
  for (const k of Object.keys(schema)) if (!KNOWN.has(k)) errs.push(`${at}: unsupported schema keyword "${k}"`);
  if (errs.length) return errs;
  if (schema.type) {
    const ts: string[] = [].concat(schema.type);
    if (!ts.some((t) => isType(value, t))) return [`${at}: expected ${ts.join('|')}, got ${typeOf(value)}`];
  }
  if ('const' in schema && JSON.stringify(schema.const) !== JSON.stringify(value)) errs.push(`${at}: must equal ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.some((e: unknown) => JSON.stringify(e) === JSON.stringify(value))) errs.push(`${at}: must be one of ${JSON.stringify(schema.enum)}`);
  if (schema.anyOf && !schema.anyOf.some((s: Schema) => validate(value, s, at).length === 0)) errs.push(`${at}: matches none of anyOf`);
  if (typeof value === 'number') {
    if (schema.minimum != null && value < schema.minimum) errs.push(`${at}: below minimum ${schema.minimum}`);
    if (schema.maximum != null && value > schema.maximum) errs.push(`${at}: above maximum ${schema.maximum}`);
  }
  if (typeof value === 'string') {
    if (schema.minLength != null && value.length < schema.minLength) errs.push(`${at}: shorter than ${schema.minLength}`);
    if (schema.maxLength != null && value.length > schema.maxLength) errs.push(`${at}: longer than ${schema.maxLength}`);
    if (schema.pattern !== undefined) {
      const bad = patternError(schema.pattern);
      if (bad) errs.push(`${at}: ${bad}`);
      else if (!new RegExp(schema.pattern).test(value)) errs.push(`${at}: does not match ${schema.pattern}`);
    }
  }
  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) errs.push(`${at}: fewer than ${schema.minItems} items`);
    if (schema.maxItems != null && value.length > schema.maxItems) errs.push(`${at}: more than ${schema.maxItems} items`);
    if (schema.items) value.forEach((v, i) => errs.push(...validate(v, schema.items, `${at}[${i}]`)));
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const o = value as Record<string, unknown>;
    for (const r of schema.required ?? []) if (!Object.hasOwn(o, r)) errs.push(`${at}: missing required "${r}"`);
    for (const [k, v] of Object.entries(o)) {
      if (Object.hasOwn(schema.properties ?? {}, k) && schema.properties[k]) errs.push(...validate(v, schema.properties[k], `${at}.${k}`));
      else if (schema.additionalProperties === false) errs.push(`${at}: unexpected property "${k}"`);
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') errs.push(...validate(v, schema.additionalProperties, `${at}.${k}`));
    }
  }
  return errs;
}

// Static schema lint: unknown keywords anywhere, patterns that don't compile or are too long, and the reserved `$source` key declared under any `properties`.
export function checkSchema(schema: JsonSchema, at = '$'): string[] {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return [`${at}: schema must be an object`];
  const errs: string[] = [];
  for (const k of Object.keys(schema)) if (!KNOWN.has(k)) errs.push(`${at}: unsupported schema keyword "${k}"`);
  if (schema.pattern !== undefined) {
    const bad = patternError(schema.pattern);
    if (bad) errs.push(`${at}: ${bad}`);
  }
  if (schema.properties !== undefined) {
    if (!schema.properties || typeof schema.properties !== 'object' || Array.isArray(schema.properties)) errs.push(`${at}: properties must be an object`);
    else
      for (const [k, v] of Object.entries<JsonSchema>(schema.properties)) {
        if (k === '$source') errs.push(`${at}.properties: "$source" is reserved`);
        errs.push(...checkSchema(v, `${at}.${k}`));
      }
  }
  if (schema.items !== undefined) errs.push(...checkSchema(schema.items, `${at}[]`));
  if (schema.additionalProperties && typeof schema.additionalProperties === 'object') errs.push(...checkSchema(schema.additionalProperties, `${at}.*`));
  if (schema.anyOf !== undefined) {
    if (!Array.isArray(schema.anyOf)) errs.push(`${at}: anyOf must be an array`);
    else schema.anyOf.forEach((s: JsonSchema, i: number) => errs.push(...checkSchema(s, `${at}.anyOf[${i}]`)));
  }
  return errs;
}
