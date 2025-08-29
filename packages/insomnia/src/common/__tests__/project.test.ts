import { describe, expect, it } from 'vitest';

import { projectLock } from '../project';

describe('projectLock', () => {
  // Helper function to create a delay
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  describe('lock and unlock', () => {
    it('should queue operations when lock is already held', async () => {
      const executionOrder: string[] = [];

      // First operation acquires lock
      const operation1 = async () => {
        await projectLock.lock();
        executionOrder.push('start-1');
        await delay(50); // Hold lock for 50ms
        await projectLock.unlock();
        executionOrder.push('end-1');
      };

      // Second operation should wait
      const operation2 = async () => {
        await projectLock.lock();
        executionOrder.push('start-2');
        await delay(30); // Hold lock for 30ms
        await projectLock.unlock();
        executionOrder.push('end-2');
      };

      // Third operation should wait even longer
      const operation3 = async () => {
        await projectLock.lock();
        executionOrder.push('start-3');
        await projectLock.unlock();
        executionOrder.push('end-3');
      };

      // Start all operations simultaneously
      await Promise.all([operation1(), operation2(), operation3()]);

      // Operations should execute in order: 1, 11, 2, 22, 3, 33
      expect(executionOrder).toEqual(['start-1', 'end-1', 'start-2', 'end-2', 'start-3', 'end-3']);
    });

    it('should handle rapid lock/unlock cycles', async () => {
      const results: number[] = [];

      for (let i = 0; i < 10; i++) {
        await projectLock.lock();
        results.push(i);
        await projectLock.unlock();
      }

      expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });
  });

  describe('wrapWithLock', () => {
    it('should serialize execution of wrapped functions', async () => {
      const executionOrder: string[] = [];

      const slowFunction = projectLock.wrapWithLock(async (id: string) => {
        executionOrder.push(`start-${id}`);
        await delay(20);
        executionOrder.push(`end-${id}`);
        return id;
      });

      const fastFunction = projectLock.wrapWithLock(async (id: string) => {
        executionOrder.push(`start-${id}`);
        executionOrder.push(`end-${id}`);
        return id;
      });

      // Start multiple operations
      const promises = [slowFunction('A'), fastFunction('B'), slowFunction('C')];

      const results = await Promise.all(promises);

      // All should complete with correct results
      expect(results).toEqual(['A', 'B', 'C']);

      // Execution should be serialized - each function should complete
      // before the next one starts
      expect(executionOrder).toEqual(['start-A', 'end-A', 'start-B', 'end-B', 'start-C', 'end-C']);
    });

    it('should handle errors correctly and still unlock', async () => {
      const errorFunction = projectLock.wrapWithLock(async (shouldThrow: boolean): Promise<string> => {
        if (shouldThrow) {
          throw new Error('Test error');
        }
        return 'success';
      });

      // Test that error is thrown
      await expect(errorFunction(true)).rejects.toThrow('Test error');

      // Test that lock is released after error by running another operation
      const result = await errorFunction(false);
      expect(result).toBe('success');
    });
  });
});
