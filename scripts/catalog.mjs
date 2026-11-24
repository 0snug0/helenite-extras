// The rules for catalog.json. The app's plugin browser (plugins/core-plugin-browser/src/extras.ts) applies the same rules
// when it reads the catalog, so keep the two in step.
export const KINDS = ['plugin', 'theme', 'app', 'design-system'];
export const ROOTS = ['catalog/', 'templates/'];
const ID = /^[a-z0-9][a-z0-9-]*$/;
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

/** A relative path inside the repository: no leading slash or drive, no empty, `.` or `..` segment, no backslash. */
export function safeRelative(p) {
  if (typeof p !== 'string' || p === '' || p.startsWith('/') || p.includes('\\') || /^[A-Za-z]:/.test(p)) return false;
  return p.split('/').every((s) => s !== '' && s !== '.' && s !== '..');
}

const text = (v) => typeof v === 'string' && v.trim() !== '';

/**
 * @param {unknown} json `{ entries: CatalogEntry[] }`
 * @returns {{ entries: object[], errors: string[] }} the entries that passed, and one message per entry that did not
 */
export function validateCatalog(json) {
  const errors = [];
  const entries = [];
  const list = json && typeof json === 'object' ? json.entries : undefined;
  if (!Array.isArray(list)) return { entries, errors: ['catalog.json has no "entries" array'] };
  const seen = new Set();
  list.forEach((e, i) => {
    const at = `entries[${i}]${e && typeof e.id === 'string' ? ` (${e.id})` : ''}`;
    const fail = (why) => void errors.push(`${at}: ${why}`);
    if (!e || typeof e !== 'object') return fail('not an object');
    if (typeof e.id !== 'string' || !ID.test(e.id)) return fail('id must match ^[a-z0-9][a-z0-9-]*$');
    if (seen.has(e.id)) return fail('duplicate id');
    for (const k of ['name', 'description', 'author']) if (!text(e[k])) return fail(`${k} is required`);
    if (!KINDS.includes(e.kind)) return fail(`kind must be one of ${KINDS.join(', ')}`);
    const hasPath = e.path !== undefined;
    const hasRepo = e.repo !== undefined;
    if (hasPath === hasRepo) return fail('needs exactly one of path or repo');
    if (hasRepo) {
      if (typeof e.repo !== 'string' || !REPO.test(e.repo)) return fail('repo must be owner/name');
      if (e.files !== undefined) return fail('files belongs to path entries');
    } else {
      if (!safeRelative(e.path) || !ROOTS.some((r) => e.path.startsWith(r))) return fail(`path must be relative, without "..", and start with ${ROOTS.join(' or ')}`);
      if (!Array.isArray(e.files) || e.files.length === 0 || !e.files.every(safeRelative)) return fail('files must be a non-empty list of relative paths without ".."');
    }
    seen.add(e.id);
    const { id, name, kind, description, author, path, repo, files } = e;
    entries.push({ id, name, kind, description, author, ...(path !== undefined ? { path, files: [...files] } : { repo }) });
  });
  return { entries, errors };
}
