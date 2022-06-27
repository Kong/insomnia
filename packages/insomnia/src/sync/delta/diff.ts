import crypto from 'crypto';

interface InsertOperation {
  type: 'INSERT';
  content: string;
}

interface CopyOperation {
  type: 'COPY';
  start: number;
  len: number;
}

export type Operation = InsertOperation | CopyOperation;

interface Block {
  start: number;
  len: number;
  hash: string;
}

export function diff(source: string, target: string, blockSize: number): Operation[] {
  const operations: Operation[] = [];
  const sourceBlockMap = getBlockMap(source, blockSize);
  // Iterate over source blocks in order and match them to target
  let lastTargetMatch = 0;

  for (let targetPosition = 0; targetPosition < target.length;) {
    const targetBlock = getBlock(target, targetPosition, blockSize);
    const sourceBlocks = sourceBlockMap[targetBlock.hash] || [];

    if (sourceBlocks.length === 0) {
      targetPosition++;
      continue;
    }

    // TODO: Try all blocks
    const sourceBlock = sourceBlocks[0];
    // Try to match as far as possible
    let sourceIndex = sourceBlock.start + sourceBlock.len;
    let targetIndex = targetBlock.start + targetBlock.len;

    while (targetIndex < target.length && sourceIndex < source.length) {
      if (source[sourceIndex] === target[targetIndex]) {
        targetIndex++;
        sourceIndex++;
      } else {
        break;
      }
    }

    while (
      source[sourceIndex++] === target[targetIndex] &&
      targetIndex < target.length &&
      sourceIndex < source.length
    ) {
      targetIndex++;
    }

    sourceIndex--;

    // Found unknown bytes, INSERT them
    if (targetBlock.start > lastTargetMatch) {
      operations.push({
        type: 'INSERT',
        content: target.slice(lastTargetMatch, targetBlock.start),
      });
    }

    // Source block found in target
    operations.push({
      type: 'COPY',
      start: sourceBlock.start,
      len: sourceIndex - sourceBlock.start,
    });
    targetPosition = lastTargetMatch = targetIndex;
  }

  // Add the target suffix if there's still some left
  if (lastTargetMatch < target.length) {
    operations.push({
      type: 'INSERT',
      content: target.slice(lastTargetMatch),
    });
  }

  return operations;
}

function getBlock(value: string, start: number, blockSize: number): Block {
  if (start >= value.length) {
    throw new Error('Invalid block index');
  }

  const blockSlice = value.slice(start, start + blockSize);
  return {
    start,
    len: blockSlice.length,
    hash: crypto.createHash('sha1').update(blockSlice).digest('hex'),
  };
}

function getBlockMap(value: string, blockSize: number): Record<string, Block[]> {
  const map: Record<string, Block[]> = {};

  for (let i = 0; i < value.length;) {
    const block = getBlock(value, i, blockSize);

    if (map[block.hash]) {
      map[block.hash].push(block);
    } else {
      map[block.hash] = [block];
    }

    i += block.len;
  }

  return map;
}

export const __internal = {
  getBlockMap,
};
