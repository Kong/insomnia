import { insert, tail, update } from 'ramda';

import { ERROR_STACK_MESSAGE_REGEX, rethrow, rewriteStackMessage } from '../common/error';

const originalMessage = 'original message';
const newMessage = 'new message';
const originalStackLines = [
  `Error: ${originalMessage}`,
  '    at callback (./app/__tests__/error.test.ts:38:31)',
  '    at Object.<anonymous> (./app/__tests__/error.test.ts:42:37)',
  '    at Object.t.length.arguments.<computed> (/home/dimitri/.vscode/extensions/wallabyjs.wallaby-vscode-1.0.308/wallabyb46540/runners/node/jest@24.8.0/jasmineInitializer.js:14:1839)',
  '    at Object.asyncJestTest (./node_modules/jest-jasmine2/build/jasmineAsyncInstall.js:106:37)',
  '    at ./node_modules/jest-jasmine2/build/queueRunner.js:45:12',
  '    at new Promise (<anonymous>)',
  '    at mapper (./node_modules/jest-jasmine2/build/queueRunner.js:28:19)',
  '    at ./node_modules/jest-jasmine2/build/queueRunner.js:75:41',
];
const originalStack = originalStackLines.join('\n');
const newStack = update(0, `Error: ${newMessage}`, originalStackLines).join('\n');

describe('ERROR_FIRST_LINE_REGEX', () => {
  it('finds the message', () => {
    const match = originalStack.match(ERROR_STACK_MESSAGE_REGEX)?.[0];
    expect(match).toStrictEqual(originalMessage);
  });

  it('only finds the message at the beginning (and, replaces once)', () => {
    const stack = insert(1, 'Error: fake error', originalStackLines).join('\n');
    const match = stack.match(ERROR_STACK_MESSAGE_REGEX)?.[0];
    expect(match).toStrictEqual(originalMessage);
  });

  it('tolerates other kids of errors', () => {
    const message = 'Flow failed you when you least expected it';
    const stack = insert(0, `TypeError: ${message}`, originalStackLines).join('\n');
    const match = stack.match(ERROR_STACK_MESSAGE_REGEX)?.[0];
    expect(match).toStrictEqual(message);
  });
});

describe('rewriteStackMessage', () => {
  it('rewrites the stack message', () => {
    const rewritten = rewriteStackMessage(newMessage, originalStack);
    const expected = update(0, `Error: ${newMessage}`, originalStackLines).join('\n');
    expect(rewritten).toEqual(expected);
  });

  it('does nothing if the stack format is not recognized', () => {
    const missingCriticalCharacter = tail(originalStack);
    const rewritten = rewriteStackMessage(newMessage, missingCriticalCharacter);
    expect(rewritten).toEqual(missingCriticalCharacter);
  });
});

describe('rethrow', () => {
  describe('sync', () => {
    it('does nothing for callbacks that don\'t error', async () => {
      const callback = () => true;
      const result = rethrow('unreachable', callback);
      await expect(result).resolves.toStrictEqual(true);
    });

    it('rewrites the error message', async () => {
      const callback = () => {
        throw new Error(originalMessage);
      };
      const result = rethrow(newMessage, callback);
      await expect(result).rejects.toThrow(newMessage);
    });

    it('rewrites the stack trace', async () => {
      const callback = () => {
        const error = new Error(originalMessage);
        error.stack = originalStack;
        throw error;
      };

      try {
        await rethrow(newMessage, callback);
        fail();
      } catch (error: unknown) {
        if (!(error instanceof Error)) {
          fail();
        }
        expect(error.stack).toEqual(newStack);
      }
    });

    it('handles a non-error being thrown', async () => {
      const callback = () => {
        throw originalMessage;
      };
      const result = rethrow(newMessage, callback);
      await expect(result).rejects.toThrow(newMessage);
    });

    it('handles a non-error being thrown', async () => {
      const callback = () => { throw 1; };
      const result = rethrow(newMessage, callback);
      await expect(result).rejects.toThrow('Invariant failed: something was thrown that was not an error: 1');
    });
  });

  describe('async', () => {
    it("does nothing for callbacks that don't error", async () => {
      const callback = async () => true;
      const result = rethrow('unreachable', callback);
      await expect(result).resolves.toStrictEqual(true);
    });

    it('rewrites the error message', async () => {
      const callback = async () => {
        throw new Error(originalMessage);
      };
      const result = rethrow(newMessage, callback);
      await expect(result).rejects.toThrow(newMessage);
    });

    it('rewrites the error stack', async () => {
      const callback = async () => {
        const error = new Error(originalMessage);
        error.stack = originalStack;
        throw error;
      };

      try {
        await rethrow(newMessage, callback);
        fail();
      } catch (error: unknown) {
        if (!(error instanceof Error)) {
          fail();
        }
        expect(error.stack).toEqual(newStack);
      }
    });

    it('handles a non-error (string) being thrown', async () => {
      const callback = async () => {
        throw originalMessage;
      };
      const result = rethrow(newMessage, callback);
      await expect(result).rejects.toThrow(newMessage);
    });

    it('handles a non-error (number) being thrown', async () => {
      const callback = async () => {
        throw 1;
      };
      const result = rethrow(newMessage, callback);
      await expect(result).rejects.toThrow('Invariant failed: something was thrown that was not an error: 1');
    });
  });
});
