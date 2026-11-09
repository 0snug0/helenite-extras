Plugin-native forms of the hook and MCP configuration, using `${HELENITE_HOOK_URL}`-style environment
variables. They are not loaded by default: the proven path passes hooks with `--settings` and the MCP server
with `--mcp-config`, and loading both would register every hook twice.

To switch (bridge config `hookMode: 'plugin'`): copy `hooks.plugin.json` to `hooks/hooks.json` and
`mcp.plugin.json` to `.mcp.json`. Not yet exercised against a live `claude`.
