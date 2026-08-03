# Counting Sheep

Counting Sheep is a Herdr plugin that:

- publishes live, one-based Space and Agent positions as the
  `$sheep_index` sidebar metadata token;
- refreshes those positions when Herdr's workspace, tab, pane, or agent state
  changes; and
- provides actions that focus the last tab, Space, or Agent.

It supports macOS and Linux and requires Herdr 0.7.5 or newer and Node.js 18
or newer. The launcher also discovers Node installations managed by NVM,
Mise, asdf, or Volta when the Herdr server has a minimal `PATH`.

## Install

Install the plugin from GitHub:

```sh
herdr plugin install inonprince/herdr-counting-sheep
```

After adding the sidebar configuration below, populate the initial indexes:

```sh
herdr plugin action invoke refresh --plugin inon.counting-sheep
```

The startup hook repopulates indexes automatically after future Herdr server
restarts.

## Link for local development

```sh
herdr plugin link ~/repos/herdr-counting-sheep
herdr plugin action invoke refresh --plugin inon.counting-sheep
```

## Sidebar configuration

Add the token wherever you want the index to appear:

```toml
[ui.sidebar.spaces]
rows = [
  ["state_icon", "$sheep_index", "workspace"],
  ["branch", "git_status"],
]

[ui.sidebar.agents]
rows = [
  ["state_icon", "$sheep_index", "workspace", "tab"],
  ["agent"],
]
```

Agent-specific `rows_by_agent` entries replace the default rows, so include
`$sheep_index` in every override that should display a number.

## Last-item keybindings

```toml
[[keys.command]]
key = "prefix+0"
type = "plugin_action"
command = "inon.counting-sheep.last-tab"
description = "focus last tab"

[[keys.command]]
key = "prefix+)"
type = "plugin_action"
command = "inon.counting-sheep.last-workspace"
description = "focus last Space"

[[keys.command]]
key = "prefix+alt+0"
type = "plugin_action"
command = "inon.counting-sheep.last-agent"
description = "focus last Agent"
```

Use `prefix+)` for the Space shortcut because terminals report
<kbd>Shift</kbd>+<kbd>0</kbd> as the `)` character in prefix mode.

Run `herdr server reload-config` after changing `config.toml`.

## Ordering

Spaces and tabs follow the order returned by Herdr's corresponding list APIs.
Agent numbering follows `herdr agent list`, matching Herdr's standard
Space-based Agent ordering. A custom Agent View can project a different visible
order because Herdr deliberately does not apply Agent Views to `agent.list`.

## Development

```sh
npm test
sh -n run.sh
node --check index.mjs
herdr plugin log list --plugin inon.counting-sheep
```

## License

[MIT](LICENSE)
