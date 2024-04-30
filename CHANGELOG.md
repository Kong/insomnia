# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [core@9.1.0] - 2024-04-30

## What's Changed

- fix(sidebar): improve default size and reset default order by @gatzjames in <https://github.com/Kong/insomnia/pull/7309>
- fix(sdk): some of external modules are missing - INS-3784 by @ihexxa in <https://github.com/Kong/insomnia/pull/7315>
- Fix: non blocking fetch on navigate by @jackkav in <https://github.com/Kong/insomnia/pull/7321>
- fix pm import order by @jackkav in <https://github.com/Kong/insomnia/pull/7332>
- expose internal requests in network tab by @jackkav in <https://github.com/Kong/insomnia/pull/7319>
- show read only headers by @jackkav in <https://github.com/Kong/insomnia/pull/7337>
- add clear sort order test by @jackkav in <https://github.com/Kong/insomnia/pull/7336>
- remove app-side session expiry by @jackkav in <https://github.com/Kong/insomnia/pull/7340>
- fix: subEnvironment's id should be real id instead of n/a - INS-3802 by @ihexxa in <https://github.com/Kong/insomnia/pull/7339>
- Fix/filter out content length by @jackkav in <https://github.com/Kong/insomnia/pull/7341>
- fix(graphql-autocomplete): Add schema to hintOptions by @gatzjames in <https://github.com/Kong/insomnia/pull/7342>
- Refactor/move insomnia fetch by @jackkav in <https://github.com/Kong/insomnia/pull/7344>

## [core@9.0.0] - 2024-04-24

## What's Changed

