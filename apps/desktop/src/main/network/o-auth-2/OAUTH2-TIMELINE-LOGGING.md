# OAuth2 Timeline Logging

## Background (INS-1284)

Previously, when an OAuth2 authentication request failed, users had no way to see the request/response details in Insomnia's Console (Timeline) tab. The OAuth2 token exchange happened internally and its logs were only partially visible via a small "Response Timeline" debug button in the Auth panel — which was easy to miss and only showed the raw curl timeline in a modal.

Postman shows OAuth2 request logs directly in its Console, making it easy to debug auth failures. This change brings the same capability to Insomnia.

## Solution

Thread OAuth2 timeline entries from `getOAuth2Token` → `getAuthHeader` → `sendCurlAndWriteTimeline`, so they appear in the main request's **Console** tab alongside the actual API request timeline.

### Data Flow

```
sendCurlAndWriteTimeline()
  │
  ├── getAuthHeader(renderedRequest, url)
  │     │
  │     └── getOAuth2Token(requestId, auth)
  │           │
  │           ├── Collects high-level log entries (milestones, errors)
  │           ├── Calls sendAccessTokenRequest() internally
  │           │     └── Writes its own curl timeline to disk
  │           ├── Reads that curl timeline via getResponseTimeline()
  │           └── Returns { token, timeline[] }
  │
  │     Returns { header?, timeline? }
  │
  ├── Pushes auth timeline entries into the main request timeline[]
  ├── Sends the actual API request via curl
  └── Writes combined timeline to disk
```

### What Gets Logged

The following entries appear in the Console tab (prefixed with `[oauth2]`):

**Flow milestones:**
- `Starting OAuth2 flow (grantType=..., forceRefresh=...)`
- `Using existing access token` (when a cached valid token is reused)
- `Opening authorization window: <origin>` / `Opening default browser for authorization: <origin>`
- `Authorization redirect detected, exchanging code for token`
- `Sending token request to <accessTokenUrl>`
- `Token received successfully`
- `Received implicit token successfully`

**Token refresh:**
- `Refreshing token via <accessTokenUrl>`
- `Token refreshed successfully`
- `Refresh token rejected (401 Unauthorized)`
- `Refresh token rejected: invalid_grant - <description>`
- `Failed to refresh token: status=<code>`

**Errors:**
- `Authorization window error: Authorization window closed` (user closed the window)
- `Authorization error: <error> - <description>` (OAuth provider returned an error)
- `Default browser authorization error: <message>`
- `Token request failed: <error>`
- `OAuth2 flow error: <message>`

**Embedded curl timeline:**
The full curl debug output from the token endpoint request (connection, TLS handshake, request/response headers, response body) is included inline — this is the same data that was previously only accessible via the debug modal.

## Files Changed

| File | Change |
|------|--------|
| `get-token.ts` | `getOAuth2Token` returns `OAuth2TokenResult { token, timeline }`. Collects `ResponseTimelineEntry[]` throughout the flow. Reads the internal response's timeline via `getResponseTimeline()`. Errors attach timeline via `Object.assign(err, { timeline })`. |
| `get-token.ts` | `getExistingAccessTokenAndRefreshIfExpired` returns optional `refreshTimeline` when a refresh is attempted. |
| `get-token.ts` | Added `!token.accessToken` guard — tokens with empty access tokens are no longer treated as valid. |
| `../get-auth-header.ts` | Return type changed from `RequestHeader \| undefined` to `AuthHeaderResult { header?, timeline? }`. OAuth2 branch passes through timeline from `getOAuth2Token`. All other auth types wrap their header in `{ header }`. |
| `../../network/network.ts` | `sendCurlAndWriteTimeline` destructures `{ header, timeline }` from `getAuthHeader` and pushes auth timeline entries into the main timeline before the API request is sent. |
| `../../runtimes/types.ts` | `NetworkRuntime.getAuthHeader` return type updated. |
| `../../runtimes/network/network-adapter.node.ts` | Adapted to new return type. |
| `../../runtimes/network/network-adapter.renderer.ts` | Adapted to new return type. |
| `../../main/ipc/main.ts` | IPC interface updated for `getAuthHeader`. `getOAuth2Token` IPC handler extracts `.token` for backward-compatible UI usage. |
| `../../entry.preload.ts` | Preload bridge type updated. |
| `../../main/har.ts` | HAR export updated to destructure `{ header }`. |
| `../.../connect.tsx` | EventStream connection updated to destructure `{ header: authHeader }`. |
