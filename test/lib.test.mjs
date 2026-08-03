import test from "node:test";
import assert from "node:assert/strict";

import {
  TOKEN_NAME,
  indexEntries,
  lastIdentifier,
  tokenValue,
} from "../lib.mjs";

test("indexEntries numbers items by visible array position", () => {
  const items = [
    { tab_id: "w1:t1", number: 10 },
    { tab_id: "w1:t9", number: 3 },
  ];

  assert.deepEqual(
    indexEntries(items, "tab_id").map(({ id, index }) => ({ id, index })),
    [
      { id: "w1:t1", index: "1" },
      { id: "w1:t9", index: "2" },
    ],
  );
});

test("indexEntries skips records without a usable identifier", () => {
  assert.deepEqual(indexEntries([{ pane_id: "" }, {}], "pane_id"), []);
});

test("lastIdentifier follows visible array order rather than stable numbers", () => {
  const tabs = [
    { tab_id: "w1:t9", number: 9 },
    { tab_id: "w1:t2", number: 2 },
  ];

  assert.equal(lastIdentifier(tabs, "tab_id"), "w1:t2");
  assert.equal(lastIdentifier([], "tab_id"), undefined);
});

test("tokenValue reads only string metadata values", () => {
  assert.equal(
    tokenValue({ tokens: { [TOKEN_NAME]: "4" } }),
    "4",
  );
  assert.equal(tokenValue({ tokens: { [TOKEN_NAME]: 4 } }), undefined);
  assert.equal(tokenValue({}), undefined);
});
