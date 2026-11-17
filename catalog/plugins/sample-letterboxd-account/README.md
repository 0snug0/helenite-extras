# Letterboxd account (sample)

An example community plugin that adds a **Letterboxd** account type to Helenite. It is not a core plugin and is not loaded automatically. It exists to show the account-type contract end to end.

## Install

1. Build it: `node plugins/core-build/build.mjs sample-letterboxd-account` (output in `dist/`).
2. Copy `dist/manifest.json` and `dist/main.js` into a folder named after the plugin id inside **Home's** plugins folder, for example `<Home>/.obsidian/plugins/letterboxd-account/`.
3. In Home, open Settings, Community plugins, and enable "Letterboxd account (sample)". Account-type plugins are managed only in Home; once enabled there they are on in every vault window.
4. In Settings, Accounts, choose **Add account**, then **Letterboxd**, and enter your username.
5. Grant "Read diary" and "Read watchlist" to the vaults that should have them.

## What it demonstrates

- **Declared in the manifest.** `manifest.json` has `helenite.scope: "accounts"` and `helenite.accountTypes`: the type's hosts, secrets, capabilities (with risk) and which capability each method needs. Main trusts only this, never anything code says at run time.
- **`registerAccountType`.** `src/main.ts` registers `connect(el, ctx)` (the form; `ctx.save` stores the account and what it holds) and `methods` (`diary`, `watchlist`).
- **Calling it.** Any plugin in a window can run `await app.accounts.call({ account: 'Letterboxd (me)', method: 'diary' })`. Main checks that the vault was granted `diary.read`, then the method runs with a `ctx.fetch` that only reaches `https://letterboxd.com`.
- **Paths.** Each capability lists the URL paths it may reach (`"paths": ["/*/rss/"]`; `*` matches one segment, matching is by prefix), so `diary.read` and `watchlist.read` are distinguishable. Main rejects a type whose capabilities overlap in method and path.
- **No secrets.** Letterboxd's public RSS and watchlist pages need no credential, so `secrets` is empty. An account type that does need one declares uppercase names in `secrets`, passes values in `ctx.save({ secrets })`, and writes `{{secret:NAME}}` in `ctx.fetch` requests; main fills them in and the plugin never sees the value again.

## What the grant is worth here

Because this sample stores no secret, the grant mainly demonstrates the flow: vault code could fetch Letterboxd's public pages without it. The enforcement matters for account types that do hold a secret: main limits their requests to the declared hosts, methods and paths, fills in the secret itself, and redacts it from responses.

Scraping is best effort: Letterboxd's markup can change.
