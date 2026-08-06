# Plan: Move Konnect Projects into a Global Local Organization ("Control Planes")

## Background & Goal

Today the Konnect PAT is stored globally (Electron `safeStorage`, key `konnectPat`), but the
Konnect projects it produces are created with `parentId: organizationId` — i.e. they belong to a
specific organization. As a result the same PAT can be synced independently under several
organizations, which is semantically wrong.

Goal: introduce a hardcoded local-only organization `org_konnect_${accountId}` (display name
"Control Planes"), move all Konnect projects under it, and remove the Projects/Konnect tab split
from the project navigation sidebar.

## Feasibility Assessment

The approach mirrors the existing Scratchpad "fake local organization" pattern and is sound.
The main risk: roughly half of the organization-scoped remote API calls are **not** guarded for
Scratchpad today (check-seats, collaborators, user-permissions, presence, event stream,
`PATCH /organizations/:id`). Scratchpad gets away with it because its entry point is hidden.
Control Planes will be reachable from the organization dropdown, so every one of these needs an
explicit guard.

## Confirmed Decisions

1. **konnectSync flag aggregation** — on startup, fetch features for all organizations
   concurrently, OR the results, cache in localStorage. (99% of users have a single organization.)
2. **Migration trigger** — runs in `entry.client.tsx` **before the router hydrates**, so every
   loader and component downstream can assume Konnect data already lives under the Konnect
   organization. A modal is shown only when the user must choose between organizations.
