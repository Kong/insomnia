/**
 * Agent driver for the Insomnia Electron app.
 *
 * Long-running process: launches Insomnia once via Playwright's `_electron`
 * and exposes an HTTP control channel, so an agent can drive the live UI across
 * many separate shell calls without paying the ~20s startup cost each time.
 *
 * Start:   node .claude/skills/run-insomnia/driver.mjs        (run in background)
 * Control: node .claude/skills/run-insomnia/drive.mjs <op> '<json>'
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import { createRequire, register } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * The Insomnia checkout to drive. Derived from the working directory rather than
 * from this file's location, so one copy of this skill installed under
 * ~/.claude/skills/ serves every git worktree: `cd <worktree> && node <this>`.
 */
function findRepoRoot(start) {
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, 'packages', 'insomnia', 'package.json'))) {
      return dir;
    }
    const up = path.dirname(dir);
    if (up === dir) {
      return null;
    }
    dir = up;
  }
}

const REPO = process.env.INSOMNIA_REPO || findRepoRoot(process.cwd());
if (!REPO) {
  console.error(
    'No Insomnia checkout found from ' + process.cwd() + '. ' +
      'Start the driver from inside a worktree, or set INSOMNIA_REPO=<path>.',
  );
  process.exit(1);
}

// Resolve dependencies out of the *repo's* node_modules. This file lives outside
// any package, so bare imports would search ~/.claude/** and find nothing. Sharing
// the repo's playwright-core is also what keeps the Locator instances an exec
// script sees identical to the driver's.
const repoRequire = createRequire(path.join(REPO, 'package.json'));
const { expect } = repoRequire('@playwright/test');
const { _electron: electron } = repoRequire('playwright-core');

const APP_CWD = path.join(REPO, 'packages', 'insomnia');
const FIXTURES = path.join(REPO, 'packages', 'insomnia-smoke-test', 'fixtures');
const PORT = Number(process.env.DRIVER_PORT || 9800);
const SHOT_DIR = process.env.SHOT_DIR || path.join(os.tmpdir(), 'insomnia-shots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const electronRelative = {
  win32: 'electron.exe',
  darwin: 'Electron.app/Contents/MacOS/Electron',
}[process.platform] || 'electron';
const ELECTRON_BIN = path.join(REPO, 'node_modules', 'electron', 'dist', electronRelative);

const ECHO = 'http://localhost:4010';

/** @type {import('playwright-core').ElectronApplication | null} */
let app = null;
/** @type {import('playwright-core').Page | null} */
let page = null;
let dataPath = null;
let currentProfile = null;
let consoleLog = [];
let pageErrors = [];

// The same offline test account the smoke tests sign in with.
const SESSION = {
  id: 'sess_64a477e6b59d43a5a607f84b4f73e3ce',
  sessionExpiry: new Date(2147483647000),
  publicKey: {
    alg: 'RSA-OAEP-256',
    e: 'AQAB',
    ext: true,
    key_ops: ['encrypt'],
    kty: 'RSA',
    n: 'pTQVaUaiqggIldSKm6ib6eFRLLoGj9W-2O4gTbiorR-2b8-ZmKUwQ0F-jgYX71AjYaFn5VjOHOHSP6byNAjN7WzJ6A_Z3tytNraLoZfwK8KdfflOCZiZzQeD3nO8BNgh_zEgCHStU61b6N6bSpCKjbyPkmZcOkJfsz0LJMAxrXvFB-I42WYA2vJKReTJKXeYx4d6L_XGNIoYtmGZit8FldT4AucfQUXgdlKvr4_OZmt6hgjwt_Pjcu-_jO7m589mMWMebfUhjte3Lp1jps0MqTOvgRb0FQf5eoBHnL01OZjvFPDKeqlvoz7II9wFNHIKzSvgAKnyemh6DiyPuIukyQ',
  },
  encPrivateKey: { iv: '', t: '', d: '', ad: '' },
  symmetricKey: {
    alg: 'A256GCM',
    ext: true,
    k: 'w62OJNWF4G8iWA8ZrTpModiY8dICyHI7ko1vMLb877g=',
    key_ops: ['encrypt', 'decrypt'],
    kty: 'oct',
  },
  email: 'insomnia-user@konghq.com',
  accountId: 'acct_64a477e6b59d43a5a607f84b4f73e3ce',
  firstName: 'Rick',
  lastName: 'Morty',
};

// ---------------------------------------------------------------------------
// Profiles: which backend the app talks to
// ---------------------------------------------------------------------------

/**
 * Every env var that steers Insomnia at a backend. Stripped from the inherited
 * environment before a profile's own values are applied, so a stray
 * `INSOMNIA_API_URL` in the developer's shell can't silently point a "prod" run
 * somewhere else — or leak echo-server values into a real-account run.
 */
const MANAGED_ENV_KEYS = [
  'INSOMNIA_API_URL',
  'INSOMNIA_APP_WEBSITE_URL',
  'INSOMNIA_AI_URL',
  'INSOMNIA_MOCK_API_URL',
  'INSOMNIA_GITHUB_REST_API_URL',
  'INSOMNIA_GITHUB_API_URL',
  'INSOMNIA_GITLAB_API_URL',
  'INSOMNIA_UPDATES_URL',
  'KONNECT_API_URL',
  'KONNECT_API_REGIONS',
  'OAUTH_REDIRECT_URL',
  'OAUTH_RELAY_URL',
  'INSOMNIA_SESSION',
  'INSOMNIA_PUBLIC_KEY',
  'INSOMNIA_SECRET_KEY',
  'INSOMNIA_VAULT_KEY',
  'INSOMNIA_VAULT_SALT',
  'INSOMNIA_VAULT_SRP_SECRET',
  'INSOMNIA_SKIP_ONBOARDING',
];