- (feat/SEC-1010): Add SAST scanning using semgrep by @saisatishkarra in <https://github.com/Kong/insomnia/pull/7015>
- feat: mock resources by @jackkav in <https://github.com/Kong/insomnia/pull/6760>
- feat: mock second pass by @jackkav in <https://github.com/Kong/insomnia/pull/7022>
- Bump/jest-29 by @jackkav in <https://github.com/Kong/insomnia/pull/7027>
- bump eslint by @jackkav in <https://github.com/Kong/insomnia/pull/7026>
- Bump/stoplight pkgs by @jackkav in <https://github.com/Kong/insomnia/pull/7024>
- chore(deps-dev): bump vite from 4.5.1 to 4.5.2 by @dependabot in <https://github.com/Kong/insomnia/pull/7007>
- chore(deps): bump follow-redirects from 1.15.2 to 1.15.5 by @dependabot in <https://github.com/Kong/insomnia/pull/6998>
- Bump/types by @jackkav in <https://github.com/Kong/insomnia/pull/7025>
- feat: template tag to encode hex to base64 by @nbgraham in <https://github.com/Kong/insomnia/pull/6211>
- add mock test by @jackkav in <https://github.com/Kong/insomnia/pull/7031>
- Bump/esbuild by @jackkav in <https://github.com/Kong/insomnia/pull/7035>
- Remove/changelog-stuff by @jackkav in <https://github.com/Kong/insomnia/pull/7036>
- Clean/remove-babel-transform by @jackkav in <https://github.com/Kong/insomnia/pull/7038>
- Add ability to use Buf Schema Registry as a schema source for gRPC requests by @srikrsna-buf in <https://github.com/Kong/insomnia/pull/6975>
- Adds a hidden window by @jackkav in <https://github.com/Kong/insomnia/pull/7063>
- Update timeout for .github/workflows/sast.yml by @team-eng-enablement in <https://github.com/Kong/insomnia/pull/7058>
- Update timeout for .github/workflows/test.yml by @team-eng-enablement in <https://github.com/Kong/insomnia/pull/7051>
- Update timeout for .github/workflows/release-build.yml by @team-eng-enablement in <https://github.com/Kong/insomnia/pull/7054>
- Update timeout for .github/workflows/release-start.yml by @team-eng-enablement in <https://github.com/Kong/insomnia/pull/7056>
- :rocket: 8.6.1 by @insomnia-infra in <https://github.com/Kong/insomnia/pull/7014>
- Update timeout for .github/workflows/release-recurring.yml by @team-eng-enablement in <https://github.com/Kong/insomnia/pull/7053>
- Update timeout for .github/workflows/homebrew.yml by @team-eng-enablement in <https://github.com/Kong/insomnia/pull/7052>
- Update CONTRIBUTING.md by @kbarnard10 in <https://github.com/Kong/insomnia/pull/7048>
- Update timeout for .github/workflows/release-publish.yml by @team-eng-enablement in <https://github.com/Kong/insomnia/pull/7055>
- feat: append to timelines by @jackkav in <https://github.com/Kong/insomnia/pull/7070>
- chore(tailwind): Transform empty design state to tailwind by @gatzjames in <https://github.com/Kong/insomnia/pull/7071>
- chore(tailwind): Transform Insomnia logo to tailwind by @gatzjames in <https://github.com/Kong/insomnia/pull/7073>
- fix: request settings for scratchpad leading to welcome screen by @therealrinku in <https://github.com/Kong/insomnia/pull/7068>
- Add pre-request tab and minimal execution context by @jackkav in <https://github.com/Kong/insomnia/pull/7065>
- chore(tailwind): Move grpc-method-dropdown to tailwind by @gatzjames in <https://github.com/Kong/insomnia/pull/7074>
- refetch mockbin logs 10s by @jackkav in <https://github.com/Kong/insomnia/pull/7084>
- E2e/mock-test-fixture by @jackkav in <https://github.com/Kong/insomnia/pull/7086>
- fix: add viewport meta tag by @marckong in <https://github.com/Kong/insomnia/pull/7049>
- move mkdir to init by @jackkav in <https://github.com/Kong/insomnia/pull/7085>
- feat(prereq): add cancellation by @jackkav in <https://github.com/Kong/insomnia/pull/7078>
- Revert "fix: add viewport meta tag (#7049)" by @filfreire in <https://github.com/Kong/insomnia/pull/7090>
- bump: vite to v5 and fix by @jackkav in <https://github.com/Kong/insomnia/pull/7023>
- mock feature feedback by @jackkav in <https://github.com/Kong/insomnia/pull/7089>
- feat(hidden-window): enable the insomnia object with the environment api [INS-3379] by @ihexxa in <https://github.com/Kong/insomnia/pull/7097>
- Sync improvements by @gatzjames in <https://github.com/Kong/insomnia/pull/7098>
- feat(conflict-resolution): add labels for branch names when resolving conflicts by @gatzjames in <https://github.com/Kong/insomnia/pull/7105>
- feat(hidden-window): enable baseEnvironment in the pre-request scripting [INS-3379] by @ihexxa in <https://github.com/Kong/insomnia/pull/7102>
- fix: release-start changelog step [no-ticket] by @filfreire in <https://github.com/Kong/insomnia/pull/7113>
- fix: move changelog step to release-publish by @filfreire in <https://github.com/Kong/insomnia/pull/7114>
- feat: enable globals, iterationData and variables in pre-request scripting [INS-3379]  by @ihexxa in <https://github.com/Kong/insomnia/pull/7103>
- chore: bump GH actions versions [no-ticket] by @filfreire in <https://github.com/Kong/insomnia/pull/7117>
- feat(Insomnia Cloud Sync): Update filesystem driver for VCS sync by @gatzjames in <https://github.com/Kong/insomnia/pull/7111>
- feat: enable property in pre-request scripting [INS-3379] by @ihexxa in <https://github.com/Kong/insomnia/pull/7120>
- feat: enable headers in pre-request scripting [INS-3379]  by @ihexxa in <https://github.com/Kong/insomnia/pull/7121>
- feat: enable collection-variable in pre-request scripting [INS-3379] by @ihexxa in <https://github.com/Kong/insomnia/pull/7122>
- feat: enable Url in pre-request scripting [INS-3379] by @ihexxa in <https://github.com/Kong/insomnia/pull/7123>
- feat: enable Request and Response in pre-request scripting [INS-3379] by @ihexxa in <https://github.com/Kong/insomnia/pull/7128>
- feat: testing a mock endpoint cancellation by @jackkav in <https://github.com/Kong/insomnia/pull/7093>
- remove deprecated nedb option by @jackkav in <https://github.com/Kong/insomnia/pull/7118>
- chore: temporarily disable pre-request scripting by @ihexxa in <https://github.com/Kong/insomnia/pull/7132>
- Revert "chore: temporarily disable pre-request scripting (#7132)" by @filfreire in <https://github.com/Kong/insomnia/pull/7136>
- feat(prereq): add simple timeout by @jackkav in <https://github.com/Kong/insomnia/pull/7079>
- add prereq beta tag by @jackkav in <https://github.com/Kong/insomnia/pull/7137>
- Feat/import-prereq-script by @jackkav in <https://github.com/Kong/insomnia/pull/7144>
- feat: enable adding snippets menu for pre-request scripting - INS-3319 by @ihexxa in <https://github.com/Kong/insomnia/pull/7146>
- fix react router warning by @jackkav in <https://github.com/Kong/insomnia/pull/7045>
- fix: use collection name when importing from postman by @jackkav in <https://github.com/Kong/insomnia/pull/7142>
- fix(keyboard shortcuts): Add missing shortcuts and fix the ones that don't work as expected by @gatzjames in <https://github.com/Kong/insomnia/pull/7116>
- :rocket: 9.0.0-beta.0 by @insomnia-infra in <https://github.com/Kong/insomnia/pull/7155>
- feat: enable manipulation on insomnia.request - INS-3379 by @ihexxa in <https://github.com/Kong/insomnia/pull/7145>
- set sort key on import by @jackkav in <https://github.com/Kong/insomnia/pull/7148>
- feat(Insomnia-Sync): Add diff view by @gatzjames in <https://github.com/Kong/insomnia/pull/7152>
- :rocket: 9.0.0-beta.1 by @insomnia-infra in <https://github.com/Kong/insomnia/pull/7158>
- authtypes by @jackkav in <https://github.com/Kong/insomnia/pull/7156>
- support null url by @jackkav in <https://github.com/Kong/insomnia/pull/7166>
- fix(Insomnia Sync): redirect after sync pull by @gatzjames in <https://github.com/Kong/insomnia/pull/7168>
- fix changelog by @jackkav in <https://github.com/Kong/insomnia/pull/7159>
- :rocket: 9.0.0-alpha.0 by @insomnia-infra in <https://github.com/Kong/insomnia/pull/7169>
- feat(Insomnia Sync): add diff view on conflict resolution and handle cancelation by @gatzjames in <https://github.com/Kong/insomnia/pull/7175>
- harden lint rule about array indexes by @jackkav in <https://github.com/Kong/insomnia/pull/6758>
- feat: enable insomnia.sendRequest in pre-request scripting - INS-3379 by @ihexxa in <https://github.com/Kong/insomnia/pull/7147>
- feat(pre-req): enable auth manipulation through insomnia.request - INS-3379 by @ihexxa in <https://github.com/Kong/insomnia/pull/7186>
- chore(pre-req): improve the snippets menu for the pre-request script - INS-3319 by @ihexxa in <https://github.com/Kong/insomnia/pull/7173>
- fix: URL PREVIEW cut off first few lines for very long URL [INS-3640] by @CurryYangxx in <https://github.com/Kong/insomnia/pull/7190>
- fix: Export popup has small z-index [INS-3640] by @CurryYangxx in <https://github.com/Kong/insomnia/pull/7187>
- feat(pre-req): enable manipulation of proxy and certificate through insomnia.request - INS-3379 by @ihexxa in <https://github.com/Kong/insomnia/pull/7171>
- support SSE method, request body and auth by @jackkav in <https://github.com/Kong/insomnia/pull/7182>
- fix(pre-req): several fixes to the current hidden window launching process - INS-3319 by @ihexxa in <https://github.com/Kong/insomnia/pull/7174>
- feat(Command Palette): Introduce global search by @gatzjames in <https://github.com/Kong/insomnia/pull/7191>
- feat(session): Store session data in the db instead of LocalStorage by @gatzjames in <https://github.com/Kong/insomnia/pull/7192>
- chore(pre-req): clean up pre-request script sdk objects - INS-3379 by @ihexxa in <https://github.com/Kong/insomnia/pull/7172>
- feat(onboarding): Insomnia 9 by @gatzjames in <https://github.com/Kong/insomnia/pull/7194>
- fix: startsWith not a function error [INS-3640] by @CurryYangxx in <https://github.com/Kong/insomnia/pull/7201>
- feat: enable insomnia.test and insomnia.expect in scripting - INS-3637 by @ihexxa in <https://github.com/Kong/insomnia/pull/7202>
- fix: release-start [no-ticket] by @filfreire in <https://github.com/Kong/insomnia/pull/7212>
- fix: release-start handle re-run step by @filfreire in <https://github.com/Kong/insomnia/pull/7215>
- :rocket: 9.0.0-beta.2 by @insomnia-infra in <https://github.com/Kong/insomnia/pull/7216>
- fix: propagate `organizationId` when opening the search dialog by @andrea-mauro in <https://github.com/Kong/insomnia/pull/7208>
- Support for colon after a path parameter by @pgoldtho in <https://github.com/Kong/insomnia/pull/7200>
- :rocket: 9.0.0-beta.3 by @insomnia-infra in <https://github.com/Kong/insomnia/pull/7220>
- Fix local state updates for GraphQL Query Variables by @MKHokinson in <https://github.com/Kong/insomnia/pull/7205>
- chore: remove repetitive words by @JohnEndson in <https://github.com/Kong/insomnia/pull/7223>
- mock-extraction feedback by @jackkav in <https://github.com/Kong/insomnia/pull/7207>
- fix: repeat on interval may lead to stay requesting by @zhengjitf in <https://github.com/Kong/insomnia/pull/6936>
- fix: url is encoded during execute pre-request script [INS-3681] by @CurryYangxx in <https://github.com/Kong/insomnia/pull/7229>
- feat: enable cookieJar manipulation in pre-request script - INS-3379 by @ihexxa in <https://github.com/Kong/insomnia/pull/7228>
- fix: enable per-request var manipulation in pre-req scripts - INS-3379 by @ihexxa in <https://github.com/Kong/insomnia/pull/7230>
- Change create/update project based on the organization storage rule [INS-3495] by @pavkout in <https://github.com/Kong/insomnia/pull/7042>
- Bump/minors-and-types by @jackkav in <https://github.com/Kong/insomnia/pull/7234>
- bump grpc stuff by @jackkav in <https://github.com/Kong/insomnia/pull/7241>
- bump oidc by @jackkav in <https://github.com/Kong/insomnia/pull/7242>
- minor bumps by @jackkav in <https://github.com/Kong/insomnia/pull/7243>
- bump vite and esbuild by @jackkav in <https://github.com/Kong/insomnia/pull/7245>
- more major bumps by @jackkav in <https://github.com/Kong/insomnia/pull/7244>
- bump electron-builder by @jackkav in <https://github.com/Kong/insomnia/pull/7246>
- bump less and date-fns by @jackkav in <https://github.com/Kong/insomnia/pull/7247>
- fix: vscode debug config by @CurryYangxx in <https://github.com/Kong/insomnia/pull/7231>
- Request URL bar fix and collection name truncation improvement by @git-commit-amen in <https://github.com/Kong/insomnia/pull/7222>
- fix: some minor fixes for pre-request script sdk - INS-3379 by @ihexxa in <https://github.com/Kong/insomnia/pull/7225>
- feat: translate pm object handler into insomnia object instead of supporting alias - INS-3702 by @ihexxa in <https://github.com/Kong/insomnia/pull/7253>
- feat: Show proper error when environment variables are not valued [INS-3641] by @CurryYangxx in <https://github.com/Kong/insomnia/pull/7227>
- fix(pre-request script): avoid encoding tags in parsing request urls - INS-3379 by @ihexxa in <https://github.com/Kong/insomnia/pull/7249>
- mock UX feedback by @jackkav in <https://github.com/Kong/insomnia/pull/7252>
- Fix parsing urlencoded pairs with empty values. by @adamroyle in <https://github.com/Kong/insomnia/pull/6980>
- fix: some UI improvements of the pre-request script tab - INS-3711 by @ihexxa in <https://github.com/Kong/insomnia/pull/7258>
- fix: focus editor by shortcut [INS-3669] by @CurryYangxx in <https://github.com/Kong/insomnia/pull/7261>
- bump node and electron versions by @jackkav in <https://github.com/Kong/insomnia/pull/7203>
- chore(pre-req script): move all sdk files to sdk workspace - INS-3379 by @ihexxa in <https://github.com/Kong/insomnia/pull/7255>
- feat: add fallback for searching a proper client certificate for a host [INS-3680] by @CurryYangxx in <https://github.com/Kong/insomnia/pull/7259>
- feat: enable external modules in pre-request script - INS-3379 by @ihexxa in <https://github.com/Kong/insomnia/pull/7257>
- fix: onboarding page continue button ui by @CurryYangxx in <https://github.com/Kong/insomnia/pull/7269>
- feat: add dismiss for path param tip [INS-3739] by @CurryYangxx in <https://github.com/Kong/insomnia/pull/7271>
- feat(pre-req-script-editor): translate handlers in pasting script - INS-3721 by @ihexxa in <https://github.com/Kong/insomnia/pull/7270>
- feat(resizable-sidebar): replace custom sidebar with resizable-panels by @gatzjames in <https://github.com/Kong/insomnia/pull/7274>
- feat(sidebar): add toggle button to expand/collapse the organizations sidebar by @gatzjames in <https://github.com/Kong/insomnia/pull/7275>
- :rocket: 9.0.0-beta.4 by @insomnia-infra in <https://github.com/Kong/insomnia/pull/7276>
- Fix/mock-feedback-4 by @jackkav in <https://github.com/Kong/insomnia/pull/7277>
- manual changelog and release notes docs by @jackkav in <https://github.com/Kong/insomnia/pull/7282>
- fix: some minor fixes for the pre-request scripting - INS-3765 by @ihexxa in <https://github.com/Kong/insomnia/pull/7284>
- fix: wildcard pattern matching by @hvitoi in <https://github.com/Kong/insomnia/pull/7265>
- feat(empty-organization): All projects can now be deleted by @gatzjames in <https://github.com/Kong/insomnia/pull/7278>
- Added Proxy Support for OAuth 2 Authorization Code Flow Popup by @moritz4004 in <https://github.com/Kong/insomnia/pull/7077>
- fix: prevent app restart when editor setting change [INS-3668] by @CurryYangxx in <https://github.com/Kong/insomnia/pull/7268>
- feat(hidden-win): try to simulate the existing behavior of handling async tasks - INS-3561 by @ihexxa in <https://github.com/Kong/insomnia/pull/7281>
- chore: fix some typos in comments by @alongdate in <https://github.com/Kong/insomnia/pull/7283>
- fix: insomnia.environment.name is missing - INS-3765 by @ihexxa in <https://github.com/Kong/insomnia/pull/7289>
- fix(organization-navbar): make the navbar scrollable when it overflows by @gatzjames in <https://github.com/Kong/insomnia/pull/7291>
- provide users a subdomain based mock url by @jackkav in <https://github.com/Kong/insomnia/pull/7262>
- update mock doc url by @jackkav in <https://github.com/Kong/insomnia/pull/7293>
- fix(workspace-cards): Truncate the name after 2 lines by @gatzjames in <https://github.com/Kong/insomnia/pull/7294>
- fix: some minor fixes for the pre-request script by @ihexxa in <https://github.com/Kong/insomnia/pull/7299>
- use subdomain in code gen by @jackkav in <https://github.com/Kong/insomnia/pull/7295>
- feat(event-log): Improve UX of the event log for WS and SSE responses by @gatzjames in <https://github.com/Kong/insomnia/pull/7300>
- fix timeline watcher by @jackkav in <https://github.com/Kong/insomnia/pull/7301>
- feat(organizations): Cache organizations to support offline first UX by @gatzjames in <https://github.com/Kong/insomnia/pull/7303>
- :rocket: 9.0.0-beta.5 by @insomnia-infra in <https://github.com/Kong/insomnia/pull/7304>
- fix mock empty state by @jackkav in <https://github.com/Kong/insomnia/pull/7302>
- fix: persist script's changes on environment and baseEnvironment by @ihexxa in <https://github.com/Kong/insomnia/pull/7306>

