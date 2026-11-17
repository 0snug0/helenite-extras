# Letterboxd account (sample)

An example community plugin that adds a **Letterboxd** account type to Helenite. It is not a core plugin and is not loaded automatically. It exists to show the account-type contract end to end.

## Two entry points

A plugin that offers an account type has two independent entries. The author chooses either or both:

| Entry | File | Loads in | When |
| --- | --- | --- | --- |
| Account type | `accounts.js` (from `src/accounts.ts`) | every window, Home and all vaults | while the plugin is enabled in Home; vault overrides do not affect it, and only Home's installed copy counts |
| Vault features | `main.js` (from `src/main.ts`) | each vault | the normal rules: on globally, or on or off per vault, or a vault-local copy |

- `manifest.json` names them: `"main": "main.js"` and `"helenite": { "accounts": { "main": "accounts.js", "accountTypes": [ ... ] } }`. Leave out `main` (and `main.js`) for a plugin that only offers an account type; leave out `helenite.accounts` for an ordinary plugin.
- The accounts entry is a separate `Plugin` instance with the id `<plugin id>#accounts`. It should only call `registerAccountType` and load or save its data; it adds no views or commands.
- Here, `accounts.js` registers the Letterboxd type, and `main.js` is a small vault feature: the command **Insert latest Letterboxd diary entries** calls `this.app.accounts.call({ account, method: 'diary', args: { limit: 5 } })` and inserts a markdown list at the cursor. Set the account label in the plugin's settings (it must match the label in Settings, Accounts, and the vault must be granted "Read diary" on that account).

## Install

1. Build it: `node plugins/core-build/build.mjs sample-letterboxd-account` (output in `dist/`: `manifest.json`, `main.js`, `accounts.js`).
2. Copy those three files into a folder named after the plugin id inside **Home's** plugins folder, for example `<Home>/.obsidian/plugins/letterboxd-account/`.
3. In Home, open Settings, Community plugins, and enable "Letterboxd account (sample)". The account type is then on in every vault window while it is enabled there. The vault feature can still be turned on or off per vault.
4. In Settings, Accounts, choose **Add account**, then **Letterboxd**, and enter your username.
5. Grant "Read diary" and "Read watchlist" to the vaults that should have them.

## What it demonstrates

- **Declared in the manifest.** `manifest.json` has `helenite.accounts.accountTypes`: the type's hosts, secrets, capabilities (with risk) and which capability each method needs. Main trusts only this, never anything code says at run time.
- **`registerAccountType`.** `src/accounts.ts` registers `connect(el, ctx)` (the form; `ctx.save` stores the account and what it holds) and `methods` (`diary`, `watchlist`).
- **Calling it.** Any plugin in a window can run `await app.accounts.call({ account: 'Letterboxd (me)', method: 'diary' })`. Main checks that the vault was granted `diary.read`, then the method runs with a `ctx.fetch` that only reaches `https://letterboxd.com`.
- **Paths.** Each capability lists the URL paths it may reach (`"paths": ["/*/rss/"]`; `*` matches one segment, matching is by prefix), so `diary.read` and `watchlist.read` are distinguishable. Main rejects a type whose capabilities overlap in method and path.
- **No secrets.** Letterboxd's public RSS and watchlist pages need no credential, so `secrets` is empty. An account type that does need one declares uppercase names in `secrets`, passes values in `ctx.save({ secrets })`, and writes `{{secret:NAME}}` in `ctx.fetch` requests; main fills them in and the plugin never sees the value again.

## What the grant is worth here

Because this sample stores no secret, the grant mainly demonstrates the flow: vault code could fetch Letterboxd's public pages without it. The enforcement matters for account types that do hold a secret: main limits their requests to the declared hosts, methods and paths, fills in the secret itself, and redacts it from responses.

Scraping is best effort: Letterboxd's markup can change.
