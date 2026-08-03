#!/bin/sh

set -e

plugin_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

if command -v node >/dev/null 2>&1; then
  node_path=$(command -v node)
  exec "$node_path" "$plugin_root/index.mjs" "$@"
fi

nvm_directory=${NVM_DIR:-"${HOME}/.nvm"}
if [ -s "$nvm_directory/nvm.sh" ]; then
  export NVM_DIR="$nvm_directory"
  # NVM is commonly initialized only by an interactive shell, while Herdr's
  # server has a smaller PATH.
  # shellcheck disable=SC1090
  . "$NVM_DIR/nvm.sh"
  nvm use --silent default >/dev/null 2>&1 || true
  if command -v node >/dev/null 2>&1; then
    node_path=$(command -v node)
    exec "$node_path" "$plugin_root/index.mjs" "$@"
  fi
fi

for candidate in \
  "${HOME}"/.local/share/mise/shims/node \
  "${HOME}"/.asdf/shims/node \
  "${HOME}"/.volta/bin/node \
  "${HOME}"/.nvm/versions/node/*/bin/node
do
  if [ -x "$candidate" ]; then
    node_path=$candidate
  fi
done

if [ -n "${node_path:-}" ]; then
  exec "$node_path" "$plugin_root/index.mjs" "$@"
fi

echo "Counting Sheep requires Node.js 18 or newer, but node was not found." >&2
exit 127
