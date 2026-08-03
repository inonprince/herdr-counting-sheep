import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import {
  TOKEN_NAME,
  indexEntries,
  lastIdentifier,
  tokenValue,
} from "./lib.mjs";

const SOURCE = "plugin:inon.counting-sheep";
const herdr = process.env.HERDR_BIN_PATH || "herdr";
const stateDirectory =
  process.env.HERDR_PLUGIN_STATE_DIR ||
  join(tmpdir(), "herdr-counting-sheep");
const lockPath = join(stateDirectory, "refresh.lock");
const pendingPath = join(stateDirectory, "refresh.pending");
const staleLockMilliseconds = 30_000;

function callHerdr(args) {
  const command = spawnSync(herdr, args, {
    encoding: "utf8",
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (command.error) {
    throw command.error;
  }

  if (command.status !== 0) {
    const detail = command.stderr.trim() || command.stdout.trim();
    throw new Error(
      `${herdr} ${args.join(" ")} failed with status ${command.status}${
        detail ? `: ${detail}` : ""
      }`,
    );
  }

  const output = command.stdout.trim();
  if (!output) {
    return {};
  }

  let response;
  try {
    response = JSON.parse(output);
  } catch {
    throw new Error(
      `${herdr} ${args.join(" ")} returned invalid JSON: ${output}`,
    );
  }

  if (response.error) {
    throw new Error(
      response.error.message ||
        `${herdr} ${args.join(" ")} returned an API error`,
    );
  }

  return response.result || {};
}

function setWorkspaceIndex(workspaceId, value) {
  callHerdr([
    "workspace",
    "report-metadata",
    workspaceId,
    "--source",
    SOURCE,
    "--token",
    `${TOKEN_NAME}=${value}`,
  ]);
}

function setPaneIndex(paneId, value) {
  callHerdr([
    "pane",
    "report-metadata",
    paneId,
    "--source",
    SOURCE,
    "--token",
    `${TOKEN_NAME}=${value}`,
  ]);
}

function clearPaneIndex(paneId) {
  callHerdr([
    "pane",
    "report-metadata",
    paneId,
    "--source",
    SOURCE,
    "--clear-token",
    TOKEN_NAME,
  ]);
}

function refreshIndexes() {
  const workspaces = callHerdr(["workspace", "list"]).workspaces || [];
  const agents = callHerdr(["agent", "list"]).agents || [];
  const panes = callHerdr(["pane", "list"]).panes || [];

  let workspaceUpdates = 0;
  let agentUpdates = 0;
  let staleAgentIndexesCleared = 0;

  for (const entry of indexEntries(workspaces, "workspace_id")) {
    if (tokenValue(entry.item) !== entry.index) {
      setWorkspaceIndex(entry.id, entry.index);
      workspaceUpdates += 1;
    }
  }

  const agentPaneIds = new Set();
  for (const entry of indexEntries(agents, "pane_id")) {
    agentPaneIds.add(entry.id);
    if (tokenValue(entry.item) !== entry.index) {
      setPaneIndex(entry.id, entry.index);
      agentUpdates += 1;
    }
  }

  for (const pane of panes) {
    if (
      typeof pane?.pane_id === "string" &&
      !agentPaneIds.has(pane.pane_id) &&
      tokenValue(pane) !== undefined
    ) {
      clearPaneIndex(pane.pane_id);
      staleAgentIndexesCleared += 1;
    }
  }

  process.stdout.write(
    JSON.stringify({
      workspaces: workspaces.length,
      agents: agents.length,
      workspace_updates: workspaceUpdates,
      agent_updates: agentUpdates,
      stale_agent_indexes_cleared: staleAgentIndexesCleared,
    }) + "\n",
  );
}

function removeIfPresent(path) {
  try {
    unlinkSync(path);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
}

function acquireRefreshLock() {
  mkdirSync(stateDirectory, { recursive: true });

  try {
    const descriptor = openSync(lockPath, "wx");
    writeFileSync(descriptor, `${process.pid}\n`);
    return descriptor;
  } catch (error) {
    if (error?.code !== "EEXIST") {
      throw error;
    }
  }

  try {
    if (Date.now() - statSync(lockPath).mtimeMs > staleLockMilliseconds) {
      removeIfPresent(lockPath);
      const descriptor = openSync(lockPath, "wx");
      writeFileSync(descriptor, `${process.pid}\n`);
      return descriptor;
    }
  } catch (error) {
    if (error?.code !== "ENOENT" && error?.code !== "EEXIST") {
      throw error;
    }
  }

  writeFileSync(pendingPath, `${Date.now()}\n`);
  return undefined;
}

function refreshIndexesCoalesced() {
  const descriptor = acquireRefreshLock();
  if (descriptor === undefined) {
    return;
  }

  let completed = false;
  try {
    do {
      removeIfPresent(pendingPath);
      refreshIndexes();
    } while (existsSync(pendingPath));
    completed = true;
  } finally {
    closeSync(descriptor);
    removeIfPresent(lockPath);
  }

  // Close the small race where another event marks a refresh pending just
  // before the lock is released. Events arriving later acquire the lock.
  if (completed && existsSync(pendingPath)) {
    refreshIndexesCoalesced();
  }
}

function focusLast(collection, idField, focusArgs) {
  const id = lastIdentifier(collection, idField);
  if (!id) {
    process.stdout.write(
      JSON.stringify({ focused: false, reason: "no_items" }) + "\n",
    );
    return;
  }

  callHerdr([...focusArgs, id]);
  process.stdout.write(JSON.stringify({ focused: true, id }) + "\n");
}

function focusLastTab() {
  const workspaceId =
    process.env.HERDR_WORKSPACE_ID ||
    process.env.HERDR_ACTIVE_WORKSPACE_ID;

  if (!workspaceId) {
    throw new Error("No active Herdr workspace was provided to the action");
  }

  const tabs =
    callHerdr(["tab", "list", "--workspace", workspaceId]).tabs || [];
  focusLast(tabs, "tab_id", ["tab", "focus"]);
}

function focusLastWorkspace() {
  const workspaces = callHerdr(["workspace", "list"]).workspaces || [];
  focusLast(workspaces, "workspace_id", ["workspace", "focus"]);
}

function focusLastAgent() {
  const agents = callHerdr(["agent", "list"]).agents || [];
  focusLast(agents, "pane_id", ["agent", "focus"]);
}

function main() {
  switch (process.argv[2]) {
    case "refresh":
      refreshIndexesCoalesced();
      break;
    case "last-tab":
      focusLastTab();
      break;
    case "last-workspace":
      focusLastWorkspace();
      break;
    case "last-agent":
      focusLastAgent();
      break;
    default:
      process.stderr.write(
        "Usage: node index.mjs <refresh|last-tab|last-workspace|last-agent>\n",
      );
      process.exitCode = 2;
  }
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error?.stack || error}\n`);
  process.exitCode = 1;
}
