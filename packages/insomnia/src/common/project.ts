const lockGenerator = () => {
  // Simple mutex lock implementation
  let isLocked = false;
  const lockQueue: (() => void)[] = [];

  const lock = async () => {
    if (!isLocked) {
      isLocked = true;
      return;
    }

    // If already locked, wait in queue
    return new Promise<void>(resolve => {
      lockQueue.push(resolve);
    });
  };

  const unlock = async () => {
    if (lockQueue.length > 0) {
      // Process next in queue
      const nextResolve = lockQueue.shift();
      nextResolve?.();
    } else {
      // No one waiting, release lock
      isLocked = false;
    }
  };

  const wrapWithLock = <T extends (...args: any[]) => Promise<any>>(fn: T): T => {
    const wrappedFn = async (...args: Parameters<T>): Promise<ReturnType<T>> => {
      await lock();
      try {
        return await fn(...args);
      } finally {
        await unlock();
      }
    };
    return wrappedFn as T;
  };

  return { wrapWithLock, lock, unlock };
};

// All project write operations should be wrapped with this lock,
// otherwise they may interfere with each other, which may cause duplicate projects or other inconsistencies.
// TODO: move all project operations to this file to ensure they are properly wrapped with locks
export const projectLock = lockGenerator();