const BUILTIN_PROFILES = {
  mock: {
    description: 'local echo server + injected fake session. Nothing leaves the machine.',
    // Wiped on every launch so tests start from a known state.
    ephemeral: true,
    env: {
      INSOMNIA_API_URL: ECHO,
      INSOMNIA_APP_WEBSITE_URL: ECHO + '/website',
      INSOMNIA_AI_URL: ECHO + '/ai',
      INSOMNIA_GITHUB_REST_API_URL: ECHO + '/github-api/rest',
      INSOMNIA_GITHUB_API_URL: ECHO + '/github-api/graphql',
      INSOMNIA_GITLAB_API_URL: ECHO + '/gitlab-api',
      INSOMNIA_UPDATES_URL: ECHO,
      INSOMNIA_MOCK_API_URL: 'https://mock-stage.insomnia.run',
      KONNECT_API_URL: ECHO,
      KONNECT_API_REGIONS: 'us',
      INSOMNIA_SKIP_ONBOARDING: 'true',
      // NOT a credential, despite looking like one to a secret scanner. This is
      // the same deterministic keypair the smoke tests use - see
      // packages/insomnia-smoke-test/playwright/test.ts, where it has lived
      // since 2023. ui/auth-session-provider.client.ts generates a fresh
      // sealed-box keypair on every page load; these two vars only pin it so the
      // browser-login handshake is reproducible. The keypair is the client half
      // of that handshake - the real secret is the session token the website
      // seals to it. It is registered with no service and grants no access.
      INSOMNIA_PUBLIC_KEY: 'txb/w8DASTpPQqeHE/hpI3ABKzit+pv5n2We5dbtYRo=',
      INSOMNIA_SECRET_KEY: 'Tb1QKsI3wVZxhS8TuQESHB2x7f68PzeTzTMmLpnnFVU=',
      INSOMNIA_SESSION: JSON.stringify(SESSION),
    },
  },
  prod: {
    description: 'REAL production backend (api.insomnia.rest) with a real account. Touches real cloud data.',
    // No overrides at all: constants.ts already defaults to production, and an
    // empty env is what makes the app generate its own login keypair.
    env: {},
  },
};

/**
 * Default backend for `launch` with no `profile`. Production, because that is
 * where this app is actually developed against day to day; `mock` is the
 * exception, for offline work and for reproducing smoke-test scenarios.
 * Override per session with DRIVER_PROFILE=dev.
 */
const DEFAULT_PROFILE = process.env.DRIVER_PROFILE || 'prod';

/**
 * Extra profiles (dev, staging, a self-hosted instance) come from
 * `profiles.json` next to this file: { "<name>": { "description": "...", "env": { ... } } }.
 * Not committed - it tends to hold internal hostnames.
 */
function loadProfiles() {
  const file = path.join(HERE, 'profiles.json');
  let custom = {};
  if (fs.existsSync(file)) {
    try {
      custom = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      throw new Error('profiles.json is not valid JSON: ' + e.message);
    }
  }
  return { ...BUILTIN_PROFILES, ...custom };
}

/** Persistent profiles keep their data dir - that is what makes a login survive. */
function profileDataPath(name) {
  return path.join(os.homedir(), '.insomnia-driver', name);
}

// ---------------------------------------------------------------------------
// Friction log
// ---------------------------------------------------------------------------

/**
 * Cross-worktree channel for "this driver got in my way".
 *
 * Per-project memory lives under ~/.claude/projects/<cwd-slug>/, so a session
 * working in another worktree cannot leave a note that a session here would
 * read. This file is outside any checkout and shared by every worktree, so it
 * is the one place feedback survives the jump.
 *
 * Every failed op lands here automatically; `note` adds a human/agent remark.
 * Read it back with `feedback`.
 */
const FEEDBACK_LOG = path.join(os.homedir(), '.insomnia-driver', 'feedback.jsonl');
const FEEDBACK_MAX_LINES = 1000;

// Failures that are answers, not friction: probes and guards the caller asked for.
const NOT_FRICTION = new Set(['help', 'status', 'profiles', 'feedback', 'note', 'whoami', 'count', 'logs', 'errors']);

function appendFeedback(entry) {
  try {
    fs.mkdirSync(path.dirname(FEEDBACK_LOG), { recursive: true });
    fs.appendFileSync(
      FEEDBACK_LOG,
      JSON.stringify({ ts: new Date().toISOString(), repo: REPO, profile: currentProfile, ...entry }) + '\n',
    );
    // Cheap cap: rewrite only once the file is well past the limit.
    const lines = fs.readFileSync(FEEDBACK_LOG, 'utf8').split('\n').filter(Boolean);
    if (lines.length > FEEDBACK_MAX_LINES * 1.5) {
      fs.writeFileSync(FEEDBACK_LOG, lines.slice(-FEEDBACK_MAX_LINES).join('\n') + '\n');
    }
  } catch {
    // Never let logging break an op.
  }
}

/**
 * What was on screen when an op failed. Time-boxed and swallowing its own
 * errors: this runs on a path that is already failing, and must never turn a
 * useful error into a driver crash or a hang.
 */
async function captureContext() {
  if (!page || page.isClosed()) {
    return { screen: '(no window)' };
  }
  const ctx = {};
  try {
    ctx.url = page.url();
  } catch {}
  try {
    const snapshot = await Promise.race([
      page.locator('body').ariaSnapshot({ timeout: 2000 }),
      new Promise(resolve => setTimeout(() => resolve(null), 2500)),
    ]);
    if (snapshot) {
      ctx.screen = snapshot.slice(0, 1200);
    }
  } catch {}
  return ctx;
}

// ---------------------------------------------------------------------------
// Window placement
// ---------------------------------------------------------------------------

/**
 * Where to put the app window on launch. The driver is usually being watched
 * from an editor on another monitor, and an Insomnia window that lands on top
 * of that editor buries the very conversation describing what it is doing.
 *
 * 'right' | 'left' | 'primary' | <display index> | 'none' to leave it alone.
 */
const DEFAULT_DISPLAY = process.env.DRIVER_DISPLAY || 'right';

/** Moves the main window onto the requested display and maximises it there. */
async function placeWindow(preference) {
  const want = preference === undefined ? DEFAULT_DISPLAY : preference;
  if (want === 'none' || want === false) {
    return { placed: false };
  }
  return app.evaluate(({ BrowserWindow, screen }, pref) => {
    const displays = screen.getAllDisplays();
    let target;
    if (typeof pref === 'number') {
      target = displays[pref];
    } else if (pref === 'primary') {
      target = screen.getPrimaryDisplay();
    } else if (pref === 'left') {
      target = displays.reduce((a, b) => (b.bounds.x < a.bounds.x ? b : a));
    } else {
      target = displays.reduce((a, b) => (b.bounds.x > a.bounds.x ? b : a));
    }
    if (!target) {
      return { placed: false, reason: 'no display matched ' + JSON.stringify(pref) };
    }
    // The visible app window, not the hidden plugin/worker windows.
    const win = BrowserWindow.getAllWindows().find(w => w.isVisible()) || BrowserWindow.getAllWindows()[0];
    if (!win) {
      return { placed: false, reason: 'no window' };
    }
    // Bounds first, then maximize: maximize() targets whichever display the
    // window currently sits on, so moving afterwards would undo it.
    win.setBounds(target.workArea);
    win.maximize();
    return {
      placed: true,
      displays: displays.length,
      on: { x: target.bounds.x, y: target.bounds.y, width: target.bounds.width, height: target.bounds.height },
      primary: target.id === screen.getPrimaryDisplay().id,
    };
  }, want);
}

// ---------------------------------------------------------------------------
// Network hooks (shared by netlog and throttle)
// ---------------------------------------------------------------------------

