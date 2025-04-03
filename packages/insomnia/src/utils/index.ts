import type { Key } from 'react-stately';

export const scrollElementIntoView = (element: HTMLElement, options?: ScrollIntoViewOptions) => {
  if (element) {
    // @ts-expect-error -- scrollIntoViewIfNeeded is not a standard method
    element.scrollIntoViewIfNeeded ? element.scrollIntoViewIfNeeded() : element.scrollIntoView(options);
  }
};

// modify base on react-spectrum
// https://github.com/adobe/react-spectrum/blob/main/packages/%40react-stately/data/src/useListData.ts#L279
function move<T>(list: T[], indices: number[], toIndex: number): T[] {
  // Shift the target down by the number of items being moved from before the target
  toIndex -= indices.filter(index => index < toIndex).length;

  const moves = indices.map(from => ({
    from,
    to: toIndex++,
  }));

  // Shift later from indices down if they have a larger index
  for (let i = 0; i < moves.length; i++) {
    const a = moves[i].from;
    for (let j = i; j < moves.length; j++) {
      const b = moves[j].from;

      if (b > a) {
        moves[j].from--;
      }
    }
  }

  // Interleave the moves so they can be applied one by one rather than all at once
  for (let i = 0; i < moves.length; i++) {
    const a = moves[i];
    for (let j = moves.length - 1; j > i; j--) {
      const b = moves[j];

      if (b.from < a.to) {
        a.to++;
      } else {
        b.from++;
      }
    }
  }

  const copy = list.slice();
  for (const move of moves) {
    const [item] = copy.splice(move.from, 1);
    copy.splice(move.to, 0, item);
  }

  return copy;
}
export const moveBefore = (list: any[], key: Key, keys: Iterable<Key>) => {
  const toIndex = list.findIndex(item => item.id === key);
  if (toIndex === -1) {
    return list;
  }

  // Find indices of keys to move. Sort them so that the order in the list is retained.
  const keyArray = Array.isArray(keys) ? keys : [...keys];
  const indices = keyArray.map(key => list.findIndex(item => item.id === key)).sort((a, b) => a - b);
  return move(list, indices, toIndex);
};

export const moveAfter = (list: any[], key: Key, keys: Iterable<Key>) => {
  const toIndex = list.findIndex(item => item.id === key);
  if (toIndex === -1) {
    return list;
  }

  const keyArray = Array.isArray(keys) ? keys : [...keys];
  const indices = keyArray.map(key => list.findIndex(item => item.id === key)).sort((a, b) => a - b);
  return move(list, indices, toIndex + 1);
};
