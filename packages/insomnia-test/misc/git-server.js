#!/usr/bin/env node
"use strict";

const http = require("http");
const path = require("path");
const os = require("os");
const fs = require("fs");
const zlib = require("zlib");
const { spawn, execFileSync } = require("child_process");
const backend = require("git-http-backend");

const PORT = 4070;
const REPOS_ROOT = path.join(os.tmpdir(), "insomnia-git-mock-server");

const DEFAULT_AUTH = { enabled: true, username: "testuser", password: "testpass" };

// Auth overrides are keyed by repo name so a test that exercises bad
// credentials / disabled auth only affects the one repo it created (via
// the `gitRepo` fixture's unique UUID name) — never a repo any other test
// is using concurrently or afterward. Repos with no override fall back to
// DEFAULT_AUTH.
const authOverrides = new Map(); // repoName -> { enabled, username, password }

function getAuth(repoName) {
  return authOverrides.get(repoName) || DEFAULT_AUTH;
}

fs.mkdirSync(REPOS_ROOT, { recursive: true });

function repoDir(name) {
  if (typeof name !== "string" || !name || name.includes("..")) {
    throw new Error(`Invalid repo name: ${name}`);
  }
  return path.join(REPOS_ROOT, name.replace(/[^a-zA-Z0-9._-]/g, ""));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function isAuthorized(req, repoName) {
  const auth = getAuth(repoName);
  if (!auth.enabled) return true;
  const [scheme, encoded] = (req.headers.authorization || "").split(" ");
  if (scheme !== "Basic" || !encoded) return false;
  const [user, pass] = Buffer.from(encoded, "base64").toString().split(":");
  return user === auth.username && pass === auth.password;
}

/** Creates a fresh bare repo, discarding any prior contents at that name. */
function initBareRepo(name) {
  const dir = repoDir(name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  execFileSync("git", ["init", "--bare", "-b", "master", dir]);
}

/**
 * Seeds a bare repo with one empty commit on `master`, via a throwaway
 * working clone. The commit is intentionally file-less: Insomnia's clone
 * flow treats a repo with zero files as "Create Blank Project" rather than
 * "Clone Project"/"Clone and Migrate", which is what these tests expect.
 */
function seedRepo(name) {
  const dir = repoDir(name);
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "insomnia-git-seed-"));
  try {
    execFileSync("git", ["init", "-b", "master", workDir]);
    execFileSync(
      "git",
      [
        "-c",
        "user.name=Mock Seed",
        "-c",
        "user.email=seed@example.com",
        "commit",
        "--allow-empty",
        "-m",
        "Initial commit",
      ],
      { cwd: workDir },
    );
    execFileSync("git", ["remote", "add", "origin", dir], { cwd: workDir });
    execFileSync("git", ["push", "origin", "master"], { cwd: workDir });
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

/** Lists local branch names in a bare repo, e.g. ["master", "branch1"]. */
function listBranches(name) {
  const dir = repoDir(name);
  const output = execFileSync("git", [
    "--git-dir",
    dir,
    "branch",
    "--format=%(refname:short)",
  ]).toString();
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Lists commits reachable from `branch` in a bare repo, newest first, as
 * `{ id, message, authorName, authorEmail }`. Returns `[]` if the branch
 * doesn't exist rather than throwing, since "not pushed yet" is a normal
 * state for tests to check.
 */
function listCommits(name, branch) {
  const dir = repoDir(name);
  const format = "%H%x1f%s%x1f%an%x1f%ae";
  let output;
  try {
    output = execFileSync("git", [
      "--git-dir",
      dir,
      "log",
      branch,
      `--format=${format}`,
    ]).toString();
  } catch {
    return [];
  }
  return output
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [id, message, authorName, authorEmail] = line.split("\x1f");
      return { id, message, authorName, authorEmail };
    });
}

async function handleAdmin(req, res, url) {
  const segments = url.pathname.split("/").filter(Boolean);

  if (req.method === "GET" && segments.length === 1) {
    return sendJson(res, 200, { ok: true });
  }

  // Server-wide reset — intended for a one-off cleanup (e.g. global setup),
  // not per-test cleanup: it wipes every repo, including ones other tests
  // may still be relying on. Specs should DELETE their own repo instead.
  if (
    req.method === "POST" &&
    segments[1] === "reset" &&
    segments.length === 2
  ) {
    fs.rmSync(REPOS_ROOT, { recursive: true, force: true });
    fs.mkdirSync(REPOS_ROOT, { recursive: true });
    authOverrides.clear();
    return sendJson(res, 200, { ok: true });
  }

  if (segments[1] === "repos" && segments.length === 3) {
    const name = decodeURIComponent(segments[2]);
    if (req.method === "PUT" || req.method === "POST") {
      const body = await readJsonBody(req);
      initBareRepo(name);
      if (body.seed) seedRepo(name);
      return sendJson(res, 201, { name });
    }
    if (req.method === "DELETE") {
      fs.rmSync(repoDir(name), { recursive: true, force: true });
      authOverrides.delete(name);
      return sendJson(res, 200, { name });
    }
  }

  // Per-repo auth override, so a test exercising bad credentials / disabled
  // auth only affects the one repo it created, never another test's repo.
  if (
    segments[1] === "repos" &&
    segments.length === 4 &&
    segments[3] === "auth" &&
    req.method === "PUT"
  ) {
    const name = decodeURIComponent(segments[2]);
    const body = await readJsonBody(req);
    const current = getAuth(name);
    const next = {
      enabled: body.enabled !== false,
      username: body.username ?? current.username,
      password: body.password ?? current.password,
    };
    authOverrides.set(name, next);
    return sendJson(res, 200, next);
  }

  if (
    req.method === "GET" &&
    segments[1] === "repos" &&
    segments.length === 4 &&
    segments[3] === "branches"
  ) {
    const name = decodeURIComponent(segments[2]);
    return sendJson(res, 200, { branches: listBranches(name) });
  }

  if (
    req.method === "GET" &&
    segments[1] === "repos" &&
    segments.length === 4 &&
    segments[3] === "commits"
  ) {
    const name = decodeURIComponent(segments[2]);
    const branch = url.searchParams.get("branch") || "master";
    return sendJson(res, 200, { commits: listCommits(name, branch) });
  }

  sendJson(res, 404, { error: "not found" });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === "/" || url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok\n");
    return;
  }

  if (url.pathname.startsWith("/_admin")) {
    handleAdmin(req, res, url).catch((err) => {
      sendJson(res, 400, { error: String(err) });
    });
    return;
  }

  const repoName = decodeURIComponent(url.pathname.split("/")[1] || "");

  if (!isAuthorized(req, repoName)) {
    res.writeHead(401, {
      "WWW-Authenticate": 'Basic realm="git"',
      "Content-Type": "text/plain",
    });
    res.end("Unauthorized\n");
    return;
  }

  let dir;
  try {
    dir = repoDir(repoName);
  } catch (err) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end(String(err));
    return;
  }
  if (!fs.existsSync(dir)) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Repository not found\n");
    return;
  }

  const reqStream =
    req.headers["content-encoding"] === "gzip"
      ? req.pipe(zlib.createGunzip())
      : req;

  reqStream
    .pipe(
      backend(req.url, (err, service) => {
        if (err) {
          res.statusCode = 500;
          res.end(String(err));
          return;
        }
        res.setHeader("content-type", service.type);
        const ps = spawn(service.cmd, service.args.concat(dir));
        ps.stdout.pipe(service.createStream()).pipe(ps.stdin);
      }),
    )
    .pipe(res);
});

server.listen(PORT, () => {
  process.stdout.write(
    `Git mock server listening at http://localhost:${PORT}\n`,
  );
});
