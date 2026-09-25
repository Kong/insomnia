const crypto = require("node:crypto");
const express = require("express");

const PORT = process.env.OAUTH2_PORT || 4080;

// Fixed test credentials, the same "no interactive login step" convention
// as misc/git-server.js's testuser/testpass — mirrored as exported
// constants in misc/fixtures.ts, which is the source specs import from.
const CLIENT_ID = "test-client-id";
const CLIENT_SECRET = "test-client-secret";
const USERNAME = "testuser";
const PASSWORD = "testpass";

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// In-memory stores. A fresh mock server process (started per Playwright
// run, same as every other misc/*.js server) means these are naturally
// reset between full test runs, but persist across tests within one run —
// specs should treat issued codes/tokens as single-use where the real
// OAuth2 spec would (e.g. an authorization code is deleted once exchanged).
const authCodes = new Map(); // code -> { clientId, redirectUri, codeChallenge, codeChallengeMethod, scope }
const accessTokens = new Map(); // token -> { clientId, scope }
const refreshTokens = new Map(); // token -> { clientId, scope }

// Every /token exchange, keyed by the access_token it issued, for GET
// /_debug/last-token-request?access_token=... to hand back to specs — lets
// a test assert on what the server actually received for its own exchange
// (grant_type, whether PKCE was verified, ...) rather than only on what the
// Auth tab's UI shows afterward. Keyed by access_token (already unique per
// exchange, and already in hand on the spec side via fetchOAuth2Tokens())
// rather than a single "most recent" slot, so concurrent tests running
// under workers > 1 don't stomp on each other's entries.
const tokenRequestLog = new Map();

function base64url(buf) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function randomToken(prefix) {
  return `${prefix}_${base64url(crypto.randomBytes(24))}`;
}

// A minimal unsigned JWT ("alg": "none") — Insomnia's Auth tab only ever
// displays/stores this string, it never verifies the signature, so a real
// signing key would add complexity with no test value.
function fakeIdToken(sub, aud) {
  const header = base64url(
    Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })),
  );
  const payload = base64url(
    Buffer.from(JSON.stringify({ sub, aud, iat: 0, exp: 9_999_999_999 })),
  );
  return `${header}.${payload}.`;
}

// The OAuth2 spec allows client authentication either via a Basic auth
// header or via client_id/client_secret in the body — Insomnia's
// "Credentials" dropdown ("As Basic Auth Header" / "In Request Body")
// toggles between the two, so the mock must accept both.
function verifyClient(req) {
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Basic ")) {
    const decoded = Buffer.from(authHeader.slice(6), "base64").toString();
    const separatorIndex = decoded.indexOf(":");
    const id = decoded.slice(0, separatorIndex);
    const secret = decoded.slice(separatorIndex + 1);
    return id === CLIENT_ID && secret === CLIENT_SECRET;
  }
  const { client_id, client_secret } = req.body;
  return (
    client_id === CLIENT_ID &&
    (client_secret === undefined || client_secret === CLIENT_SECRET)
  );
}

// Authorization endpoint, used by the Authorization Code and Implicit
// grant flows. This mock has no login/consent screen — it auto-approves
// any request for the known CLIENT_ID and redirects straight back, since
// driving a real login form inside Insomnia's embedded authorization
// window is out of scope for what these tests need to verify.
app.get("/authorize", (req, res) => {
  const {
    response_type,
    client_id,
    redirect_uri,
    scope,
    state,
    code_challenge,
    code_challenge_method,
  } = req.query;

  if (client_id !== CLIENT_ID) {
    return res.status(400).send("invalid client_id");
  }
  if (!redirect_uri) {
    return res.status(400).send("missing redirect_uri");
  }

  const responseTypes = String(response_type || "code").split(" ");

  if (responseTypes.includes("code")) {
    const code = randomToken("code");
    authCodes.set(code, {
      clientId: client_id,
      redirectUri: redirect_uri,
      codeChallenge: code_challenge,
      codeChallengeMethod: code_challenge_method,
      scope,
    });
    const url = new URL(redirect_uri);
    url.searchParams.set("code", code);
    if (state) url.searchParams.set("state", state);
    return res.redirect(url.toString());
  }

  // Implicit grant: the token(s) are issued directly and returned in the
  // redirect URI's fragment (RFC 6749 §4.2.2), never its query string.
  const fragment = new URLSearchParams();
  if (responseTypes.includes("token")) {
    const accessToken = randomToken("access");
    accessTokens.set(accessToken, { clientId: client_id, scope });
    fragment.set("access_token", accessToken);
    fragment.set("token_type", "Bearer");
    fragment.set("expires_in", "3600");
  }
  if (responseTypes.includes("id_token")) {
    fragment.set("id_token", fakeIdToken(USERNAME, client_id));
  }
  if (scope) fragment.set("scope", scope);
  if (state) fragment.set("state", state);

  const url = new URL(redirect_uri);
  return res.redirect(`${url.origin}${url.pathname}#${fragment.toString()}`);
});

