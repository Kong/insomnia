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
export const MOCK_LLM_SERVER = `${MOCK_API_SERVER}/mock-llm`;

export const HTTP_SERVER = "http://localhost:4060";
export const HTTP_SERVER_HTTPS = "https://localhost:4061";
export const HTTP_SERVER_CUSTOM_CA_HTTPS = "https://localhost:4062";
export const HTTP_SERVER_MTLS = "https://localhost:4063";

export const EVENT_STREAM_SERVER = "http://localhost:4050";
export const EVENT_STREAM_SERVER_HTTPS = "https://localhost:4051";

export const WS_SERVER = "ws://localhost:4040";
export const WS_SERVER_WSS = "wss://localhost:4041";

export const SOCKET_SERVER = "ws://localhost:3000";
export const SOCKET_SERVER_WSS = "wss://localhost:3001";
/**
 * The namespace on `misc/socket-server.ts` that only accepts connections
 * whose handshake auth token equals `SOCKET_SERVER_AUTH_TOKEN` — mirror any
 * change here into that file.
 */
export const SOCKET_SERVER_PROTECTED = `${SOCKET_SERVER}/protected`;
export const SOCKET_SERVER_AUTH_TOKEN = "test-socket-io-token";

export const MCP_SERVER = "http://localhost:4020/mcp";
export const MCP_SERVER_HTTPS = "https://localhost:4021/mcp";
export const MCP_SERVER_CUSTOM_CA_HTTPS = "https://localhost:4022/mcp";
/** Base of `misc/mcp-server.ts`'s scriptable list-response endpoints, one per `/mcp-list/<key>`. */
export const MCP_LIST_SERVER = "http://localhost:4020/mcp-list";

export const GRPC_SERVER = "localhost:9000";
export const GRPC_SERVER_TLS = "grpcs://localhost:9001";
export const GRPC_SERVER_MTLS = "grpcs://localhost:9002";

export const GIT_SERVER = "http://localhost:4070";

export const MOCK_BIN_SERVER = "http://localhost:4090";

/**
 * Forward proxy (`misc/resolving-proxy-server.ts`) that maps
 * `RESOLVING_PROXY_HOST` to 127.0.0.1. Point Insomnia's proxy settings at
 * `RESOLVING_PROXY_SERVER` to reach the mock servers without using
 * `localhost` in the URL — mirror any change to the host into that file.
 */
export const RESOLVING_PROXY_SERVER = "http://127.0.0.1:4095";
export const RESOLVING_PROXY_HOST = "insomnia.test";
/**
 * `GET` this on `MOCK_BIN_SERVER` for a fixed response to turn into a mock
 * route — mirror any change here into `misc/mock-bin-server.ts`.
 */
export const MOCK_BIN_SOURCE_RESPONSE = {
  url: `${MOCK_BIN_SERVER}/source`,
  statusCode: 202,
  body: { source: "mock-bin-server" },
  header: { name: "x-mock-source", value: "mock-bin-server" },
};

/**
 * Fixed test credentials `misc/oauth2-server.ts` accepts for its
 * Authorization Code / Implicit / Client Credentials / Resource Owner
 * Password grants — mirror any change here into that file.
 */
export const OAUTH2_SERVER = "http://localhost:4080";
export const OAUTH2_CLIENT_ID = "test-client-id";
export const OAUTH2_CLIENT_SECRET = "test-client-secret";
export const OAUTH2_USERNAME = "testuser";
export const OAUTH2_PASSWORD = "testpass";

export const GIT_SERVER = "http://localhost:4070";
