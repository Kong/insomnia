# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [core@9.0.0] - 2024-04-24

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