3. **Orphaned Konnect projects** (parentId not in the current account's organization list) —
   ignored entirely: neither migrated nor deleted.
4. **Control Planes visibility** — shown if any organization has `konnectSync = true`; also shown
   when all are false but the local database already contains Konnect projects **belonging to the
   current account**, i.e. parented to `getKonnectOrganizationId(accountId)` (see step 6). In that
   case the Sync button is disabled.
5. **Capabilities hidden inside Control Planes** — New Project button, invites/collaborators/
   presence, Cloud Sync / Git Sync. The project context menu and Command Palette behaviour stay
   as-is. `HeaderPlanIndicator` **stays visible**: per
   `docs/header-plan-indicator-data-scope.md` every value it shows (`currentPlan`, resource usage,
   license usage, trial eligibility) is account-scoped and fetched with `sessionId` only — it never
   takes an `organizationId`, so hiding it would just make billing info disappear for no reason.
6. **Conflict-case data** — Konnect projects under the organizations the user did _not_ pick are
   **deleted**, cascading to their workspaces / requests / environments / cookie jars. Leaving them
   would leak them into that organization's regular project list now that the tab is gone.
7. **Multiple accounts sharing one data directory** — do nothing. Each account gets its own
   `org_konnect_${accountId}` data set; no cross-account cleanup for now.
8. **No Settings "Konnect" panel** in this change — the PAT is still configured only from the gear
   icon inside Control Planes. But the sync trigger **is** moved out of the sidebar, so a second
   entry point can be added later without rework.
9. **The latent buffering bug in `konnect-settings-modal.tsx`'s disconnect flow is not fixed here** —
   only documented (see the Phase 4 note). New code must not repeat the pattern.
10. **`konnect-last-synced-at` is carried over** from the chosen organization's key to the Konnect
    organization key during migration, so the tooltip does not regress to "Not yet synced". The key
    is then removed for **every** source organization the migration touched, not just the chosen
    one — after the move nothing reads `${realOrganizationId}:konnect-last-synced-at` again.
    Orphan organizations (decision 3) keep theirs, matching how their data is left alone.

## Existing Implementation Reference

- `SCRATCHPAD_ORGANIZATION_ID` / `isScratchpadOrganizationId` —
  `packages/insomnia-data/src/models/organization.ts`
- Organization list cache — localStorage `${accountId}:spaces`, written by `syncOrganizations()`
  in `packages/insomnia/src/ui/organization-utils.ts`
- Organization route loader — `packages/insomnia/src/routes/organization.tsx`
- Features loader — `packages/insomnia/src/routes/organization.$organizationId.permissions.tsx`
  (Scratchpad short-circuits to `fallbackFeatures`; unknown organizations hit
  `throw redirect('/organization')`)
- Storage rules — `packages/insomnia/src/common/organization-storage-rules.ts`
- Sidebar tabs — `ProjectNavigationSidebarTabId` in
  `packages/insomnia/src/ui/components/sidebar/project-navigation-sidebar/project-navigation-sidebar.tsx`;
  parent owns `${organizationId}:sidebar-tab` in
  `packages/insomnia/src/routes/organization.$organizationId.project.$projectId.tsx`
- Migration precedent — `packages/insomnia/src/sync/vcs/migrate-projects-into-organization.ts`,
  invoked via `migrateProjectsUnderOrganization()` from
  `packages/insomnia/src/routes/organization._index.tsx`

## Steps

### Phase 0 — Constants & helpers (blocks everything else)

1. In `packages/insomnia-data/src/models/organization.ts` add:
   - `KONNECT_ORGANIZATION_ID_PREFIX = 'org_konnect_'`
   - `KONNECT_ORGANIZATION_NAME = 'Control Planes'`
   - `getKonnectOrganizationId(accountId)`
   - `isKonnectOrganizationId(id)`
   - `isLocalOrganizationId(id)` (scratchpad || konnect) — the single predicate every
     "skip all remote APIs" branch should use.
2. Add `buildKonnectOrganization(accountId): Organization` that constructs the fake
   organization object for rendering in `OrganizationSelect`. `is_owner` is hardcoded to `true`:
   the backend guarantees every account owns at least one organization, so the value is constant
   in practice — see step 18.

### Phase 1 — Aggregated konnectSync flag (_can run in parallel with early Phase 2_)

> **Revised:** do NOT put this inside `syncOrganizations()`. That function has three entry points,
> one of which (`organization.sync.tsx`) is driven by the `OrganizationChanged` SSE event from the
> event stream — fired on renames, membership changes and plan changes, and received by every open
> window. Binding N feature requests to it is wrong for a slow-changing permission bit.
>
> **Revised again — the `AsyncTask` / `asyncTaskList` pipeline is dead code.** `getInitialEntry()`
> returns either a string or `{ pathname, state }`, but its only caller (`entry.client.tsx`) handles
> the string case exclusively:
>
> ```ts
> if (typeof initialEntry === 'string' && window.location.pathname !== initialEntry) { … }
> ```
>
> The object branch is silently dropped, so `location.state.asyncTaskList` is never populated, the
> `useEffect` in `organization.tsx` never fires, and the
> `organization.sync-organizations-and-projects` action never runs. Do not hang anything new off it.
>
> The path that actually executes on a cold start is:
> `entry.client.tsx` (no-op) → pathname stays `/` → `routes/_index.tsx` → `redirect('/organization')`
> → `organization._index.tsx` `clientLoader`. Nothing in this change depends on that route being the
> landing point though — the migration runs before hydration (step 32) and the flag sync runs in the
> `/organization/**` layout loader (step 4), so both survive a future change of startup destination.

3. Add a **standalone** `syncKonnectSyncEnabled(sessionId, accountId, { force })` to
   `packages/insomnia/src/ui/organization-utils.ts`:
   - `Promise.allSettled` over `getOrganizationFeatures({ organizationId, sessionId })` for every
     organization, OR the `konnectSync.enabled` values.
   - Cache to localStorage `${accountId}:konnectSyncEnabled = { enabled, checkedAt }`.
   - Self-deduplicating via a TTL (6h); `force` bypasses it.
   - Treat failures as false but never overwrite an existing cached `true` (offline resilience).
4. Call site — `packages/insomnia/src/routes/organization.tsx` `clientLoader`, **awaited immediately
   before reading the cache** in `getKonnectOrganization()`.
   Two reasons for this placement rather than a startup route loader:
   - **Ordering.** The writer (`syncKonnectSyncEnabled`) and the reader (`getKonnectSyncEnabled`)
     must not sit in two concurrently-running loaders — the reader would silently see the previous
     session's value and simply hide the organization for one render, with no error anywhere. Having
     the consumer await its own precondition removes the cross-file ordering assumption entirely.
   - **Reliability.** `organization.tsx` is the layout route for every `/organization/**` path, so it
     runs whether the app opens on `/organization`, on `/organization/:id`, or deep-links straight
     into a workspace. A route that only matches one exact path would silently stop firing if the
     startup destination ever changed.

   The TTL makes this a no-op on all but the first load of a session, and on that first load the
   sibling `organization._index.tsx` loader is already blocking on `syncOrganizations`'s network
   calls in parallel, so the added wall-clock cost is effectively zero.
   - `packages/insomnia/src/routes/organization.sync.tsx` (SSE path): do **not** call it; the TTL
     covers long-running sessions.
   - `packages/insomnia/src/routes/organization.$organizationId.permissions.tsx`: merge the
     **current** organization's features result back into the cache so its flag is always fresh.
   - Do **not** add an `AsyncTask` entry — see the note above.

5. Add a `getKonnectSyncEnabled(accountId)` helper for reading the cache. It must only ever be
   called after `syncKonnectSyncEnabled` has been awaited in the same loader.
6. Visibility condition = `konnectSyncEnabled || hasLocalKonnectProjects`, computed in the
   `organization.tsx` `clientLoader`.
   Because the migration completes before hydration (step 32), this can simply count projects
   parented to the Konnect organization:

   ```
   services.project.count({
     konnectControlPlaneId: { $exists: true, $ne: null },
     parentId: getKonnectOrganizationId(accountId),
   })
   ```

   - **`$ne: null` alone is not enough.** `konnectControlPlaneId` is in `project.optionalKeys` and is
     not set by `project.init()`, so a regular project has no such field at all — and NeDB's `$ne`
     matches documents where the field is absent (verified: a query for `{ $ne: null }` returns both
     a plain project and a Konnect one; `{ $exists: true, $ne: null }` returns only the Konnect one).
     The pre-existing `konnect/sync.ts` compensates for this with a redundant
     `.filter(p => p.konnectControlPlaneId != null)` after the query.
   - Scoping by that parent also keeps another account's Konnect data (decision 3 orphans) out of
     the count — the NeDB database is not partitioned per user.
   - In the unresolved-conflict case nothing has been migrated yet, so the count is 0 and the
     organization stays hidden until the user answers the modal, at which point the migration runs
     and triggers a revalidation.

7. Sync button `isDisabled = !konnectSyncEnabled`, with a tooltip explaining why.

### Phase 2 — Fake organization injection + route/API guards (_depends on Phase 0/1_)

> **Key rule discovered during audit — two classes of `${accountId}:spaces` readers:**
> (a) readers going through `useOrganizationLoaderData()` get the injected fake org for free
> (`use-plan.tsx`, `invite-form.tsx`, `invite-modal.tsx`, `project-type-warning.tsx`,
> `input-vault-key-modal.tsx`, `import-export.tsx`, `project.$projectId._index.tsx`);
> (b) loaders and hooks that read `localStorage` **directly** never see it and must be fixed one by
> one — `organization.$organizationId.permissions.tsx`, `untracked-projects.tsx`,
> `git-credentials.$id.related-projects.tsx`, `use-command-search.ts`,
> `insomnia-event-stream-context.tsx`.
> Do not assume injection in `organization.tsx` is enough.

#### Why the Konnect organization is not written into `${accountId}:spaces`

The obvious alternative to injecting the fake organization at each reader is to persist it in the
cache, so every reader sees it for free. That was evaluated and rejected. `${accountId}:spaces` has
exactly one writer — `syncOrganizations()` in `organization-utils.ts`, which does a straight
`setItem(JSON.stringify(await services.organization.list()))` — so "write it at the source" means
teaching `syncOrganizations` to append a synthesized entry. Four things break:

1. **`findMigrationTargetSpaceId` would select it.** It picks `o.is_owner && o.total_members === 1`,
   and the fake organization is exactly that. Legacy `parentId: null` projects would be migrated
   into Control Planes by `migrateProjectsUnderOrganization`.
2. **`organizations[0]` is the landing organization** in both `organization._index.tsx` and
   `getInitialEntry()`. Prepending makes Control Planes everyone's startup destination; appending
   puts it last in the dropdown.
3. **Circular dependency.** `syncKonnectSyncEnabled` iterates `${accountId}:spaces` calling
   `getOrganizationFeatures` per organization, so the fake id would produce a doomed request on
   every refresh — while that same flag is what decides whether the entry should exist at all.
4. **The migration would never converge.** `detectKonnectOrgMigration` uses "parentId is in
   `${accountId}:spaces`" as its definition of a migratable project. With the Konnect organization
   in that list, already-migrated projects look migratable forever.

Two further reasons that are not bugs but matter:

- **Staleness.** Visibility is `konnectSyncEnabled || hasLocalKonnectProjects`. Computed in
  `organization.tsx`'s loader it is re-evaluated on every run, so disconnecting the PAT makes the
  organization disappear immediately (verification 17). Baked into the cache it would survive until
  the next `syncOrganizations`, and `syncOrganizations` would have to await
  `syncKonnectSyncEnabled` plus a NeDB count — re-introducing the coupling Phase 1 rejected, on a
  function whose third call site is driven by the `OrganizationChanged` SSE event.
- **Cache semantics.** `${accountId}:spaces` is a verbatim mirror of `GET /organizations`. Storing a
  synthesized entry breaks that contract for anything comparing cache against server truth.

The cost of the chosen approach is that every class-(b) reader has to be handled explicitly, and
missing one is silent. Two were missed in the first pass and are fixed here:
`use-command-search.ts` (Konnect projects were unreachable from the command palette, contradicting
decision 5) and the `VaultKeyChanged` branch of `insomnia-event-stream-context.tsx` (Konnect
workspaces' secrets survived a vault-key reset performed on another device). A shared
`getVisibleOrganizations()` helper was considered to remove the duplication but deliberately not
added: the explicit call sites are what keep the three readers that must see **only** server truth
(`syncKonnectSyncEnabled`, `findMigrationTargetSpaceId`, `detectKonnectOrgMigration`) distinguishable
from the rest.

#### 2A — Injection & visibility

8. `packages/insomnia/src/routes/organization.tsx` `clientLoader`: when the visibility condition
   holds, prepend `buildKonnectOrganization(accountId)` to `organizations` (it must not
   participate in name sorting), and also return `konnectSyncEnabled`.
9. `packages/insomnia/src/ui/components/project/organization-select.tsx`: render `<KongLogo />` for
   `isKonnectOrganizationId(item.id)` in both the `ListBoxItem` and the trigger `SelectValue`.
   Leave "Join an organization" / "Create an organization" as-is — still valid actions.

#### 2B — Loader / action guards (no doomed network calls)

10. `organization.$organizationId.permissions.tsx`: replace `isScratchpadOrganizationId` with
    `isLocalOrganizationId` and return `fallbackFeatures` / `fallbackBilling`. This **must** return
    before the `organizations.find()` lookup, otherwise the fake org hits
    `throw redirect('/organization')` and the user is bounced out.
    Note: the sidebar's `konnectSyncEnabled` no longer comes from this loader — it reads the
    aggregated cache from Phase 1.
11. `packages/insomnia/src/common/organization-storage-rules.ts`: return hardcoded local-only rules
    for the Konnect organization (`enableCloudSync: false`, `enableLocalVault: true`,
    `enableGitSync: false`, `isOverridden: false`).
12. `syncProjects` in `organization-utils.ts`: bail out for local-only organizations. The guard has to
    sit **before** `getAllTeamProjects()`, not after — the pre-existing scratchpad guard sat after it,
    so the `fetchTeamProjects` request had already gone out by the time it ran.
    `migrateProjectsUnderOrganization` needs no change: it only touches legacy projects with
    `parentId: null`, which Konnect projects never have.
13. **Collaborator / member routes — all currently unguarded**, add `isLocalOrganizationId`
    short-circuits returning empty results:
    - `organization.$organizationId.collaborators.tsx` — `getCollaborators()`
    - `organization.$organizationId.collaborators-search.tsx` — `searchCollaborators()`
    - `organization.$organizationId.collaborators-check-seats.tsx` — `checkSeats()`
    - `organization.$organizationId.collaborators.invites.$invitationId.tsx` — `updateInvitationRole()`
    - `organization.$organizationId.collaborators.invites.$invitationId.reinvite.tsx` — `reinvite()`
    - `organization.$organizationId.members.$userId.roles.tsx` — `updateUserRoles()`
14. **Project mutation routes — unguarded `updateGitProjectCount()` / team-project calls.**
    Rather than wrapping each remote call, block the storage types that reach them, which makes
    every one of those branches unreachable in a local-only organization:
    - `organization.$organizationId.project.new.tsx` — one guard inside `reportGitProjectCount()`
      (its only caller of `updateGitProjectCount()`, and the function all three routes import, so
      this single guard covers `update.tsx` and `delete.tsx` too), plus an `invariant` in
      `createProjectImpl` rejecting any non-`local` `storageType`, which makes `createTeamProject()`
      unreachable.
    - `organization.$organizationId.project.$projectId.update.tsx` — one `invariant` at the top of
      `clientAction` rejecting any non-`local` `storageType`. That alone makes the
      `createTeamProject()` / `updateTeamProject()` / `reportGitProjectCount()` branches
      unreachable; the remaining `deleteTeamProject()` calls are already gated on
      `project.remoteId`, which a local-only organization's projects never have.
    - `organization.$organizationId.project.$projectId.delete.tsx` — **no change needed.**
      `deleteTeamProject()` is gated on `project.remoteId` and `reportGitProjectCount()` on
      `project.gitRepositoryId`, and the latter is guarded internally anyway.

    The New Project button is hidden (step 19), but the project context menu stays (decision 5), so
    guard the actions rather than relying on the entry points.

15. `packages/insomnia/src/ui/context/app/insomnia-event-stream-context.tsx`: guard **both**
    unguarded calls — `getRealTimeCollaborators()` and the
    `new EventSource('insomnia-event-source://v1/teams/<org>/streams')`.
16. Guard the invite surface (`getOrganizationFeatures`, `getOrganizationRoles`,
    `getOrganizationMemberRoles`, `getOrgUserPermissions`, `revokeInvitation`,
    `deleteOrganizationMember`, `unlinkCollaborator`). Since the invite entry point is hidden
    (step 18) this is defence-in-depth.
17. **Existing scratchpad guards on the storage-rules / workspaces fetchers — extend only
    `use-organization-features.tsx`, leave the rest scratchpad-only.** The audit that produced the
    original list was wrong: none of these fetchers issues a request for a local-only organization
    once steps 10/11 are in place, so gating them buys nothing and actively breaks things.
    - `packages/insomnia/src/ui/hooks/use-organization-features.tsx` — **extend.** Skipping the load
      leaves `features`/`billing` at `fallbackFeatures`/`fallbackBilling`, which is byte-for-byte
      what `permissions.tsx` returns for a local organization (step 10), so behaviour is unchanged
      and one route invocation is saved.
    - The four storage-rule fetchers — **do not extend** (`project._index.tsx`,
      `project.$projectId._index.tsx`, `workspace.$workspaceId.spec.tsx`,
      `git-project-sync-dropdown.tsx`; `project.$projectId.tsx` only reads the shared
      `storage-rule:${organizationId}` key and never loads). `fetchAndCacheOrganizationStorageRule`
      already short-circuits locally per step 11, so the load costs nothing — whereas skipping it
      leaves `storageRules` at `DEFAULT_STORAGE_RULES` (`enableCloudSync: true`,
      `enableGitSync: true`), the exact opposite of the local-only rules step 11 installs, and
      Cloud Sync / Git Sync would surface inside Control Planes.
    - `request-settings-modal.tsx` and `import-export.tsx` — **do not extend.** Both use
      `useProjectListWorkspacesLoaderFetcher`, whose loader is pure NeDB (no network at all).
      Skipping it empties "Move/Copy to Workspace" in the request settings modal and breaks
      Settings → Data (`workspacesForActiveProject`, `activeProject`, `projects` all empty, so
      project export produces nothing and the import buttons disappear).
      The scratchpad guard exists there only because scratchpad has a single project and workspace.

#### 2C — UI gating

18. `packages/insomnia/src/routes/organization.tsx` component layer: hide `HeaderInviteButton` and
    `PresentUsers`; also hide the untracked-data banner. Keep `HeaderPlanIndicator` — it is
    account-scoped (see `docs/header-plan-indicator-data-scope.md`) and its loader
    (`packages/insomnia/src/routes/resource.usage.tsx`) never passes an `organizationId`.
    Related detail: `usePlanData` (`packages/insomnia/src/ui/hooks/use-plan.tsx`) derives
    `isOwner` from `organizations.find(o => o.id === organizationId)?.is_owner`, which reaches
    `UpgradeModal` (the enterprise-gated nunjucks tag menu in the editors) and `UpgradeNotice`
    (Settings → Cloud Credentials). `is_owner` is hardcoded to `true` on the Konnect organization:
    the backend guarantees every account owns at least one organization, so deriving it from the
    real organization list would always yield `true` anyway.
19. Hide `NewProjectButton` in the sidebar for the Konnect organization (detail in step 22), and
    replace the main-pane `NoProjectView` with a read-only explanation. `NoProjectView` renders
    `ProjectCreateForm`, so leaving it in place would hand the user a project-creation form inside
    an organization whose projects come exclusively from sync. The branch lives in the component
    itself rather than at its two call sites (`project._index.tsx`,
    `project.$projectId._index.tsx`), and its wording depends on `settings.hasKonnectPat`:
    "connect a PAT" before one is set, "use the Sync button" after.

#### 2D — Direct-localStorage loaders + routing

20. Add the Konnect organization id to the accepted-org-id lists in the loaders and hooks that read
    localStorage directly:
    - `packages/insomnia/src/routes/untracked-projects.tsx` — otherwise Konnect projects are
      reported as untracked and the migration banner appears.
    - `packages/insomnia/src/routes/git-credentials.$id.related-projects.tsx` — same
      `currentUserOrganizationIds` pattern.
    - `packages/insomnia/src/ui/hooks/use-command-search.ts` — `command-search.ts` scopes its
      project query with `parentId: { $in: allOrganizations.map(o => o.id) }`, so without this the
      command palette cannot reach any Konnect project, collection or request. Append the id and
      `KONNECT_ORGANIZATION_NAME` unconditionally: with no Konnect projects the extra id simply
      matches nothing.
    - `packages/insomnia/src/ui/context/app/insomnia-event-stream-context.tsx`, the
      `VaultKeyChanged` branch — `services.environment.removeAllSecrets()` is scoped by organization
      id, so Konnect workspaces' secret environment variables would survive a vault-key reset
      performed on another device. (The in-app "Reset Vault Key" button in
      `input-vault-key-modal.tsx` is already correct — it is a class-(a) reader.)
21. `packages/insomnia/src/ui/utils/router.ts` `getInitialEntry()`: `lastVisitedOrganizationId` may
    be the Konnect organization, which is absent from `${accountId}:spaces`. The validation must
    additionally accept `isKonnectOrganizationId`, otherwise it falls back to the first real
    organization on every restart.
    Note: this lives inside the object-returning branch, which `entry.client.tsx` currently discards
    (see the Phase 1 note), so it is inert today — `lastVisitedOrganizationId` is otherwise only read
    by `root.tsx`'s deep-link handler. A cold start therefore always lands on `organizations[0]`,
    for every organization, not just Control Planes. The change is kept because it is the correct
    behaviour once that branch is honoured.

#### 2E — Explicitly NOT extended to the Konnect org (audit conclusions)

- `organization.tsx` — `{!isScratchPad && <OrganizationSelect/>}`. **Must stay scratchpad-only.**
  Hiding the dropdown would trap the user inside Control Planes with no way out.
- `insomnia-tab-context.tsx` — "navigate to project dashboard when all tabs close" is skipped for
  scratchpad because it has no dashboard. Control Planes _does_, so keep navigating.
- `root.tsx` deep-link guards — scratchpad is gated there because the user is logged out; Konnect
  users are authenticated, so deep links should behave normally. Verify only.
- `workspace-pane-header.tsx` — breadcrumb slicing is a scratchpad single-project quirk.
- `entry.main.ts` — do **not** mirror the scratchpad "auto-create project/workspace on startup";
  Konnect projects come exclusively from sync.
- `sidebar-workspace-dropdown.tsx` / `workspace-settings-modal.tsx` scratchpad read-only
  restrictions — Konnect workspaces stay normal editable collections; only the delete/remove
  wording differs, which existing `konnectControlPlaneId` checks already handle.
- `import-modal.tsx` multi-file restriction and `import-export.tsx` "hide import tab" — both are
  scratchpad-workspace quirks.
- `project-node.tsx` project context menu — per decision 5, Konnect keeps the current menu.
- `common/sentry.ts` `LandingPage.Scratchpad` — no new Sentry tag needed.

### Phase 3 — Remove the sidebar tabs (_depends on Phase 2_)

22. `project-navigation-sidebar.tsx`:
    - Delete `SideBarTabList`, the `Tabs` wrapper, `ProjectNavigationSidebarTabId`, and the
      `activeTab` / `setActiveTab` props.
    - Replace every `isProjectTabActive` branch with `isKonnectOrganizationId(organizationId)`.
    - `showKonnectSyncIntro` becomes `isKonnectOrganization && !hasKonnectPat`.
    - Drop the `konnectControlPlaneId` filtering in `projectsWithPresence` and the
      `nonKonnectProjects` / `konnectProjects` split.
    - Do not render `NewProjectButton` inside the Konnect organization.
    - Collapse the two filter states (`filterInputValue` / `konnectFilterInputValue`) into one.
23. `EmptyProjectNavigationSidebar`: render `KonnectSyncIntro` when inside the Konnect organization
    without a PAT; render the gear button row when a PAT exists but there are no projects.
    **Known limitation, deliberately not fixed here:** that gear row has no Sync button, so with a
    PAT connected and zero synced projects there is no way to trigger a sync from the sidebar.
    `EmptyProjectNavigationSidebar` exists only because `ProjectNavigationSidebarInner` calls
    `useProjectLoaderData()!`, which is `undefined` on the `project._index` route (no `:projectId`
    match), so the full sidebar cannot render when the organization has no projects. In a real
    organization that state is rare; in Control Planes it is the _initial_ state, which is why the
    gap is visible here. The proper fix is to make the full sidebar tolerate missing loader data
    (`projects = projectLoaderData?.projects ?? []`) and delete this variant, but that touches a
    component every organization renders and is out of scope. `NoProjectView`'s copy therefore says
    "Sync from Konnect" rather than pointing at a button that is not there.
24. `organization.$organizationId.project.$projectId.tsx` — four separate things, not one:
    - **`clientLoader` reads `${organizationId}:sidebar-tab` from localStorage** to decide the
      "project not found" redirect (if the user was on the Konnect tab, redirect to another Konnect
      project). Rewrite to key off the _organization_ instead — fall back to another project in the
      same organization.
    - Remove the `useLocalStorage('${organizationId}:sidebar-tab')` state and the
      `activeSidebarTab = !features.konnectSync.enabled ? 'projects' : …` derivation.
    - Remove `activeTab` / `setActiveTab` from the `<ProjectNavigationSidebar>` props.
    - **Replace `activeSidebarTab` / `setActiveSidebarTab` in `ProjectRouteContextValue` and the
      Outlet context** with `isKonnectOrganization`.
25. **Outlet-context consumer that is easy to miss:**
    `organization.$organizationId.project.$projectId._index.tsx` reads
    `const { activeSidebarTab } = useProjectRouteContext()` and gates `FirstRequestCreation`
    on `activeSidebarTab === 'projects'`. Re-gate on `!isKonnectOrganization`.
26. `use-project-navigation-sidebar-navigation.ts`: delete `setActiveTab` from the hook signature,
    the `setActiveTabRef`, and the auto-switch
    (`resources.project.konnectControlPlaneId != null ? 'konnect' : 'projects'`). The rest of the
    hook (selection, expansion, `scrollToIndex`) is tab-independent and stays.
27. `use-sidebar-drag-and-drop.tsx`: `canDrop` only blocks cross-project moves for **remote**
    projects. Konnect projects are local, so a collection workspace can be dragged between two
    Konnect projects — which would orphan its `konnectServiceId` and make the next sync delete or
    duplicate it. Add an explicit guard rejecting cross-project drops when either side has
    `konnectControlPlaneId`.
28. `use-konnect-sync.ts` call sites: pass the Konnect organization id. `konnect/sync.ts` internals
    are unchanged.
29. `konnect-settings-modal.tsx` / sync orchestration ownership:
    - **Move the sync trigger out of the sidebar** so the modal no longer depends on the sidebar
      being mounted, per decision 8. No Settings panel is added in this change.
    - After disconnecting, if the organization becomes invisible, redirect the current route to the
      first real organization.
30. **Orphaned localStorage keys** — decide explicitly:
    - `${organizationId}:sidebar-tab` — fully dead.
    - `${organizationId}:project-navigation-konnect-filter` — fully dead.
    - `${organizationId}:konnect-last-synced-at` — the value now lives under the Konnect org id;
      per decision 10 the migration copies the chosen organization's value across and then deletes
      the key for every source organization (step 31).
      Keys that stay valid: `${organizationId}:nav-expanded-projects-and-workspaces`,
      `${organizationId}:local-workspace-orders`.

### Phase 4 — One-time migration (_depends on Phase 0; modal depends on Phase 2_)

> **Audit finding — database buffering is NOT re-entrant.**
> `database.bufferChanges()` increments a module-level `bufferChangesId`, and `flushChanges(id)`
> only acts when `bufferChangesId === id`. `db.remove()` internally calls `bufferChanges()` and then
> `flushChanges(itsOwnId)` — so wrapping `services.project.remove()` calls in an outer
> `bufferChangesIndefinitely()` is **ineffective**: the first inner remove flushes the outer buffer
> and clears `bufferingChanges`, and the outer `flushChanges(outerId)` becomes a no-op.
> The existing disconnect flow in `konnect-settings-modal.tsx` has this latent bug.
> Consequence for us: buffering works for the **`update()` (parentId rewrite)** path and should be
> used there; do not pretend it batches the **delete** path.

31. New file `packages/insomnia/src/konnect/migrate-konnect-organization.ts`:
    - `detectKonnectOrgMigration({ accountId })` — list projects with
      `konnectControlPlaneId: { $exists: true, $ne: null }` (see the step 6 note — `$ne: null` on its
      own also matches regular projects, which would get re-parented or **deleted**), group by
      `parentId`, drop those already under the Konnect
      org, drop those whose `parentId` is not in `${accountId}:spaces` (orphans, per decision 3),
      and return `{ status: 'none' | 'auto' | 'conflict', groups }` where each group carries
      `organizationId`, `organizationName`, `projectCount`, `workspaceCount`.
    - `runKonnectOrgMigration({ accountId, keepOrganizationId })` —
      wrap the `parentId` rewrites in `bufferChangesIndefinitely()` / `flushChanges()` in a
      `try/finally`; run the deletions for non-selected groups **outside** that buffer via
      `services.project.remove` (which cascades through `getWithDescendants()` to workspaces,
      requests, environments, cookie jars and meta docs).
    - Take `projectLock` (`~/common/project`, the same lock `syncProjects` uses) around the whole
      operation so it cannot interleave with a concurrent project sync.
    - Copy `${keepOrganizationId}:konnect-last-synced-at` to
      `${getKonnectOrganizationId(accountId)}:konnect-last-synced-at`, then remove the key for every
      source organization in the migrated set (decision 10). The set is derived from the `parentId`s
      captured **before** the re-parent, so orphans are naturally excluded.
    - **Do not add a `${accountId}:konnect-org-migrated` flag.** The repo has no such convention —
      `migrateProjectsUnderOrganization` relies purely on an idempotent detection predicate — and a
      flag would prevent re-prompting after the user dismisses the conflict modal.
32. Trigger point — `packages/insomnia/src/entry.client.tsx`, immediately before `getInitialEntry()`
    and `hydrateRoot()`.
    **The migration must complete before the router hydrates**, so that every loader, component and
    query downstream can assume Konnect projects are already parented to the Konnect organization.
    Placing it in a route loader instead does not work: `organization.tsx` is the parent layout of
    `organization._index.tsx`, so their loaders run **concurrently** — the parent would observe
    pre-migration data and would need a defensive `parentId` allow-list to compensate.
    It sits after the env-var session block (`setSessionData`) because it needs `accountId`, and it
    reads `${accountId}:spaces` from the previous session's cache — which is exactly the population
    that has data to migrate. It is wrapped in `try/catch`: a migration failure must never prevent
    the app from starting.
    `auto` runs immediately; `conflict` migrates nothing and is surfaced later by the modal in
    `organization.tsx`, which re-runs `detectKonnectOrgMigration` after hydration.
33. New component `packages/insomnia/src/ui/components/modals/konnect-org-migration-modal.tsx`:
    single-select list of candidate organizations (name + Konnect project count), explicit warning
    that the non-selected data will be deleted, then calls `runKonnectOrgMigration`.
34. Post-migration route hygiene: `locationHistoryEntry:${organizationId}` may still point at a
    Konnect project that has moved organizations. `getInitialRouteForOrganization()` already
    validates that the project exists and falls back, so this should self-heal — verify rather than
    code around it.

### Phase 5 — Tests & cleanup

35. Smoke tests:
    - `packages/insomnia-smoke-test/tests/smoke/konnect.test.ts` — replace the
      `sidebar-tab-konnect` / `sidebar-tab-projects` clicks with navigating to Control Planes via
      the organization dropdown; replace the "tab hidden when flag off" case with "organization
      absent from the dropdown when flag off".
    - `packages/insomnia-smoke-test/playwright/pages/components/navigation-sidebar.ts` — remove or
      repurpose `clickProjectsTab()` / `clickKonnectTab()`.
    - `packages/insomnia-smoke-test/tests/smoke/disable-git-sync.test.ts` toggles the `konnectSync`
      flag — confirm it still passes now that the flag is aggregated, not per-org.
36. Add `packages/insomnia/src/konnect/__tests__/migrate-konnect-organization.test.ts` covering
    auto / conflict / orphan-ignored / idempotency, plus a case asserting that deleting a
    non-selected group also removes its workspaces and requests, and two cases asserting that
    regular projects (no `konnectControlPlaneId` field) are neither detected nor touched.
    Harness: `packages/insomnia/setup-vitest.ts` already runs
    `initDatabase(mainDatabase, { inMemoryOnly: true }, true)` + `initServices(...)`.
37. Run `npm run lint`, `npm run type-check`, `npm test -w packages/insomnia`.

## Verification

1. Single account, single organization with existing Konnect data → no modal on startup, data
   appears under Control Planes, the original organization's project list is clean.
2. Two organizations each holding Konnect data → modal on startup; after choosing one, the other
   group is deleted; restarting does not prompt again.
3. All organizations report `konnectSync = false` and there is no local data → Control Planes is
   absent from the dropdown.
4. All false but local Konnect data exists → organization is visible, Sync button disabled.
5. Inside Control Planes with DevTools Network open → no `features`, `storage-rule`,
   `team-projects`, `collaborators`, `check-seats`, `presence` or `streams` requests are issued.
   Also confirm the local-only storage rules actually reach the UI (step 17): no Cloud Sync / Git
   Sync options in the project settings form, and no Git sync dropdown.
6. Inside Control Planes: reload the page, enter via deep link, delete the last project → no blank
   screen and no redirect to login. Specifically confirm `permissions.tsx` does not bounce the user
   back to `/organization`.
7. Switch to Control Planes and restart the app → the app opens on `organizations[0]`, **not** on
   Control Planes. This is expected today and is not a regression: `lastVisitedOrganizationId` is
   only consulted in the dead `getInitialEntry()` branch, so no organization is restored on restart.
   What must be verified is that landing elsewhere does not break — Control Planes is still present
   in the dropdown and still reachable.
8. Inside Control Planes the organization dropdown is still rendered and can switch back to a real
   organization (regression guard for step 2E).
9. Inside Control Planes the untracked-projects banner does not appear, and Konnect projects are
   absent from the untracked list.
10. `HeaderPlanIndicator` shows the same plan/usage inside Control Planes as in a real organization.
11. Sign in as account B on the same machine while account A's Konnect data exists → Control Planes
    is not visible to B on the strength of A's data alone.
12. Trigger a project update/delete action inside Control Planes from the project dropdown
    (`sidebar-project-dropdown.tsx`) → no `team-projects` or `PATCH /organizations/:id` request is
    issued.
13. Inside Control Planes, open a request's settings → "Move/Copy to Workspace" lists the other
    workspaces of the same project. Then open Settings → Data → project export contains the
    project's workspaces (regression guards for step 17).26. Open the command palette from a real organization and search for the name of a Konnect
    collection or request → it appears, labelled "Control Planes" (regression guard for step 20).
14. Reset the vault key on a second device → the `VaultKeyChanged` event clears the secret
    environment variables of Konnect workspaces too, not just those of real organizations.

### Phase 3 specific

13. Delete the currently open Konnect project while inside Control Planes → the loader falls back to
    another project in the same organization, not to a real organization's project list.
14. Open an empty Konnect project → `FirstRequestCreation` does not appear.
15. Attempt to drag a collection workspace from one Konnect project into another → the drop is
    rejected. Then re-sync and confirm no workspace was duplicated or deleted.
16. Connect a PAT from the gear icon → sync starts automatically (i.e. the sync trigger is still
    wired after the tab removal).
17. Disconnect the PAT while inside Control Planes with the flag off → all Konnect projects are
    removed, the organization disappears from the dropdown, and the app navigates to a real
    organization instead of sitting on a dead route.
18. Enter a real organization → no Sync/gear buttons, no sync-progress line, no sync-result panel,
    and the New Project button is present.
19. Enter Control Planes with no synced projects → the main pane shows the read-only explanation,
    not `ProjectCreateForm`; check both before and after connecting a PAT for the two wordings
    (step 19).

### Phase 4 specific

19. Conflict case: after choosing an organization, confirm the non-selected organization's Konnect
    projects **and their workspaces, requests, environments and cookie jars** are all gone from the
    database, not just the project documents.
20. Dismiss the conflict modal without choosing → nothing is migrated, and the modal appears again
    on the next start (no idempotency flag suppressing it).
21. Run the migration with a large data set and confirm the sidebar does not flicker per-document
    during the `parentId` rewrite (buffering is effective on the update path), and that the app is
    not left permanently non-revalidating afterwards (buffer was flushed in `finally`).
22. Confirm the migration cannot be corrupted by a concurrent `syncProjects` — it takes `projectLock`,
    and `syncTeamProjects` only nulls `remoteId` on projects that have one, so Konnect projects
    (`remoteId: null`) are untouched either way.
23. After migration, restart the app → `locationHistoryEntry:<oldOrgId>` pointing at a moved project
    self-heals via `getInitialRouteForOrganization()` rather than landing on a broken route.
24. After migration, the Sync button tooltip shows the previous "Last synced" timestamp rather than
    "Not yet synced" (decision 10 carry-over).

## Scope

**Included:** the fake organization, aggregated feature flag, route/API guards, sidebar tab removal,
one-time migration with conflict resolution, tests.

**Excluded:** the "Dev Portals" organization visible in the reference design; any backend changes;
changes to the Konnect sync algorithm itself (`konnect/sync.ts` internals).

Deliberately **not** touched, despite earlier drafts modifying them:
`organization._index.tsx` and `organization.sync-organizations-and-projects.tsx`. Both ended up with
no functional change, so they were reverted to keep them out of the diff.

## Implementation Notes

Deviations from the plan as built:

- **Step 29** — instead of a React context, the sync trigger lives in a small module-level registry
  (`packages/insomnia/src/ui/hooks/konnect-sync-trigger.ts`, `registerKonnectSyncTrigger` /
  `runKonnectSync`). This removes the `syncKonnectProjectsAndNotifyRef` prop from
  `KonnectSettingsModal` entirely and no-ops when the sidebar is not mounted.
- **Step 16** — the guard sits in `HeaderInviteButton` itself (returning before
  `getOrgUserPermissions`) rather than inside the invite modal, since the modal is only reachable
  through that button.
- **Step 12** — the `syncProjects` guard was moved _above_ `getAllTeamProjects`; the original
  scratchpad guard sat after it and the `fetchTeamProjects` request had already been issued.
- **Step 4** — `syncKonnectSyncEnabled` was first hung off a new `AsyncTask` entry, then moved to the
  `organization._index.tsx` loader, and finally into `organization.tsx`'s `getKonnectOrganization()`
  where it is awaited immediately before the cache is read. Only the last placement actually
  guarantees the write happens before the read; the earlier ones relied on two concurrent loaders
  happening to run in the right order, which fails silently.
- **Step 32** — the entry point is `migrateKonnectProjectsIfUnambiguous(accountId)`, which runs
  `detectKonnectOrgMigration` and only auto-migrates the unambiguous case. It was initially placed
  in the `organization._index.tsx` loader, then moved to `entry.client.tsx` so that it completes
  before hydration; that ordering is what lets step 6 assume post-migration parents instead of
  carrying a defensive allow-list. The conflict modal is mounted in `organization.tsx` and calls
  `runKonnectOrgMigration` directly rather than going through the `showModal` registry, because it
  needs to trigger a router revalidation on completion.

## Pre-existing Issues Found

Discovered while implementing this change, left unfixed and out of scope:

1. **The `AsyncTask` / `asyncTaskList` pipeline never runs.** `getInitialEntry()` can return
   `{ pathname, state }`, but `entry.client.tsx` only acts on a `string` return value, so the object
   form is discarded. `location.state.asyncTaskList` is therefore always undefined, the `useEffect`
   in `organization.tsx` never submits, and the `organization.sync-organizations-and-projects` action
   is unreachable. Knock-on effects: the "Syncing" state in `NetworkAndSyncIndicator` never appears,
   and `lastVisitedOrganizationId` is never honoured on startup — a cold start always lands on `/`,
   is redirected to `/organization` by `routes/_index.tsx`, and then to `organizations[0]`,
   regardless of where the user was last.
   The first draft of this work hung a new `AsyncTask.SyncKonnectFeature` off that pipeline; it was
   removed once the pipeline was confirmed dead.
2. **`konnect-settings-modal.tsx`'s disconnect flow buffers ineffectively** — the outer
   `bufferChangesIndefinitely()` is defeated by `db.remove()`'s internal flush (decision 9).
