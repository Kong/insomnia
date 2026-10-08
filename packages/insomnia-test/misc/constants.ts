export const DEFAULT_TIMEOUT = 10_000;

export const LONG_TIMEOUT = 60_000;

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

export const MCP_SERVER = "http://localhost:4020/mcp";
export const MCP_SERVER_HTTPS = "https://localhost:4021/mcp";

export const GRPC_SERVER = "localhost:9000";
export const GRPC_SERVER_TLS = "grpcs://localhost:9001";
export const GRPC_SERVER_MTLS = "grpcs://localhost:9002";

export const GIT_SERVER = "http://localhost:4070";

/**
 * Fixed test credentials `misc/oauth2-server.js` accepts for its
 * Authorization Code / Implicit / Client Credentials / Resource Owner
 * Password grants — mirror any change here into that file.
 */
export const OAUTH2_SERVER = "http://localhost:4080";
export const OAUTH2_CLIENT_ID = "test-client-id";
export const OAUTH2_CLIENT_SECRET = "test-client-secret";
export const OAUTH2_USERNAME = "testuser";
export const OAUTH2_PASSWORD = "testpass";
