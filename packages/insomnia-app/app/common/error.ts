import { unreachable } from 'ts-assert-unreachable';

/**
 * Looks for message contained in the first line of an Error's stack.
 */
export const ERROR_STACK_MESSAGE_REGEX = /(?<=(^\S*Error: )).*(?=\n)/;

/**
 * @param message the new message
 * @param stack the original stack trace
 * @returns a new stack trace with the message replaced
 */
export const rewriteStackMessage = (message: string, stack: string) => {
  return stack.replace(ERROR_STACK_MESSAGE_REGEX, message);
};

/**
 * Rethrows an error with a new message but preserves the stack trace (with the new error message).
 */
export const rethrow = async <T>(message: string, callback: () => T | Promise<T>) => {
  try {
    return await callback();
  } catch (thrownError: unknown) {
    const newError = new Error(message);

    if (thrownError instanceof Error) {
      if (thrownError.stack) {
        newError.stack = rewriteStackMessage(message, thrownError.stack);
      }
      throw newError;
    }

    if (typeof thrownError === 'string') {
      throw newError;
    }

    return unreachable(`something was thrown that was not an error: ${thrownError}`);
  }
};
