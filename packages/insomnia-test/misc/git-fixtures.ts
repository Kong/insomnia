// The most recently created repo (set by the `gitRepo` fixture), used as
// the default for getServerBranches()/getServerCommits() so specs don't
// have to thread it through explicitly. Safe as module state since
// playwright.config.ts enforces a single worker (and throws on --workers=N).

// Shared custom credential used to authenticate against misc/git-server.ts,
// whose default Basic auth is testuser/testpass. `name` is the app's own
// hardcoded display name for any custom (username/PAT) credential (see
// git-custom-credential-form.tsx) — it isn't something we choose, so unlike
// other names in these tests it can't be faker-generated.

export { DEFAULT_TIMEOUT } from "./fixtures";