## New Contributors

- @saisatishkarra made their first contribution in <https://github.com/Kong/insomnia/pull/7015>
- @srikrsna-buf made their first contribution in <https://github.com/Kong/insomnia/pull/6975>
- @team-eng-enablement made their first contribution in <https://github.com/Kong/insomnia/pull/7058>
- @CurryYangxx made their first contribution in <https://github.com/Kong/insomnia/pull/7190>
- @andrea-mauro made their first contribution in <https://github.com/Kong/insomnia/pull/7208>
- @pgoldtho made their first contribution in <https://github.com/Kong/insomnia/pull/7200>
- @MKHokinson made their first contribution in <https://github.com/Kong/insomnia/pull/7205>
- @JohnEndson made their first contribution in <https://github.com/Kong/insomnia/pull/7223>
- @git-commit-amen made their first contribution in <https://github.com/Kong/insomnia/pull/7222>
- @adamroyle made their first contribution in <https://github.com/Kong/insomnia/pull/6980>
- @hvitoi made their first contribution in <https://github.com/Kong/insomnia/pull/7265>
- @moritz4004 made their first contribution in <https://github.com/Kong/insomnia/pull/7077>
- @alongdate made their first contribution in <https://github.com/Kong/insomnia/pull/7283>

**Full Changelog**: <https://github.com/Kong/insomnia/compare/core@8.6.1...core@9.0.0>

