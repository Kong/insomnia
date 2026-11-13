export const SHORT_TIMEOUT = 2000;

export const DEFAULT_TIMEOUT = 10_000;

export const LONG_TIMEOUT = 60_000;

/** Interval between polls of a locator or in-memory read. */
export const POLL_INTERVAL = 200;

// Matches playwright.config.ts's `use.actionTimeout`.
export const ACTION_TIMEOUT = 30_000;

/**
 * Base URLs for every local mock server started by `playwright.config.ts`'s
 * `webServer` array. One constant per server/scheme pair — import the exact
 * ones a spec needs instead of hardcoding `localhost:<port>` inline, so a
 * port change only has to happen here.
 */
export const MOCK_API_SERVER = "http://localhost:4010";

// The single mock server (misc/server/index.ts) serves HTTP on one port.
export const HTTP_SERVER = MOCK_API_SERVER;

