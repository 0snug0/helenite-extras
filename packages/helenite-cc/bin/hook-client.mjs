#!/usr/bin/env node
// `node hook-client.mjs <EventName>`: reads the hook JSON on stdin, POSTs it to the Helenite bridge
// (HELENITE_HOOK_URL), prints the reply. Fails open: a closed app never blocks the CLI.
const event = process.argv[2] || 'unknown';
const url = process.env.HELENITE_HOOK_URL;
const token = process.env.HELENITE_HOOK_TOKEN;

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (input += c));
process.stdin.on('end', async () => {
  if (!url) process.exit(0);
  try {
    const res = await fetch(`${url}/hook/${encodeURIComponent(event)}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-helenite-token': token ?? '',
        'x-helenite-session': process.env.HELENITE_SESSION_ID ?? '',
        'x-helenite-tab': process.env.HELENITE_TAB ?? '',
      },
      body: input || '{}',
      // No timeout here: the CLI's per-hook `timeout` bounds us, and a disconnect cancels the block.
    });
    const body = await res.text();
    if (body && body !== '{}') process.stdout.write(body);
  } catch (e) {
    process.stderr.write(`helenite-hook: ${e.message}\n`);
  }
  process.exit(0);
});