/**
 * Installs one set of `session.defaultSession.webRequest` listeners in the main
 * process, driven by `globalThis.__driverNet`. Idempotent.
 *
 * Electron permits a single listener per webRequest event per session, so
 * `netlog` and `throttle` must share them; installing separately would mean
 * whichever ran last silently disabled the other.
 */
async function ensureNetHooks() {
  if (!app) {
    throw new Error('not launched');
  }
  await app.evaluate(({ session }) => {
    const g = globalThis;
    if (g.__driverNet && g.__driverNet.installed) {
      return;
    }
    g.__driverNet = {
      installed: true,
      recording: false,
      pattern: null,
      all: false,
      latencyMs: 0,
      latencyPattern: null,
      log: [],
      seq: 0,
    };
    const pending = new Map();
    const filter = { urls: ['<all_urls>'] };
    const wr = session.defaultSession.webRequest;

    const inScope = (url, pattern, all) => {
      if (!all && !url.startsWith('http')) {
        return false;
      }
      return !pattern || url.includes(pattern);
    };

    wr.onBeforeRequest(filter, (details, cb) => {
      const n = g.__driverNet;
      // Filter while recording, not on read: Sentry's IPC protocol alone emits
      // hundreds of entries a minute and would evict the real traffic.
      if (n.recording && inScope(details.url, n.pattern, n.all)) {
        const rec = {
          n: ++n.seq,
          method: details.method,
          url: details.url,
          type: details.resourceType,
          start: Date.now(),
        };
        pending.set(details.id, rec);
        n.log.push(rec);
        if (n.log.length > 1000) {
          n.log.shift();
        }
      }
      // Holding the callback is the only delay that actually reaches the wire
      // here, because the request is re-issued from main by the protocol handler.
      if (n.latencyMs > 0 && inScope(details.url, n.latencyPattern, n.all)) {
        setTimeout(() => cb({}), n.latencyMs);
        return;
      }
      cb({});
    });

    wr.onCompleted(filter, details => {
      const rec = pending.get(details.id);
      if (rec) {
        rec.status = details.statusCode;
        rec.ms = Date.now() - rec.start;
        rec.fromCache = details.fromCache;
        pending.delete(details.id);
      }
    });

    wr.onErrorOccurred(filter, details => {
      const rec = pending.get(details.id);
      if (rec) {
        rec.error = details.error;
        rec.ms = Date.now() - rec.start;
        pending.delete(details.id);
      }
    });
  });
}

/** Collapses volatile detail so repeated failures group together. */
function errorSignature(message) {
  return String(message)
    .split('\n')[0]
    .replace(/\d+ms/g, '<ms>')
    .replace(/\b\d{3,}\b/g, '<n>')
    .slice(0, 160);
}

function buildEnv({ profile, dataPath, extraEnv = {} }) {
  const { ELECTRON_RUN_AS_NODE: _drop, ...base } = process.env;
  for (const key of MANAGED_ENV_KEYS) {
    delete base[key];
  }
  return {
    ...base,
    INSOMNIA_DATA_PATH: dataPath,
    // Only enables the file-dialog stub queue (main/ipc/electron.ts); harmless
    // for real-backend runs and needed for scripted import/export.
    PLAYWRIGHT: 'true',
    ...profile.env,
    ...extraEnv,
  };
}

/** Pre-seeds a Settings doc so the app starts with known settings (mirrors seedSettings). */
function seedSettings(dir, patch) {
  fs.mkdirSync(dir, { recursive: true });
  const doc = {
    _id: 'set_' + Math.random().toString(16).slice(2) + Date.now().toString(16),
    type: 'Settings',
    parentId: null,
    modified: Date.now(),
    created: Date.now(),
    ...patch,
  };
  fs.writeFileSync(path.join(dir, 'insomnia.Settings.db'), JSON.stringify(doc) + '\n');
}

function killTree(pid) {
  if (!pid) {
    return;
  }
  if (process.platform === 'win32') {
    try {
      execFileSync('taskkill', ['/pid', String(pid), '/T', '/F']);
    } catch {}
    return;
  }
  try {
    process.kill(pid, 'SIGKILL');
  } catch {}
}

// ---------------------------------------------------------------------------
// Element targeting
// ---------------------------------------------------------------------------

/**
 * Turns a plain-JSON target description into a Playwright Locator.
 * Accepts a string (treated as CSS) or an object combining one of
 * css | role+name | text | testid | label | placeholder | title,
 * plus `within` (another target, used as a scope), `hasText`, `nth`/`first`/`last`.
 */
function locate(target, root) {
  const base = root || page;
  if (!target) {
    return base.locator('body');
  }
  if (typeof target === 'string') {
    return base.locator(target);
  }

  const scope = target.within ? locate(target.within, base) : base;

  let loc;
  if (target.css) {
    loc = scope.locator(target.css);
  } else if (target.role) {
    loc = scope.getByRole(target.role, {
      name: target.name,
      exact: target.exact,
      ...(target.checked === undefined ? {} : { checked: target.checked }),
    });
  } else if (target.testid) {
    loc = scope.getByTestId(target.testid);
  } else if (target.label) {
    loc = scope.getByLabel(target.label, { exact: target.exact });
  } else if (target.placeholder) {
    loc = scope.getByPlaceholder(target.placeholder, { exact: target.exact });
  } else if (target.title) {
    loc = scope.getByTitle(target.title, { exact: target.exact });
  } else if (target.text) {
    loc = scope.getByText(target.text, { exact: target.exact });
  } else {
    throw new Error('target needs one of: css, role, testid, label, placeholder, title, text');
  }

  if (target.hasText) {
    loc = loc.filter({ hasText: target.hasText });
  }
  if (typeof target.nth === 'number') {
    loc = loc.nth(target.nth);
  }
  if (target.first) {
    loc = loc.first();
  }
  if (target.last) {
    loc = loc.last();
  }
  return loc;
}

function need() {
  if (!page) {
    throw new Error('not launched - run `launch` first');
  }
  return page;
}

// ---------------------------------------------------------------------------
// exec: run arbitrary Playwright code against the live app
// ---------------------------------------------------------------------------

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

// Lets exec scripts be TypeScript and import the repo's own Page Objects.
register('./ts-loader.mjs', { parentURL: import.meta.url, data: { repo: REPO } });

/**
 * Loads an exec script and returns its default export. `.ts` works because of
 * the loader registered above; `.mjs`/`.js` import natively.
 */
async function loadExecScript(file) {
  const candidates = path.isAbsolute(file) ? [file] : [path.resolve(REPO, file), path.resolve(HERE, file)];
  const abs = candidates.find(c => fs.existsSync(c));
  if (!abs) {
    throw new Error('exec script not found. Tried: ' + candidates.join(', '));
  }
  // Cache-bust so re-running an edited script picks up the edit. Only the entry
  // is busted; edits to modules it imports need a driver restart.
  const mod = await import(pathToFileURL(abs).href + '?t=' + Date.now());
  const fn = mod.default;
  if (typeof fn !== 'function') {
    throw new TypeError(file + ' must `export default` an async function taking the context object');
  }
  return fn;
}

