// globalSetup of every vitest config here, so a unit test run leaves no temp folder behind (HELENITE-180).
// Inside the app, which mounts this repository at extras/, the app's scripts/lib/vitest-cleanup.mjs does the work: a
// temp folder per run, the processes and launchd jobs started under it, and runs that are killed or orphaned.
// A standalone clone has no app: the run gets a temp folder of its own as TMPDIR, removed when it ends.
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default async function setup(project) {
  const app = new URL('../../scripts/lib/vitest-cleanup.mjs', import.meta.url);
  if (existsSync(app)) return (await import(/* @vite-ignore */ app.href)).default(project);

  const dir = mkdtempSync(join(tmpdir(), 'hlx-'));
  const before = process.env.TMPDIR;
  // Workers are started after this and inherit it.
  process.env.TMPDIR = dir;
  return () => {
    if (before === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = before;
    if (!process.env.HELENITE_TEST_KEEP) rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  };
}