## [core@8.6.1] - 2024-02-06

### :sparkles: New Features

- [`e1e3b13`](https://github.com/Kong/insomnia/commit/e1e3b139b3bb917ab9dfcb0ce12d16079dee9c04) - **unit-tests**: Unit test reordering *(PR [#7020](https://github.com/Kong/insomnia/pull/7020) by [@gatzjames](https://github.com/gatzjames))*
- [`2249bb7`](https://github.com/Kong/insomnia/commit/2249bb7b98c947ab1cb11955928fd80d4adec845) - **environment**: update environments icons *(PR [#7050](https://github.com/Kong/insomnia/pull/7050) by [@gatzjames](https://github.com/gatzjames))*
- [`a09c233`](https://github.com/Kong/insomnia/commit/a09c23305c9c493105808b8df23d1911f5b59ea2) - **pane-tabs**: Consistent styles for tabs *(PR [#7062](https://github.com/Kong/insomnia/pull/7062) by [@gatzjames](https://github.com/gatzjames))*
- [`d1c2928`](https://github.com/Kong/insomnia/commit/d1c292891cc9dd8a17d4637f643336cf1afcccfa) - **command-palette**: add button to open the command palette *(PR [#7064](https://github.com/Kong/insomnia/pull/7064) by [@gatzjames](https://github.com/gatzjames))*

### :bug: Bug Fixes

- [`df0a791`](https://github.com/Kong/insomnia/commit/df0a79194143dc615310ecc0976381c538f695f2) - re-initialize the parameter editor state when switching between requests *(PR [#7005](https://github.com/Kong/insomnia/pull/7005) by [@gatzjames](https://github.com/gatzjames))*
  - :arrow_lower_right: *fixes issue [#7000](undefined) opened by [@jwarner112](https://github.com/jwarner112)*
- [`3fceccf`](https://github.com/Kong/insomnia/commit/3fceccfdf691a0f3d7592f31120030eeff92be61) - **workspace**: Add default name for when creating a workspace *(PR [#7046](https://github.com/Kong/insomnia/pull/7046) by [@gatzjames](https://github.com/gatzjames))*

### :wrench: Chores

- [`353780e`](https://github.com/Kong/insomnia/commit/353780e16ab30853ce206398850c0c0f1c9bd887) - edit changelog process [INS-3456] *(PR [#7001](https://github.com/Kong/insomnia/pull/7001) by [@filfreire](https://github.com/filfreire))*

[core@8.6.1]: https://github.com/Kong/insomnia/compare/core@8.6.0...core@8.6.1
