import type { Page } from "playwright-core";

/**
 * Method decorator for Page classes: runs the method, then waits up to
 * `timeout` for an error dialog to appear and throws using its text.
 * Opt-in per method, so only methods that expect a possible error pay
 * for the wait — unlike a prototype-wide wrapper, the rest of a class's
 * methods are unaffected.
 */
export function throwOnDialog<
  This extends object,
  Args extends unknown[],
  Return,
>(timeout = 1000) {
  return function (
    target: (this: This, ...args: Args) => Promise<Return>,
    _context: ClassMethodDecoratorContext<
      This,
      (this: This, ...args: Args) => Promise<Return>
    >,
  ) {
    return async function (this: This, ...args: Args): Promise<Return> {
      const result = await target.call(this, ...args);
      const dialog = (this as unknown as { page: Page }).page
        .getByRole("dialog")
        .first();
      const appeared = await dialog
        .waitFor({ state: "visible", timeout })
        .then(() => true)
        .catch(() => false);
      if (appeared) throw new Error((await dialog.innerText()).trim());
      return result;
    };
  };
}
