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

/**
 * Fixed test credentials `misc/server/oauth2.ts` accepts for its Authorization
 * Code / Implicit / Client Credentials / Resource Owner Password grants —
 * mirror any change here into that file.
 */
export const OAUTH2_SERVER = "http://localhost:4080";
export const OAUTH2_CLIENT_ID = "test-client-id";
export const OAUTH2_CLIENT_SECRET = "test-client-secret";

/** gRPC hello server (`misc/server/grpc-hello.ts`, with server reflection). */
export const GRPC_SERVER = "localhost:9000";

/**
 * Servers that answer a connection with the handshake headers (and, for
 * Socket.IO, the handshake auth) they received — `misc/server/handshake-echo.ts`.
 */
export const WS_HANDSHAKE_SERVER = "ws://localhost:4140";
export const SOCKET_IO_HANDSHAKE_SERVER = "ws://localhost:4141";
/** `GET` this for the latest Socket.IO handshake the server received, as `{ headers, auth }`. */
export const SOCKET_IO_LAST_HANDSHAKE = "http://localhost:4141/last-handshake";
