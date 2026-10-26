export function dedupeCollectionItems<T>(items: T[], getId: (item: T) => string): T[] {
  const seenIds = new Set<string>();
  const uniqueItems = items.filter(item => {
    const id = getId(item);
    if (seenIds.has(id)) {
      console.warn(`[Duplicate Item] Duplicate item found with id: ${id}`);
      return false;
    }
    seenIds.add(id);
    return true;
  });

  return uniqueItems.length === items.length ? items : uniqueItems;
}