// Token endpoint, used by every grant type to obtain (or refresh) an
// access token.
app.post("/token", (req, res) => {
  const { grant_type } = req.body;

  if (grant_type === "authorization_code") {
    const { code, redirect_uri, code_verifier } = req.body;
    const entry = authCodes.get(code);
    if (!entry || entry.redirectUri !== redirect_uri) {
      return res.status(400).json({ error: "invalid_grant" });
    }
    if (!verifyClient(req)) {
      return res.status(401).json({ error: "invalid_client" });
    }
    if (entry.codeChallenge) {
      const computed =
        entry.codeChallengeMethod === "plain"
          ? code_verifier
          : base64url(
              crypto
                .createHash("sha256")
                .update(code_verifier || "")
                .digest(),
            );
      if (computed !== entry.codeChallenge) {
        return res.status(400).json({
          error: "invalid_grant",
          error_description: "PKCE verification failed",
        });
      }
    }
    authCodes.delete(code);
    const accessToken = randomToken("access");
    const refreshToken = randomToken("refresh");
    accessTokens.set(accessToken, {
      clientId: entry.clientId,
      scope: entry.scope,
    });
    refreshTokens.set(refreshToken, {
      clientId: entry.clientId,
      scope: entry.scope,
    });
    tokenRequestLog.set(accessToken, {
      grantType: grant_type,
      clientId: entry.clientId,
      pkceUsed: !!entry.codeChallenge,
      pkceMethod: entry.codeChallenge ? entry.codeChallengeMethod || "S256" : null,
      pkceVerified: !!entry.codeChallenge,
    });
    return res.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      id_token: fakeIdToken(USERNAME, entry.clientId),
      token_type: "Bearer",
      expires_in: 3600,
      scope: entry.scope,
    });
  }

  if (grant_type === "client_credentials") {
    if (!verifyClient(req)) {
      return res.status(401).json({ error: "invalid_client" });
    }
    const accessToken = randomToken("access");
    accessTokens.set(accessToken, { clientId: CLIENT_ID, scope: req.body.scope });
    tokenRequestLog.set(accessToken, {
      grantType: grant_type,
      clientId: CLIENT_ID,
      pkceUsed: false,
      pkceMethod: null,
      pkceVerified: false,
    });
    return res.json({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 3600,
      scope: req.body.scope,
    });
  }

  if (grant_type === "password") {
    const { username, password } = req.body;
    if (!verifyClient(req)) {
      return res.status(401).json({ error: "invalid_client" });
    }
    if (username !== USERNAME || password !== PASSWORD) {
      return res.status(400).json({ error: "invalid_grant" });
    }
    const accessToken = randomToken("access");
    const refreshToken = randomToken("refresh");
    accessTokens.set(accessToken, { clientId: CLIENT_ID, scope: req.body.scope });
    refreshTokens.set(refreshToken, {
      clientId: CLIENT_ID,
      scope: req.body.scope,
    });
    tokenRequestLog.set(accessToken, {
      grantType: grant_type,
      clientId: CLIENT_ID,
      pkceUsed: false,
      pkceMethod: null,
      pkceVerified: false,
    });
    return res.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: "Bearer",
      expires_in: 3600,
      scope: req.body.scope,
    });
  }

  if (grant_type === "refresh_token") {
    const { refresh_token } = req.body;
    const entry = refreshTokens.get(refresh_token);
    if (!entry) {
      return res.status(400).json({ error: "invalid_grant" });
    }
    if (!verifyClient(req)) {
      return res.status(401).json({ error: "invalid_client" });
    }
    const accessToken = randomToken("access");
    accessTokens.set(accessToken, entry);
    tokenRequestLog.set(accessToken, {
      grantType: grant_type,
      clientId: entry.clientId,
      pkceUsed: false,
      pkceMethod: null,
      pkceVerified: false,
    });
    return res.json({
      access_token: accessToken,
      refresh_token: refresh_token,
      token_type: "Bearer",
      expires_in: 3600,
      scope: entry.scope,
    });
  }

  return res.status(400).json({ error: "unsupported_grant_type" });
});

// A protected resource for send()-time verification that a fetched access
// token is actually usable end-to-end, mirroring misc/echo-server.js's
// own request-echo pattern.
app.get("/resource", (req, res) => {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");
  const entry = accessTokens.get(token);
  if (scheme !== "Bearer" || !entry) {
    return res
      .status(401)
      .json({ error: "invalid_token", authorization: authHeader || null });
  }
  res.json({
    ok: true,
    clientId: entry.clientId,
    scope: entry.scope || null,
    authorization: authHeader,
  });
});

// Lets a spec assert on what the server actually received for its own
// /token exchange (grant_type, PKCE verification), not only on what the
// Auth tab's UI shows afterward. Looked up by access_token — the caller
// already has it in hand from fetchOAuth2Tokens() — rather than "most
// recent", so concurrent specs each see only their own exchange.
app.get("/_debug/last-token-request", (req, res) => {
  const { access_token } = req.query;
  res.json(tokenRequestLog.get(access_token) || null);
});

app.get("/health", (req, res) => res.send("ok"));

app.listen(PORT, () => {
  process.stdout.write(
    `OAuth2 mock server listening at http://localhost:${PORT}\n`,
  );
});
