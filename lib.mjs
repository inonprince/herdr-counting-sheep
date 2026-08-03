export const TOKEN_NAME = "sheep_index";

export function indexEntries(items, idField) {
  return items.flatMap((item, index) => {
    const id = item?.[idField];
    return typeof id === "string" && id.length > 0
      ? [{ id, index: String(index + 1), item }]
      : [];
  });
}

export function lastIdentifier(items, idField) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const id = items[index]?.[idField];
    if (typeof id === "string" && id.length > 0) {
      return id;
    }
  }

  return undefined;
}

export function tokenValue(item, tokenName = TOKEN_NAME) {
  const value = item?.tokens?.[tokenName];
  return typeof value === "string" ? value : undefined;
}