/** JSON-safe view of whatever the script returned (Locators etc. are not serialisable). */
function serialise(v) {
  if (v === undefined || v === null) {
    return v;
  }
  try {
    JSON.stringify(v);
    return v;
  } catch {
    return String(v);
  }
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

const OPS = {
  /** Which backends are configured, and where each one's data lives. */
  async profiles() {
    const all = loadProfiles();
    return {
      current: currentProfile,
      default: DEFAULT_PROFILE,
      profiles: Object.fromEntries(
        Object.entries(all).map(([name, p]) => [
          name,
          {
            description: p.description || '',
            persistent: !p.ephemeral,
            dataPath: p.ephemeral ? '(temp, wiped each launch)' : profileDataPath(name),
            loggedIn: p.ephemeral ? '(injected fake session)' : fs.existsSync(path.join(profileDataPath(name), 'insomnia.UserSession.db')),
          },
        ]),
      ),
    };
  },

  /**
   * Launch Insomnia. Requires the Vite dev server (`npm run watch:app`) to be
   * running - dev-mode Electron loads the renderer from it.
   * args: { profile?, dataPath?, fresh?, fixtureDb?, settings?, env?, display? }
   *
   * `profile` defaults to DEFAULT_PROFILE ('prod'). Real-backend profiles keep a persistent data
   * dir under ~/.insomnia-driver/<profile>, which is what lets a real login be
   * reused instead of repeated - the session lives in that dir's NeDB and the
   * login keypair in its localStorage (entry.main.ts points userData there).
   */
  async launch(a = {}) {
    if (app && page && !page.isClosed()) {
      return { already: true, profile: currentProfile, dataPath };
    }
    // A half-launched or manually-closed app leaves stale handles behind.
    if (app) {
      await OPS.quit();
    }
    const all = loadProfiles();
    const name = a.profile || DEFAULT_PROFILE;
    const profile = all[name];
    if (!profile) {
      throw new Error('unknown profile "' + name + '". Known: ' + Object.keys(all).join(', '));
    }
    currentProfile = name;
    if (!fs.existsSync(path.join(APP_CWD, 'src', 'entry.main.min.js'))) {
      throw new Error('src/entry.main.min.js missing - run `npm run watch:app` from the repo root first');
    }
    if (!fs.existsSync(path.join(APP_CWD, '.vite-port'))) {
      throw new Error('.vite-port missing - the Vite dev server is not running (`npm run watch:app`)');
    }

    if (a.dataPath) {
      dataPath = a.dataPath;
    } else if (profile.ephemeral) {
      dataPath = path.join(os.tmpdir(), 'insomnia-driver', name, String(Date.now()));
    } else {
      dataPath = profileDataPath(name);
    }

    // Only ephemeral profiles get wiped. Wiping a real profile would throw away
    // the login it exists to preserve, so `fresh: true` has to be explicit.
    const wipe = a.fresh === undefined ? !!profile.ephemeral && !a.dataPath : a.fresh;
    if (wipe) {
      fs.rmSync(dataPath, { recursive: true, force: true });
    }

    // A data dir belongs to exactly one profile. Launching `mock` against a real
    // profile's dir would write its fake INSOMNIA_SESSION over the real login,
    // so record the owner and refuse a mismatch.
    const marker = path.join(dataPath, '.driver-profile');
    if (fs.existsSync(marker)) {
      const owner = fs.readFileSync(marker, 'utf8').trim();
      if (owner !== name && !a.allowProfileMismatch) {
        throw new Error(
          'data dir ' + dataPath + ' belongs to profile "' + owner + '", not "' + name + '". ' +
            'Launching a different profile against it can overwrite its saved login. ' +
            'Pass {"allowProfileMismatch":true} to override.',
        );
      }
    }
    fs.mkdirSync(dataPath, { recursive: true });
    fs.writeFileSync(marker, name);

    if (a.fixtureDb) {
      const src = path.join(FIXTURES, a.fixtureDb);
      if (!fs.existsSync(src)) {
        throw new Error('no such fixture db: ' + src);
      }
      fs.cpSync(src, dataPath, { recursive: true });
    }
    // `sidebarFocusForCollections` narrows the sidebar to one collection on click,
    // which hides the rest of the tree - off by default here, as in the smoke tests.
    // Only seeded on first use, so it can't clobber a real profile's settings.
    if (!fs.existsSync(path.join(dataPath, 'insomnia.Settings.db'))) {
      seedSettings(dataPath, { sidebarFocusForCollections: false, ...(a.settings || {}) });
    }

    consoleLog = [];
    pageErrors = [];

    app = await electron.launch({
      cwd: APP_CWD,
      executablePath: ELECTRON_BIN,
      // `.` rather than the entry file: entry.main.ts registers the `insomniadev://`
      // protocol handler with `process.argv.slice(1)`, rewriting a literal `.` to an
      // absolute path. Passing the relative entry path instead would register a
      // command line that only works from this cwd, breaking the browser login callback.
      args: ['--no-sandbox', '.'],
      env: buildEnv({ profile, dataPath, extraEnv: a.env }),
      timeout: 120000,
    });

    try {
      page = await app.firstWindow({ timeout: 120_000 });
    } catch (e) {
      // Most often the single-instance lock: entry.main.ts calls
      // requestSingleInstanceLock() whenever deep linking is on (i.e. unless
      // PLAYWRIGHT_TEST is set), so a leftover Electron holding the lock for
      // this userData dir makes the new process quit on startup.
      try {
        await app.close();
      } catch {}
      app = null;
      page = null;
      throw new Error(
        'the app exited during launch. Usually a stray Electron still holds the single-instance lock ' +
          '(check with `tasklist /fi "imagename eq electron.exe"`, then `taskkill /f /im electron.exe`). Original: ' +
          e.message,
      );
    }
    page.on('console', m => {
      consoleLog.push({ type: m.type(), text: m.text() });
      if (consoleLog.length > 500) {
        consoleLog.shift();
      }
    });
    page.on('pageerror', e =>
      pageErrors.push({ message: e.message, stack: String(e.stack || '').split('\n').slice(0, 4).join('\n') }),
    );
    await page.waitForLoadState();
    const placement = await placeWindow(a.display);
    return { profile: name, dataPath, url: page.url(), windows: app.windows().length, placement };
  },

  /**
   * Move the app window to another monitor and maximise it there.
   * 'right' (default) | 'left' | 'primary' | <index> | 'none'
   */
  async moveWindow(a = {}) {
    if (!app) {
      throw new Error('not launched');
    }
    return placeWindow(a.display);
  },

  /** Who the app thinks it is, and which backend it is pointed at. */
  async whoami() {
    const p = need();
    const sess = await OPS.db({
      type: 'UserSession',
      fields: ['id', 'accountId', 'email', 'firstName', 'lastName'],
    });
    const backend = await p.evaluate(() => ({
      api: window.env?.INSOMNIA_API_URL || 'https://api.insomnia.rest',
      website: window.env?.INSOMNIA_APP_WEBSITE_URL || 'https://app.insomnia.rest',
      hasLoginKeypair: !!window.localStorage.getItem('insomnia.publicKey'),
    }));
    // A UserSession doc exists from init() even when logged out; `id` is what fills in.
    const user = sess.docs.find(d => d.id) || null;
    return {
      profile: currentProfile,
      repo: REPO,
      dataPath,
      backend,
      loggedIn: !!user,
      // The session id is a live credential - report only that one exists.
      user: user ? { email: user.email, accountId: user.accountId, name: (user.firstName + ' ' + user.lastName).trim() } : null,
      url: p.url(),
    };
  },

  /**
   * Step 1 of a real login: hand off to the user's browser.
   *
   * Clicks the app's own provider button rather than opening the URL directly:
   * that is what routes the app to /auth/login-tip -> /auth/authorize, where the
   * paste-token box lives, and it exercises the same code path a user would.
   *
   * CRITICAL: the login keypair is regenerated on every page load
   * (auth-session-provider.client.ts calls `sealedBox.keyPair()` at module scope
   * and overwrites localStorage). A `reload`, `relaunch` or driver restart
   * between `login` and the token exchange invalidates the token. Don't.
   */
  async login(a = {}) {
    const p = need();
    const existing = await OPS.whoami();
    if (existing.loggedIn && !a.force) {
      return { alreadyLoggedIn: true, ...existing, hint: 'pass {"force":true} to log in as someone else' };
    }

    const available = [];
    for (const name of ['Google', 'GitHub', 'Email', 'SSO']) {
      if (await p.getByRole('button', { name: 'Continue with ' + name }).count()) {
        available.push(name);
      }
    }
    if (!available.length) {
      throw new Error('no provider buttons on screen - the app is at ' + p.url() + ', not the login screen');
    }

    const publicKey = await p.evaluate(() => window.localStorage.getItem('insomnia.publicKey'));
    const website = await p.evaluate(() => window.env?.INSOMNIA_APP_WEBSITE_URL || 'https://app.insomnia.rest');
    const url = new URL(website);
    url.pathname = '/app/auth-app/';
    url.searchParams.set('loginKey', encodeURIComponent(publicKey || ''));
    url.searchParams.set('source_origin', 'desktop_app');

    if (!a.provider) {
      return {
        needProvider: true,
        available,
        url: url.toString(),
        hint: 'call again with {"provider":"GitHub"} to click it, or open the url yourself',
      };
    }
    if (!available.includes(a.provider)) {
      throw new Error('unknown provider "' + a.provider + '". Available: ' + available.join(', '));
    }

    // The app's clientAction calls openInBrowser itself and redirects to /auth/login-tip.
    await p.getByRole('button', { name: 'Continue with ' + a.provider }).click();
    await p.waitForURL(/\/auth\/(login-tip|authorize)/, { timeout: 20_000 }).catch(() => {});

    // Park on the paste-token screen so the fallback is ready if the deep link
    // never fires. Client-side navigation - no reload, so the keypair survives.
    const alternatives = p.getByRole('button', { name: 'Show login alternatives' });
    if (await alternatives.count()) {
      await alternatives.click();
    }

    return {
      openedInBrowser: true,
      provider: a.provider,
      url: url.toString(),
      appUrl: p.url(),
      next: 'finish signing in in the browser, then run `waitForSession`. If the app never returns, copy the token the site shows and run `submitCode`.',
    };
  },

  /** Step 2 fallback: paste the token the website shows when the deep link doesn't fire. */
  async submitCode(a) {
    const p = need();
    if (!a.code) {
      throw new Error('submitCode needs `code`');
    }
    const input = p.locator('input[name="code"]');
    if (!(await input.count())) {
      const alternatives = p.getByRole('button', { name: 'Show login alternatives' });
      if (await alternatives.count()) {
        await alternatives.click();
      }
    }
    // Never `goto` here: a page load regenerates the keypair, and the token the
    // site issued can no longer be opened.
    await input.fill(String(a.code).trim(), { timeout: 10_000 });
    await p.getByRole('button', { name: 'Log in' }).click();
    return OPS.waitForSession({ timeout: a.timeout || 60_000 });
  },

  /** Polls until a session lands in the data dir (or times out). */
  async waitForSession(a = {}) {
    const deadline = Date.now() + (a.timeout || 300_000);
    for (;;) {
      const r = await OPS.db({ type: 'UserSession', fields: ['id', 'email', 'accountId'] });
      const user = r.docs[0];
      if (user && user.id) {
        return { loggedIn: true, user: { email: user.email, accountId: user.accountId } };
      }
      if (Date.now() > deadline) {
        return { loggedIn: false, timedOut: true, url: page ? page.url() : null };
      }
      await new Promise(r2 => setTimeout(r2, 2000));
    }
  },

  async quit() {
    if (!app) {
      return { closed: false };
    }
    const pid = app.process() && app.process().pid;
    try {
      await Promise.race([
        app.close(),
        new Promise((_, r) => setTimeout(() => r(new Error('close timeout')), 5000)),
      ]);
    } catch {
      killTree(pid);
    }
    app = null;
    page = null;
    return { closed: true };
  },

  /**
   * Reload the renderer only. The Vite dev server serves the renderer, so after
   * editing anything under src/ui this picks the change up in ~2s - far cheaper
   * than a relaunch. Changes to src/main/** need `relaunch` instead, because the
   * main process bundle is only rebuilt by the esbuild entrypoints watcher.
   */
  async reload(a = {}) {
    const p = need();
    await p.reload({ timeout: a.timeout || 60000 });
    await p.waitForLoadState();
    return { ok: true, url: p.url() };
  },

  /** Close and relaunch against the same data dir - for persistence / cold-start checks. */
  async relaunch(a = {}) {
    const keep = dataPath;
    // Carrying the profile over matters: relaunching a real profile under
    // `mock` would inject the fake INSOMNIA_SESSION into its data dir and
    // overwrite the real login.
    const keepProfile = currentProfile;
    await OPS.quit();
    return OPS.launch({ profile: keepProfile, ...a, dataPath: keep, fresh: false });
  },

  async status() {
    return {
      launched: !!app,
      repo: REPO,
      profile: currentProfile,
      dataPath,
      url: page ? page.url() : null,
      windows: app ? app.windows().map(w => w.url()) : [],
      pageErrors: pageErrors.length,
      shotDir: SHOT_DIR,
    };
  },

  /**
   * ARIA snapshot of the UI as YAML - the cheap way to "see" the screen.
   * Prefer this over screenshots when deciding what to click next.
   */
  async snapshot(a = {}) {
    const yaml = await locate(a.target, need()).ariaSnapshot({ timeout: a.timeout || 10000 });
    return { snapshot: yaml };
  },

  async screenshot(a = {}) {
    const p = need();
    const file = path.join(SHOT_DIR, (a.name || 'shot-' + Date.now()) + '.png');
    if (a.target) {
      await locate(a.target, p).screenshot({ path: file });
    } else {
      await p.screenshot({ path: file, fullPage: !!a.fullPage });
    }
    return { path: file };
  },

  async click(a) {
    await locate(a.target, need()).click({
      timeout: a.timeout || 10000,
      force: !!a.force,
      button: a.button || 'left',
      clickCount: a.clickCount || 1,
    });
    return { ok: true };
  },

  async hover(a) {
    await locate(a.target, need()).hover({ timeout: a.timeout || 10000 });
    return { ok: true };
  },

  async fill(a) {
    await locate(a.target, need()).fill(String(a.value), { timeout: a.timeout || 10000 });
    return { ok: true };
  },

  /** For CodeMirror / contentEditable inputs that `fill` cannot drive. */
  async type(a) {
    const p = need();
    if (a.target) {
      await locate(a.target, p).click({ timeout: a.timeout || 10000 });
    }
    await p.keyboard.type(String(a.text), { delay: a.delay === undefined ? 20 : a.delay });
    return { ok: true };
  },

  async press(a) {
    const p = need();
    if (a.target) {
      await locate(a.target, p).press(a.key, { timeout: a.timeout || 10000 });
    } else {
      await p.keyboard.press(a.key);
    }
    return { ok: true };
  },

  async text(a = {}) {
    const loc = locate(a.target, need());
    const n = await loc.count();
    if (n === 0) {
      return { count: 0, text: null };
    }
    return { count: n, text: await loc.first().innerText({ timeout: a.timeout || 10000 }) };
  },

  async count(a) {
    return { count: await locate(a.target, need()).count() };
  },

  /** Wait for a target to reach a state: visible (default) | hidden | attached | detached. */
  async wait(a) {
    await locate(a.target, need()).waitFor({ state: a.state || 'visible', timeout: a.timeout || 15000 });
    return { ok: true };
  },

  async sleep(a = {}) {
    await new Promise(r => setTimeout(r, a.ms === undefined ? 500 : a.ms));
    return { ok: true };
  },

  /** Evaluate an expression in the renderer. */
  async eval(a) {
    const body = a.expr.includes('return') ? a.expr : 'return (' + a.expr + ')';
    return { result: await need().evaluate('(() => { ' + body + ' })()') };
  },

  /**
   * Evaluate in the Electron main process.
   *
   * `expr` must be a **function expression** taking the electron module - it is
   * called as `(<expr>)(electron)`. There is no `require` in there, and a bare
   * statement block is a syntax error; both are easy to trip over, so they get
   * explicit errors below.
   *
   *   mainEval '{"expr":"({ app }) => app.getPath(\'userData\')"}'
   *   mainEval '{"expr":"async ({ session }) => (await session.defaultSession.getCacheSize())"}'
   */
  async mainEval(a) {
    if (!app) {
      throw new Error('not launched');
    }
    const expr = String(a.expr || '').trim();
    if (!/^(async\s*)?(\(|function\b)/.test(expr) && !expr.includes('=>')) {
      throw new Error(
        'mainEval takes a function expression, not statements. Got: ' + expr.slice(0, 60) + '\n' +
          'Use e.g. ({ app, session }) => app.getPath("userData")  - the electron module is the argument.',
      );
    }
    let fn;
    try {
      fn = new Function('electron', 'return (' + expr + ')(electron)');
    } catch (e) {
      throw new SyntaxError(
        'mainEval could not compile the expression (' + e.message + '). It must be a single function ' +
          'expression, e.g. ({ app }) => app.getVersion()',
      );
    }
    try {
      return { result: await app.evaluate(fn) };
    } catch (e) {
      if (/require is not defined/.test(e.message)) {
        throw new Error(
          'No `require` in the main-process evaluation context. Electron is handed to your function as ' +
            'its argument instead: ({ session, app, BrowserWindow }) => ... . Node builtins are not ' +
            'reachable from here; use `exec` with a script if you need them.',
        );
      }
      throw e;
    }
  },

  /**
   * Record Insomnia's outbound HTTP, and optionally slow it down.
   *
   * Why not `page.route` / `page.on('request')`: Insomnia takes over the http
   * and https schemes itself (main/api.protocol.ts:139,160) and re-issues every
   * request from the main process with `net.fetch`. The renderer request the
   * page sees is a stub that never reaches the network, which is why renderer
   * interception records traffic only intermittently and why delays injected
   * with `route.continue()`, `session.enableNetworkEmulation()` or CDP
   * `Network.emulateNetworkConditions` have no measurable effect. All three
   * were tried and measured; see scripts/probe-throttle.ts.
   *
   * `session.defaultSession.webRequest` is the layer that does see it, so both
   * recording and throttling live here, behind ONE set of listeners - Electron
   * allows a single listener per event per session, so separate installs would
   * silently clobber each other.
   *
   * Each logical API call appears TWICE: once as the renderer's original
   * (resourceType `xhr`) and once as main's re-issue (`other`). That is the
   * interception, not a retry.
   *
   * Neither op sees requests the *user* sends from the app - those go through
   * node-libcurl, outside Chromium. Use the echo server log or `db` for those.
   */
  async netlog(a = {}) {
    await ensureNetHooks();
    const action = a.action || 'start';

    if (action === 'start') {
      await app.evaluate(
        (_electron, opts) => {
          const n = globalThis.__driverNet;
          n.recording = true;
          n.pattern = opts.pattern;
          n.all = opts.all;
          n.log = [];
          n.seq = 0;
        },
        { pattern: a.pattern || null, all: !!a.all },
      );
      return {
        recording: true,
        pattern: a.pattern || '(all http/https)',
        hint: 'reproduce the flow, then netlog {"action":"read"}',
      };
    }

    if (action === 'stop') {
      await app.evaluate(() => {
        globalThis.__driverNet.recording = false;
      });
      return { recording: false };
    }

    if (action === 'clear') {
      await app.evaluate(() => {
        globalThis.__driverNet.log = [];
      });
      return { cleared: true };
    }

    if (action === 'read') {
      const state = await app.evaluate(() => ({
        recording: globalThis.__driverNet.recording,
        log: globalThis.__driverNet.log,
      }));
      if (!state.recording && state.log.length === 0) {
        throw new Error('netlog is not recording - run netlog {"action":"start"} before the flow you want to capture');
      }
      const matched = a.pattern ? state.log.filter(r => r.url.includes(a.pattern)) : state.log;
      return { total: state.log.length, matched: matched.length, requests: matched.slice(-(a.limit || 50)) };
    }

    throw new Error('netlog action must be start | read | stop | clear, got "' + action + '"');
  },

  /**
   * Add latency to make a timing-dependent race reproducible, by holding the
   * webRequest callback before the request goes out. See `netlog` for why the
   * obvious APIs (enableNetworkEmulation, CDP, route.continue) do nothing here.
   *
   *   throttle '{"latency":1500}'                    every http(s) request
   *   throttle '{"latency":1500,"pattern":"konghq"}' only matching URLs
   *   throttle '{"off":true}'                        back to normal
   *
   * NOTE: the delay lands on each webRequest event, and an Insomnia API call
   * produces two of them (see `netlog`), so end-to-end latency is roughly
   * double what you ask for. Dial it in against a `netlog` reading rather than
   * assuming the number.
   */
  async throttle(a = {}) {
    await ensureNetHooks();
    const latency = a.off ? 0 : a.latency || 0;
    const pattern = a.off ? null : a.pattern || null;
    await app.evaluate(
      (_electron, opts) => {
        const n = globalThis.__driverNet;
        n.latencyMs = opts.latency;
        n.latencyPattern = opts.pattern;
      },
      { latency, pattern },
    );
    return latency > 0
      ? { throttling: true, latencyPerEvent: latency, pattern: pattern || '(all http/https)' }
      : { throttling: false };
  },


  /**
   * Narrate a step on top of the running app, for a human watching the window.
   *
   * Driving the UI at machine speed is unreadable - a viewer sees things happen
   * with no idea what or why. This paints a caption bar and rings the element
   * that is about to be used, so the explanation sits next to the thing it
   * describes instead of in a terminal the viewer isn't looking at.
   *
   * Returns immediately; it does NOT wait for the viewer. The pause has to be a
   * conversation turn, otherwise the driver is blocked and can't answer
   * questions mid-demo.
   *
   *   demo '{"text":"Open the environment editor","step":2,"of":6,
   *          "target":{"role":"button","name":"Manage Environments"}}'
   *   demo '{"clear":true}'
   *
   * `position: "top"` moves the caption off Insomnia's own status bar, for when
   * the status bar is the thing being demonstrated.
   */
  async demo(a = {}) {
    const p = need();
    if (a.clear) {
      await p.evaluate(() => document.getElementById('__insomnia_driver_demo__')?.remove());
      return { cleared: true };
    }
    if (!a.text) {
      throw new Error('demo needs `text` (what this step does and why), or {"clear":true}');
    }

    // Measure in Node and draw by coordinates, rather than styling the app's own
    // element: no mutation of the UI under test, and it works for anything the
    // target resolver can find.
    let box = null;
    if (a.target) {
      try {
        box = await locate(a.target, p).first().boundingBox({ timeout: a.timeout || 5000 });
      } catch (e) {
        // Degrading to a caption-only step hides a typo'd target until someone
        // notices the missing ring mid-demo, so say so unless asked not to.
        if (a.requireTarget !== false) {
          throw new Error(
            'demo could not resolve its highlight target (' + e.message.split('\n')[0] + '). ' +
              'Fix the target, or pass {"requireTarget":false} if this step intentionally narrates ' +
              'something not yet on screen.',
          );
        }
      }
    }

    await p.evaluate(
      ({ text, step, of, box: b, note, position }) => {
        const ID = '__insomnia_driver_demo__';
        document.getElementById(ID)?.remove();
        const root = document.createElement('div');
        root.id = ID;
        root.style.cssText =
          'position:fixed;inset:0;z-index:2147483647;pointer-events:none;font-family:system-ui,sans-serif';

        if (b) {
          const ring = document.createElement('div');
          ring.style.cssText =
            'position:fixed;border:3px solid #ff4d6d;border-radius:6px;box-shadow:0 0 0 4px rgba(255,77,109,.28);' +
            'transition:all .25s ease;' +
            `left:${b.x - 4}px;top:${b.y - 4}px;width:${b.width + 8}px;height:${b.height + 8}px`;
          root.appendChild(ring);
        }

        const bar = document.createElement('div');
        const atTop = position === 'top';
        bar.style.cssText =
          'position:fixed;left:0;right:0;padding:14px 20px;background:rgba(17,17,24,.94);' +
          'color:#fff;font-size:15px;line-height:1.5;display:flex;gap:14px;align-items:baseline;' +
          (atTop ? 'top:0;border-bottom:3px solid #ff4d6d' : 'bottom:0;border-top:3px solid #ff4d6d');
        if (step) {
          const badge = document.createElement('span');
          badge.textContent = of ? `${step} / ${of}` : String(step);
          badge.style.cssText =
            'flex:none;background:#ff4d6d;color:#fff;border-radius:999px;padding:2px 12px;font-size:13px;font-weight:600';
          bar.appendChild(badge);
        }
        const body = document.createElement('div');
        body.textContent = text;
        bar.appendChild(body);
        if (note) {
          const hint = document.createElement('div');
          hint.textContent = note;
          hint.style.cssText = 'margin-left:auto;flex:none;opacity:.6;font-size:13px';
          bar.appendChild(hint);
        }
        root.appendChild(bar);
        document.body.appendChild(root);
      },
      { text: a.text, step: a.step, of: a.of, box, note: a.note, position: a.position || 'bottom' },
    );

    if (a.hold) {
      await new Promise(r => setTimeout(r, a.hold));
    }
    return { shown: true, highlighted: !!box };
  },

  /** Put text on the clipboard - backs the import-from-clipboard path. */
  async setClipboard(a) {
    if (!app) {
      throw new Error('not launched');
    }
    await app.evaluate(({ clipboard }, t) => clipboard.writeText(t), String(a.text));
    return { ok: true };
  },

  /** Import a fixture from packages/insomnia-smoke-test/fixtures through the real import UI. */
  async importFixture(a) {
    const p = need();
    await OPS.setClipboard({ text: fs.readFileSync(path.join(FIXTURES, a.file), 'utf8') });
    await p.getByLabel('Import').click({ timeout: 15000 });
    await p.locator('[data-test-id="import-from-clipboard"]').click();
    await p.getByRole('button', { name: 'Scan' }).click();
    await p.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
    await p.getByRole('dialog').waitFor({ state: 'hidden' });
    await p
      .getByTestId('workspace-breadcrumb-level-0')
      .waitFor({ state: 'visible', timeout: 5000 })
      .catch(() => {});
    return { ok: true };
  },

  /** Renderer console messages captured since launch. */
  async logs(a = {}) {
    const items = a.type ? consoleLog.filter(l => l.type === a.type) : consoleLog;
    return { logs: items.slice(-(a.limit || 50)) };
  },

  async errors() {
    return { errors: pageErrors };
  },

  /** Read a NeDB collection out of the live data dir - verify what the UI actually persisted. */
  async db(a) {
    if (!dataPath) {
      throw new Error('not launched');
    }
    const file = path.join(dataPath, 'insomnia.' + a.type + '.db');
    if (!fs.existsSync(file)) {
      return { docs: [], missing: file };
    }
    const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
    // NeDB appends; a later line supersedes an earlier one with the same _id.
    const byId = new Map();
    for (const d of lines) {
      if (d.$$deleted) {
        byId.delete(d._id);
      } else {
        byId.set(d._id, { ...byId.get(d._id), ...d });
      }
    }
    let out = [...byId.values()];
    if (a.where) {
      out = out.filter(d => Object.entries(a.where).every(([k, v]) => d[k] === v));
    }
    if (a.fields) {
      out = out.map(d => Object.fromEntries(a.fields.map(f => [f, d[f]])));
    }
    return { count: out.length, docs: out.slice(0, a.limit || 50) };
  },

  /**
   * Escape hatch: run arbitrary Playwright code against the live app, so the
   * whole Playwright API is reachable - not just the ops in this file.
   *
   *   { file: 'path/to/script.ts' }   preferred. Zero shell/JSON escaping, and a
   *                                   .ts script can import the repo's Page Objects.
   *                                   Must `export default async ctx => { ... }`.
   *   { code: 'await page.click(...)' }  one-liners. Body of an async function;
   *                                   the context is pre-destructured into scope.
   *
   * ctx = { page, app, expect, ops, locate, log, dataPath, REPO, APP_CWD, FIXTURES }
   * `log(...)` collects values into the response; the return value comes back as
   * `result` when it is JSON-serialisable, else as its string form.
   */
  async exec(a = {}) {
    need();
    const logs = [];
    const ctx = {
      page,
      app,
      expect,
      ops: OPS,
      locate: t => locate(t, page),
      log: (...xs) => logs.push(xs.map(x => (typeof x === 'string' ? x : JSON.stringify(serialise(x)))).join(' ')),
      dataPath,
      REPO,
      APP_CWD,
      FIXTURES,
    };

    let fn;
    if (a.file) {
      fn = await loadExecScript(a.file);
    } else if (a.code) {
      const preamble = 'const { ' + Object.keys(ctx).join(', ') + ' } = ctx;\n';
      fn = new AsyncFunction('ctx', preamble + a.code);
    } else {
      throw new Error('exec needs `file` or `code`');
    }

    try {
      return { logs, result: serialise(await fn(ctx)) };
    } catch (e) {
      // Attach the logs so a failing script still reports how far it got.
      e.execLogs = logs;
      throw e;
    }
  },

  /**
   * Leave a remark for whoever maintains this driver. Use it the moment the
   * driver costs you time: a missing op, a selector that needed three tries, a
   * gotcha the SKILL.md should have warned about. Failures are logged on their
   * own; this is for the part only you know - what you were *trying* to do.
   */
  async note(a) {
    if (!a.text) {
      throw new Error('note needs `text`');
    }
    appendFeedback({ kind: 'note', text: String(a.text), ...(a.op ? { op: a.op } : {}) });
    return { logged: true, file: FEEDBACK_LOG };
  },

  /** Read the friction log back: recent entries plus a rollup of repeat offenders. */
  async feedback(a = {}) {
    if (!fs.existsSync(FEEDBACK_LOG)) {
      return { entries: [], topErrors: [], file: FEEDBACK_LOG };
    }
    let entries = fs
      .readFileSync(FEEDBACK_LOG, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map(l => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    if (a.since) {
      entries = entries.filter(e => e.ts >= a.since);
    }
    if (a.kind) {
      entries = entries.filter(e => e.kind === a.kind);
    }

    const counts = new Map();
    for (const e of entries) {
      if (e.kind !== 'error') {
        continue;
      }
      const key = e.op + ': ' + e.error;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const topErrors = [...counts.entries()]
      .sort((x, y) => y[1] - x[1])
      .slice(0, 10)
      .map(([what, count]) => ({ count, what }));

    return {
      file: FEEDBACK_LOG,
      total: entries.length,
      notes: entries.filter(e => e.kind === 'note').length,
      topErrors,
      entries: entries.slice(-(a.limit || 30)),
    };
  },

  async help() {
    return { ops: Object.keys(OPS) };
  },
};

// ---------------------------------------------------------------------------
// HTTP control channel
// ---------------------------------------------------------------------------

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => (body += c));
  req.on('end', async () => {
    let payload = {};
    try {
      payload = body ? JSON.parse(body) : {};
    } catch {
      payload = {};
    }
    const op = (req.url || '').replace(/^\//, '').split('?')[0];
    const fn = OPS[op];
    res.setHeader('content-type', 'application/json');
    if (!fn) {
      res.statusCode = 404;
      res.end(JSON.stringify({ ok: false, error: 'unknown op "' + op + '"', ops: Object.keys(OPS) }));
      return;
    }
    try {
      const result = await fn(payload);
      res.end(JSON.stringify({ ok: true, ...result }));
    } catch (e) {
      if (!NOT_FRICTION.has(op) && !payload.quiet) {
        // An error signature alone can't be triaged later - "click timed out" is
        // equally a bad selector and an app that never got to that screen. Grab
        // what was on screen, best-effort and time-boxed.
        appendFeedback({
          kind: 'error',
          op,
          args: payload,
          error: errorSignature(e.message),
          ...(await captureContext()),
        });
      }
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          ok: false,
          error: e.message,
          ...(e.execLogs ? { logs: e.execLogs } : {}),
          stack: String(e.stack || '').split('\n').slice(0, 8).join('\n'),
        }),
      );
    }
  });
});

// One driver owns the port, and there is usually one already running in the
// worktree where this tooling is maintained. Say so plainly - the bare
// EADDRINUSE stack is the first thing a new session trips over.
server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      'Port ' + PORT + ' is already taken - a driver is running, most likely for another worktree.\n' +
        'Either reuse it (run drive.mjs and check its `repo`), or start this one on its own port:\n' +
        '  DRIVER_PORT=9801 node ' + path.join(HERE, 'driver.mjs') + '\n' +
        'and pass DRIVER_PORT=9801 to drive.mjs too. A second concurrent app also needs its own\n' +
        'dataPath, because Electron\'s single-instance lock is keyed on it.',
    );
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('[driver] listening on http://127.0.0.1:' + PORT);
  console.log('[driver] repo=' + REPO);
  console.log('[driver] shots=' + SHOT_DIR);
});

process.on('SIGINT', async () => {
  await OPS.quit();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await OPS.quit();
  process.exit(0);
});
