# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [core@10.0.0] - 2024-09-10

## What's Changed
* bump: react-router by @CurryYangxx in https://github.com/Kong/insomnia/pull/7795
* fix(Sync Staging Modal): use action to update selected items by @gatzjames in https://github.com/Kong/insomnia/pull/7794
* Fixed copying credential In Auth: Basic were username and password input needed to copied by users by @pranavithape in https://github.com/Kong/insomnia/pull/7789
* fix(ux): duplicate improvement by @CurryYangxx in https://github.com/Kong/insomnia/pull/7803
* fixes lodash.set cve by @jackkav in https://github.com/Kong/insomnia/pull/7801
* chore: rm userId from sentry [INS-4260] by @filfreire in https://github.com/Kong/insomnia/pull/7804
* fix cves and add CI check by @jackkav in https://github.com/Kong/insomnia/pull/7806
* Fix: Keep equal sign for empty query parameters[INS-4228] by @cwangsmv in https://github.com/Kong/insomnia/pull/7802
* chore: hash userID on segment [INS-4260] by @filfreire in https://github.com/Kong/insomnia/pull/7805
* Fix backslash in environment key freeze app [INS-4157] by @yaoweiprc in https://github.com/Kong/insomnia/pull/7763
* fix(Key-Value Editor): deleting the last item on the key-value pair not showing an empty pair by @gatzjames in https://github.com/Kong/insomnia/pull/7818
* Remove styled-components by @jackkav in https://github.com/Kong/insomnia/pull/7809
* feat(sync): support offline commit- [INS-4226] by @CurryYangxx in https://github.com/Kong/insomnia/pull/7811
* :rocket: 9.3.4-beta.0 by @insomnia-infra in https://github.com/Kong/insomnia/pull/7823
* Import postman env in Insomnia project level [INS-4253] by @yaoweiprc in https://github.com/Kong/insomnia/pull/7821
* feat: display uncommit&unpush change - [INS-4138] by @CurryYangxx in https://github.com/Kong/insomnia/pull/7816
* Preserve the original Authorization headers when importing [INS-4269] by @yaoweiprc in https://github.com/Kong/insomnia/pull/7827
* feat: Context menu for Nunjucks tag[INS-4273] by @cwangsmv in https://github.com/Kong/insomnia/pull/7828
* feat(Keyboard Shorcuts): update delete request shortcut by @gatzjames in https://github.com/Kong/insomnia/pull/7824
* feat: show uncommit&unpush status for all projects-[INS-4138] by @CurryYangxx in https://github.com/Kong/insomnia/pull/7830
* Fix: GraphQL request export curl body issue and GraphQL payload delete issue[INS-4281] by @cwangsmv in https://github.com/Kong/insomnia/pull/7831
* :rocket: 9.3.4-beta.1 by @insomnia-infra in https://github.com/Kong/insomnia/pull/7836
* Try to fix smoke test flaky by @cwangsmv in https://github.com/Kong/insomnia/pull/7840
* fix: test-util snippet to proper status code check [no-ticket] by @filfreire in https://github.com/Kong/insomnia/pull/7844
* feat(Project View): UI improvements by @gatzjames in https://github.com/Kong/insomnia/pull/7850
* fix: disable failure on npm audit [no-ticket] by @filfreire in https://github.com/Kong/insomnia/pull/7862
* chore: bump electron to 30.4 [INS-4316] by @filfreire in https://github.com/Kong/insomnia/pull/7852
* import postman data dump [INS-3810] by @yaoweiprc in https://github.com/Kong/insomnia/pull/7834
* support for removing default org project by @yaoweiprc in https://github.com/Kong/insomnia/pull/7854
* fix: persist cookies from response together with ones from after-response script by @ihexxa in https://github.com/Kong/insomnia/pull/7819
* chore: split packaging for windows builds [INS-3983] by @filfreire in https://github.com/Kong/insomnia/pull/7838
* fix(Git Sync): fix issue when switching to Insomnia Sync by @gatzjames in https://github.com/Kong/insomnia/pull/7860
* fix: handle login when opening org logged out [INS-4330] by @filfreire in https://github.com/Kong/insomnia/pull/7865
* Revert "support for removing default org project" by @yaoweiprc in https://github.com/Kong/insomnia/pull/7874
* inso cli scripting first pass by @jackkav in https://github.com/Kong/insomnia/pull/7790
* Allow deleting default project in org and fix sync issue [INS-4342] [INS-4311] by @yaoweiprc in https://github.com/Kong/insomnia/pull/7881
* chore(runner): cleaning up runner-pr1 and resolve conflicts by @ihexxa in https://github.com/Kong/insomnia/pull/7878
* :rocket: 10.0.0-beta.0 by @insomnia-infra in https://github.com/Kong/insomnia/pull/7882
* only minify inso cli in prod by @jackkav in https://github.com/Kong/insomnia/pull/7879
* feat: Add logic to redirect users based on their plan when creating a new organization by @pavkout in https://github.com/Kong/insomnia/pull/7856
* tabs should rerender when changing mock by @jackkav in https://github.com/Kong/insomnia/pull/7888
* fix: check for open curl by @jackkav in https://github.com/Kong/insomnia/pull/7889
* Bump/electron-31 by @jackkav in https://github.com/Kong/insomnia/pull/7884
* shell.nix -> flake.nix by @jackkav in https://github.com/Kong/insomnia/pull/7892
* add mock method header by @jackkav in https://github.com/Kong/insomnia/pull/7872
* use nixpkgs/unstable by @jackkav in https://github.com/Kong/insomnia/pull/7902
* fix: file not synced after switch sync method -[INS-4347] by @CurryYangxx in https://github.com/Kong/insomnia/pull/7897
* fix: rename untracked projects [INS-4365] by @filfreire in https://github.com/Kong/insomnia/pull/7898
* fix: flaky git test by @ihexxa in https://github.com/Kong/insomnia/pull/7883
* Add ut and e2e test for data upload and pre-script in collection runner by @cwangsmv in https://github.com/Kong/insomnia/pull/7903
* Supporting moving files from one project to another [INS-3865] by @yaoweiprc in https://github.com/Kong/insomnia/pull/7849
* Enhance Response function to aware environment change and update description[INS-4279] by @cwangsmv in https://github.com/Kong/insomnia/pull/7896
* chore: update AI service URL to use 'https://ai-helper.insomnia.rest' [INS-4367] by @pavkout in https://github.com/Kong/insomnia/pull/7910
* fix(runner): some minor fixes and improvements by @ihexxa in https://github.com/Kong/insomnia/pull/7900
* improve flakey test by @jackkav in https://github.com/Kong/insomnia/pull/7909
* feat: sign all files on windows [INS-4362] by @filfreire in https://github.com/Kong/insomnia/pull/7913
* Avoid encoding queryParams when request.settingEncodeUrl is set to false by @XSPGMike in https://github.com/Kong/insomnia/pull/7893
* feat: improve EDN response by @garug in https://github.com/Kong/insomnia/pull/7777
* fix: minor fixes in styles, linting and UT by @ihexxa in https://github.com/Kong/insomnia/pull/7916
* preserve relationships in nunjucks tags by @jackkav in https://github.com/Kong/insomnia/pull/7915
* :rocket: 10.0.0-beta.1 by @insomnia-infra in https://github.com/Kong/insomnia/pull/7917
* chore: cleanup after v10 beta.1 [no-ticket] by @filfreire in https://github.com/Kong/insomnia/pull/7918
* feat(Onboarding): v10 by @gatzjames in https://github.com/Kong/insomnia/pull/7863
* chore: return friendly message when sendRequest sees an error by @ihexxa in https://github.com/Kong/insomnia/pull/7911
* chore: upgrade micromatch and add back npm audit by @ihexxa in https://github.com/Kong/insomnia/pull/7921
* fix(runner): some minor fixes by @ihexxa in https://github.com/Kong/insomnia/pull/7923
* add team check by @jackkav in https://github.com/Kong/insomnia/pull/7919
* :rocket: 10.0.0-beta.2 by @insomnia-infra in https://github.com/Kong/insomnia/pull/7924
* Fix duplicate file cause application error in collection view UI by @cwangsmv in https://github.com/Kong/insomnia/pull/7928
* :rocket: 10.0.0-beta.3 by @insomnia-infra in https://github.com/Kong/insomnia/pull/7930

## New Contributors
* @pranavithape made their first contribution in https://github.com/Kong/insomnia/pull/7789
* @XSPGMike made their first contribution in https://github.com/Kong/insomnia/pull/7893
* @garug made their first contribution in https://github.com/Kong/insomnia/pull/7777

**Full Changelog**: https://github.com/Kong/insomnia/compare/core@9.3.3...core@10.0.0

## [core@9.3.3] - 2024-07-31

## What's Changed
* perf: App start improvement [INS-3957] by @CurryYangxx in https://github.com/Kong/insomnia/pull/7492
* :rocket: 9.3.3-beta.0 by @insomnia-infra in https://github.com/Kong/insomnia/pull/7674
* fix: default user-agent for oauth2 [7672] by @filfreire in https://github.com/Kong/insomnia/pull/7675
* inso fifth pass by @jackkav in https://github.com/Kong/insomnia/pull/7601
* feat: inso parent folder auth by @jackkav in https://github.com/Kong/insomnia/pull/7676
* chore: duplicate / symbol for import in insomnia-sdk/src/objects/(interfaces.ts, request.ts) by @Novsochetra in https://github.com/Kong/insomnia/pull/7686
* fix: changelog [no-ticket] by @filfreire in https://github.com/Kong/insomnia/pull/7677
* chore: enable sentry tracing by @CurryYangxx in https://github.com/Kong/insomnia/pull/7688
* force vite to always wipe cache by @jackkav in https://github.com/Kong/insomnia/pull/7690
* chore: make the overlay darker in displaying request timings by @ihexxa in https://github.com/Kong/insomnia/pull/7691
* split test job into app and cli by @jackkav in https://github.com/Kong/insomnia/pull/7685
* chore: add smoke test for git-sync [INS-4132] by @filfreire in https://github.com/Kong/insomnia/pull/7682
* feat(Markdown Preview): always enable preview by @gatzjames in https://github.com/Kong/insomnia/pull/7694
* fix(Delete Environment): Don't show empty view when deleting an environment by @gatzjames in https://github.com/Kong/insomnia/pull/7695
* fix(Export): Option to export all data from the settings on the login view by @gatzjames in https://github.com/Kong/insomnia/pull/7702
* fix: typo in style name by @ihexxa in https://github.com/Kong/insomnia/pull/7701
* fix: ui improvement when return deferred data in loader by @CurryYangxx in https://github.com/Kong/insomnia/pull/7681
* fix: refresh storage rule when org change by @CurryYangxx in https://github.com/Kong/insomnia/pull/7707
* hide self host url in create/edit mock by @jackkav in https://github.com/Kong/insomnia/pull/7704
* feat(Request pane): Add indicators for body and auth in the request pane tabs by @gatzjames in https://github.com/Kong/insomnia/pull/7697
* Trim Bearer Authentication Strings by @SimplexShotz in https://github.com/Kong/insomnia/pull/7279
* feat: show deprecation warnings on graphql arguments by @anujbiyani in https://github.com/Kong/insomnia/pull/7364
* Clean up outdate jest and tsconfigs by @jackkav in https://github.com/Kong/insomnia/pull/7712
* chore: mv prerelease tests into smoke [INS-4132] by @filfreire in https://github.com/Kong/insomnia/pull/7705
* feat: add test utils on scripting snippets [INS-4141] by @filfreire in https://github.com/Kong/insomnia/pull/7692
* fix: migrate loader redirect by @CurryYangxx in https://github.com/Kong/insomnia/pull/7426
* refactor: flatten and reduce tsconfigs by @jackkav in https://github.com/Kong/insomnia/pull/7716
* enable verbatimModuleSyntax by @jackkav in https://github.com/Kong/insomnia/pull/7718
* perf: return deferred data in permission loader by @CurryYangxx in https://github.com/Kong/insomnia/pull/7635
* perf: change org performance improvement [INS-3968] by @CurryYangxx in https://github.com/Kong/insomnia/pull/7582
* feat: add async task indicator [INS-4106] by @CurryYangxx in https://github.com/Kong/insomnia/pull/7522
* fix(sdk): sdk type cleanup by @ihexxa in https://github.com/Kong/insomnia/pull/7721
* chore: bump electron 30.0 to 30.2 by @filfreire in https://github.com/Kong/insomnia/pull/7714
* fix: Use SSE for storage control updates by @pavkout in https://github.com/Kong/insomnia/pull/7661
* :rocket: 9.3.3-beta.1 by @insomnia-infra in https://github.com/Kong/insomnia/pull/7723
* Update CHANGELOG.md by @CurryYangxx in https://github.com/Kong/insomnia/pull/7725
* feat: inso collection runner by @jackkav in https://github.com/Kong/insomnia/pull/7700
* fix: cannot delete request by shortcut [INS-4156] by @yaoweiprc in https://github.com/Kong/insomnia/pull/7728
* fix(Key-Value Editor): Edit mode by @gatzjames in https://github.com/Kong/insomnia/pull/7739
* remove send-request by @jackkav in https://github.com/Kong/insomnia/pull/7731
* feat(Generate Collection from Spec): add description to requests if it's available from the oas3 schema by @gatzjames in https://github.com/Kong/insomnia/pull/7734
* fix: syncing status indicator ui by @CurryYangxx in https://github.com/Kong/insomnia/pull/7730
* feat(Sidebar): interactions improvements by @gatzjames in https://github.com/Kong/insomnia/pull/7722
* fix(Git Clone): redirect using incorrect organizationId by @gatzjames in https://github.com/Kong/insomnia/pull/7740
* :rocket: 9.3.3-beta.2 by @insomnia-infra in https://github.com/Kong/insomnia/pull/7741
* handle null auth by @jackkav in https://github.com/Kong/insomnia/pull/7746
* fix(Collection): Clean up auto-scroll and add back selected item styling by @gatzjames in https://github.com/Kong/insomnia/pull/7747
* fixes incorrect scrollbar display issue by @Karthik7406 in https://github.com/Kong/insomnia/pull/7742
* fix: reduce uncessary navigate when switching requests and tests by @CurryYangxx in https://github.com/Kong/insomnia/pull/7748
* fix: lost <disabled> in header transforming and blank req body by @ihexxa in https://github.com/Kong/insomnia/pull/7738
* chore: git sync pull push test [INS-4132] by @filfreire in https://github.com/Kong/insomnia/pull/7720
* vitest by @jackkav in https://github.com/Kong/insomnia/pull/7754
* feat(History): Navigate to last opened workspace on app load by @gatzjames in https://github.com/Kong/insomnia/pull/7755
* feat(Sentry): clean up unnecessary sentry stack by @gatzjames in https://github.com/Kong/insomnia/pull/7758
* fix(Settings): update header styles for analytics by @gatzjames in https://github.com/Kong/insomnia/pull/7759
* fix: can't match project when last visit page is dashboard by @CurryYangxx in https://github.com/Kong/insomnia/pull/7762
* fix(History): navigate to the project if the last visited workspace has been deleted by @gatzjames in https://github.com/Kong/insomnia/pull/7764
* feat(Response Pane): improve tabs styles by @gatzjames in https://github.com/Kong/insomnia/pull/7765
* :rocket: 9.3.3-beta.3 by @insomnia-infra in https://github.com/Kong/insomnia/pull/7766
* chore: add sentry metric [INS-4115] by @CurryYangxx in https://github.com/Kong/insomnia/pull/7727
* Vitest-2 app package by @jackkav in https://github.com/Kong/insomnia/pull/7757
* fix: project switch report by @CurryYangxx in https://github.com/Kong/insomnia/pull/7771
* :rocket: 9.3.3-beta.4 by @insomnia-infra in https://github.com/Kong/insomnia/pull/7774
* feat(UI): UI improvements for the app by @gatzjames in https://github.com/Kong/insomnia/pull/7773
* chore: check analytics issue [INS-4212] by @filfreire in https://github.com/Kong/insomnia/pull/7775
* fix(GraphQL Editor): make inputValueDeprecation optional and change variable mode to json by @gatzjames in https://github.com/Kong/insomnia/pull/7779
* inso cli dx improvements by @jackkav in https://github.com/Kong/insomnia/pull/7776
* fix(Git Staging Modal): close the modal on ESC by @gatzjames in https://github.com/Kong/insomnia/pull/7781
* fix(KeyValue Editor): fix key value focus issue and handle updating params from url by @gatzjames in https://github.com/Kong/insomnia/pull/7780
* feat(Styles): Minor style improvements by @gatzjames in https://github.com/Kong/insomnia/pull/7782
* :rocket: 9.3.3-beta.5 by @insomnia-infra in https://github.com/Kong/insomnia/pull/7783
* Add type checking to sdk package by @jackkav in https://github.com/Kong/insomnia/pull/7719

## New Contributors
* @Novsochetra made their first contribution in https://github.com/Kong/insomnia/pull/7686
* @SimplexShotz made their first contribution in https://github.com/Kong/insomnia/pull/7279
* @anujbiyani made their first contribution in https://github.com/Kong/insomnia/pull/7364
* @yaoweiprc made their first contribution in https://github.com/Kong/insomnia/pull/7728
* @Karthik7406 made their first contribution in https://github.com/Kong/insomnia/pull/7742

**Full Changelog**: https://github.com/Kong/insomnia/compare/core@9.3.2...core@9.3.3

## [core@9.3.2] - 2024-07-04

## What's Changed

- fix(UI Improvements) by @gatzjames in <https://github.com/Kong/insomnia/pull/7626>
- chore(Tailwind): RenderedQueryString to tailwind by @gatzjames in <https://github.com/Kong/insomnia/pull/7627>
- fix(Workspace Card): Clicking on the workspace card title should navigate to the workspace by @gatzjames in <https://github.com/Kong/insomnia/pull/7631>
- fix: can not undo in editor after sending request as keys are always changing by @ihexxa in <https://github.com/Kong/insomnia/pull/7623>
- key markdown editors by @jackkav in <https://github.com/Kong/insomnia/pull/7644>
- can toggle selected folder by @jackkav in <https://github.com/Kong/insomnia/pull/7639>
- bump ws and grpc by @jackkav in <https://github.com/Kong/insomnia/pull/7618>
- fix: folder scripts are not executed if request script is not enabled by @ihexxa in <https://github.com/Kong/insomnia/pull/7646>
- fix oauth2 folder fetch by @jackkav in <https://github.com/Kong/insomnia/pull/7649>
- fix(File Renames): Retry renames for windows EPERM issue by @gatzjames in <https://github.com/Kong/insomnia/pull/7645>
- fix(Export): Allow exporting workspaces without requests by @gatzjames in <https://github.com/Kong/insomnia/pull/7643>
- fix: importing collection with invalid keys returns error by @ihexxa in <https://github.com/Kong/insomnia/pull/7563>
- feat: setting to toggle insomnia user-agent [INS-4107] by @filfreire in <https://github.com/Kong/insomnia/pull/7640>
- fix(Key-Value Editor): Fix stale state updates on key-value editor by @gatzjames in <https://github.com/Kong/insomnia/pull/7654>
- default to current rather than storage selection by @jackkav in <https://github.com/Kong/insomnia/pull/7655>
- :rocket: 9.3.2-beta.0 by @insomnia-infra in <https://github.com/Kong/insomnia/pull/7656>
- bump: @sentry/electron by @CurryYangxx in <https://github.com/Kong/insomnia/pull/7561>
- fix: generating curl command returns <getTime> error by @ihexxa in <https://github.com/Kong/insomnia/pull/7648>
- feat(Proxy Settings): Improve Proxy experience by @gatzjames in <https://github.com/Kong/insomnia/pull/7664>

**Full Changelog**: <https://github.com/Kong/insomnia/compare/core@9.3.1...core@9.3.2>

## [core@9.3.1] - 2024-06-28

## What's Changed

- fix: help to handle @ when it is not encoded in url by @ihexxa in <https://github.com/Kong/insomnia/pull/7609>
- fix(Cookie expires): Invalid date on cookie expires by @gatzjames in <https://github.com/Kong/insomnia/pull/7614>
- chore: add event for workspace environment type [no-ticket] by @filfreire in <https://github.com/Kong/insomnia/pull/7602>
- chore: add request id by @marckong in <https://github.com/Kong/insomnia/pull/7610>

**Full Changelog**: <https://github.com/Kong/insomnia/compare/core@9.3.0...core@9.3.1>

## [core@9.3.0] - 2024-06-27

## What's Changed

- copy changelog from release notes by @jackkav in <https://github.com/Kong/insomnia/pull/7410>
- can navigate to folder and inherit auth by @jackkav in <https://github.com/Kong/insomnia/pull/7353>
- feat(Auth screen): Improve copy and add animation by @gatzjames in <https://github.com/Kong/insomnia/pull/7429>
- fix(Sync): Display errors on sync branches modal by @gatzjames in <https://github.com/Kong/insomnia/pull/7433>
- fix(Mock Server): Enable auto-push for mock servers by @gatzjames in <https://github.com/Kong/insomnia/pull/7434>
- fix(CodeEditor): UI alignment in toolbar/filter dialog by @gatzjames in <https://github.com/Kong/insomnia/pull/7436>
- disable context menu override by @jackkav in <https://github.com/Kong/insomnia/pull/7431>
- fix: init the hidden window when renderers are reloaded by @ihexxa in <https://github.com/Kong/insomnia/pull/7428>
- disable find in one line editor by @jackkav in <https://github.com/Kong/insomnia/pull/7442>
- feat: folder inheritance headers by @jackkav in <https://github.com/Kong/insomnia/pull/7437>
- fix: unhandled typerror [no-ticket] by @filfreire in <https://github.com/Kong/insomnia/pull/7444>
- bump libcurl by @jackkav in <https://github.com/Kong/insomnia/pull/7443>
- feat: enable major features of the after-response script by @ihexxa in <https://github.com/Kong/insomnia/pull/7411>
- :rocket: 9.3.0-beta.0 by @insomnia-infra in <https://github.com/Kong/insomnia/pull/7447>
- Update CHANGELOG.md by @CurryYangxx in <https://github.com/Kong/insomnia/pull/7448>
- feat(Accessibility): Update request lists to anounce the request name of a request on voice over by @gatzjames in <https://github.com/Kong/insomnia/pull/7449>
- fix: support generating values with faker.js in scripting by @ihexxa in <https://github.com/Kong/insomnia/pull/7454>
- chore: investigate login error [INS-3851] by @filfreire in <https://github.com/Kong/insomnia/pull/7438>
- feat: mock create segment event [INS-3924] by @filfreire in <https://github.com/Kong/insomnia/pull/7461>
- fix: unify after-response script property name for folders by @ihexxa in <https://github.com/Kong/insomnia/pull/7460>
- fix: project with null remoteId don't need to be updated by @CurryYangxx in <https://github.com/Kong/insomnia/pull/7464>
- fix: avoid rendering script by temporarily disable it by @ihexxa in <https://github.com/Kong/insomnia/pull/7466>
- perf: io-parallelization [INS-3911] by @CurryYangxx in <https://github.com/Kong/insomnia/pull/7458>
- fix: minor typo in interpolator by @pimothyxd in <https://github.com/Kong/insomnia/pull/7473>
- fix: websocket subprotocols by @arbezerra in <https://github.com/Kong/insomnia/pull/7472>
- fix: add a missing assertion chain for the response entity - INS-3917 by @ihexxa in <https://github.com/Kong/insomnia/pull/7474>
- fix: Application Error when login failed [INS-3955] by @CurryYangxx in <https://github.com/Kong/insomnia/pull/7475>
- chore: bake inso-cli on older macos [INS-3931] by @filfreire in <https://github.com/Kong/insomnia/pull/7471>
- ci[.github](SEC-1084): SLSA supply chain security controls by @saisatishkarra in <https://github.com/Kong/insomnia/pull/7479>
- :rocket: 9.3.0-alpha.2 by @insomnia-infra in <https://github.com/Kong/insomnia/pull/7485>
- :rocket: 9.3.0-alpha.3 by @insomnia-infra in <https://github.com/Kong/insomnia/pull/7487>
- release message by @jackkav in <https://github.com/Kong/insomnia/pull/7483>
- :rocket: 9.3.0-alpha.4 by @insomnia-infra in <https://github.com/Kong/insomnia/pull/7489>
- feat: add fetch timeout [INS-3911] by @CurryYangxx in <https://github.com/Kong/insomnia/pull/7467>
- feat(Key-Value Editor): Improve accessibility and make the items re-orderable by @gatzjames in <https://github.com/Kong/insomnia/pull/7465>
- fix: add jsonSchema assertion chain by @ihexxa in <https://github.com/Kong/insomnia/pull/7481>
- chore: rename variable properties to improve readability by @ihexxa in <https://github.com/Kong/insomnia/pull/7480>
- fix(Response Tabs): Tabs with a menu inside are not accessible - Response Panes by @gatzjames in <https://github.com/Kong/insomnia/pull/7477>
- fix: script to parse binary digests by @saisatishkarra in <https://github.com/Kong/insomnia/pull/7493>
- :rocket: 9.3.0-alpha.5 by @insomnia-infra in <https://github.com/Kong/insomnia/pull/7494>
- feat: folder inheritance  scripts by @jackkav in <https://github.com/Kong/insomnia/pull/7430>
- fix: use base64 output file for provenance for large assets by @saisatishkarra in <https://github.com/Kong/insomnia/pull/7496>
- Bump/electron-30 by @jackkav in <https://github.com/Kong/insomnia/pull/7354>
- chore: new analytics events [INS-3938] by @filfreire in <https://github.com/Kong/insomnia/pull/7495>
- chore: add analytics test [INS-3919] by @filfreire in <https://github.com/Kong/insomnia/pull/7478>
- fix variable names for provenance digest by @saisatishkarra in <https://github.com/Kong/insomnia/pull/7498>
- :rocket: 9.3.0-alpha.7 by @insomnia-infra in <https://github.com/Kong/insomnia/pull/7499>
- fix glob patterns for release assets by @saisatishkarra in <https://github.com/Kong/insomnia/pull/7501>
- :rocket: 9.3.0-alpha.8 by @insomnia-infra in <https://github.com/Kong/insomnia/pull/7502>
- feat: enable importing folder-level scripts by @ihexxa in <https://github.com/Kong/insomnia/pull/7504>
- feat: Import/folder-auth by @jackkav in <https://github.com/Kong/insomnia/pull/7505>
- verbose notarize by @jackkav in <https://github.com/Kong/insomnia/pull/7500>
- chore: new segment event (invite) [INS-3938] by @filfreire in <https://github.com/Kong/insomnia/pull/7506>
- disable nunjucks in mock route by @jackkav in <https://github.com/Kong/insomnia/pull/7510>
- auto update changelog after release by @jackkav in <https://github.com/Kong/insomnia/pull/7417>
- chore(Database types): Infer query params from database model by @gatzjames in <https://github.com/Kong/insomnia/pull/7512>
- :rocket: 9.3.0-beta.1 by @insomnia-infra in <https://github.com/Kong/insomnia/pull/7513>
- :rocket: 9.3.0-alpha.9 by @insomnia-infra in <https://github.com/Kong/insomnia/pull/7514>
- :rocket: 9.3.0-beta.2 by @insomnia-infra in <https://github.com/Kong/insomnia/pull/7515>
- fix: windows paths release-publish [no-ticket] by @filfreire in <https://github.com/Kong/insomnia/pull/7516>
- import scripts into collection folder by @jackkav in <https://github.com/Kong/insomnia/pull/7518>
- fix: url preview should contain auth params by @ihexxa in <https://github.com/Kong/insomnia/pull/7509>
- include read only in headers count by @jackkav in <https://github.com/Kong/insomnia/pull/7521>
- remove oas 2 kong by @jackkav in <https://github.com/Kong/insomnia/pull/7503>
- fix: windows artifact and update code signer [INS-3993][INS-3982] by @filfreire in <https://github.com/Kong/insomnia/pull/7523>
- :rocket: 9.3.0-alpha.11 by @insomnia-infra in <https://github.com/Kong/insomnia/pull/7524>
- :rocket: 9.3.0-beta.3 by @insomnia-infra in <https://github.com/Kong/insomnia/pull/7526>
- chore(Minor UI improvements): Expand/Collapse all and file card titles by @gatzjames in <https://github.com/Kong/insomnia/pull/7528>
- :rocket: 9.3.0-beta.4 by @insomnia-infra in <https://github.com/Kong/insomnia/pull/7530>
- move env editor to folder tab by @jackkav in <https://github.com/Kong/insomnia/pull/7534>
- folder sections by @jackkav in <https://github.com/Kong/insomnia/pull/7488>
- can create local mocks in enterprise plan by @jackkav in <https://github.com/Kong/insomnia/pull/7538>
- fix: onboarding typo by @Ahavaz in <https://github.com/Kong/insomnia/pull/7537>
- fix(Key-Value Editor): UX improvements and bugfix for empty state by @gatzjames in <https://github.com/Kong/insomnia/pull/7541>
- fix(Error View): fix loading state for logout button in error view by @gatzjames in <https://github.com/Kong/insomnia/pull/7545>
- :rocket: 9.3.0-beta.5 by @insomnia-infra in <https://github.com/Kong/insomnia/pull/7549>
- improve plugin install ux by @jackkav in <https://github.com/Kong/insomnia/pull/7542>
- consistent dropdown layout by @jackkav in <https://github.com/Kong/insomnia/pull/7536>
- spike: proxy error on login [INS-4009] by @filfreire in <https://github.com/Kong/insomnia/pull/7546>
- feat: display status of sending request steps - INS-3635 by @ihexxa in <https://github.com/Kong/insomnia/pull/7382>
- fix: always take the latest operation name instead of prev state's by @ihexxa in <https://github.com/Kong/insomnia/pull/7553>
- feat(Global Environments): Introduce a new top level file type called global environments. by @gatzjames in <https://github.com/Kong/insomnia/pull/7511>
- fix(Sync): Do not show conflicts for empty keys by @gatzjames in <https://github.com/Kong/insomnia/pull/7556>
- fix: add missing methods depending on the interpolator - INS-3966 by @ihexxa in <https://github.com/Kong/insomnia/pull/7560>
- tidy warnings by @jackkav in <https://github.com/Kong/insomnia/pull/7566>
- transform hyphens to underscores on import by @jackkav in <https://github.com/Kong/insomnia/pull/7564>
- fix(Permissions Error): Permissions error was persisting after switching organizations by @gatzjames in <https://github.com/Kong/insomnia/pull/7544>
- :rocket: 9.3.0-beta.6 by @insomnia-infra in <https://github.com/Kong/insomnia/pull/7569>
- Update "Mock API" in README by @cootshk in <https://github.com/Kong/insomnia/pull/7572>
- Replace export data and more with Preferences by @jackkav in <https://github.com/Kong/insomnia/pull/7570>
- export should show on scratchpad by @jackkav in <https://github.com/Kong/insomnia/pull/7571>
- Markdown-inlined by @jackkav in <https://github.com/Kong/insomnia/pull/7554>
- normalise json path by @jackkav in <https://github.com/Kong/insomnia/pull/7575>
- feat(Environment Picker): Simplify the UI by @gatzjames in <https://github.com/Kong/insomnia/pull/7574>
- inso clean up by @jackkav in <https://github.com/Kong/insomnia/pull/7578>
- inso remove deprecated option by @jackkav in <https://github.com/Kong/insomnia/pull/7579>
- fix: can not undo changes after switching between requests by @ihexxa in <https://github.com/Kong/insomnia/pull/7583>
- fix(KeyValue Editor): Pressing enter on an input should update the value by @gatzjames in <https://github.com/Kong/insomnia/pull/7580>
- feat(Global Environments): Update workpsace settings modal for environment settings by @gatzjames in <https://github.com/Kong/insomnia/pull/7585>
- 9-3-quick-fixes by @jackkav in <https://github.com/Kong/insomnia/pull/7586>
- refactor: enable active global environment and map it to the sdk by @ihexxa in <https://github.com/Kong/insomnia/pull/7533>
- fix(Environment Picker): Fix selecting No global environment by @gatzjames in <https://github.com/Kong/insomnia/pull/7590>
- Inso-third-pass by @jackkav in <https://github.com/Kong/insomnia/pull/7588>
- :rocket: 9.3.0-beta.7 by @insomnia-infra in <https://github.com/Kong/insomnia/pull/7591>
- snap store login by @jackkav in <https://github.com/Kong/insomnia/pull/7593>
- fix(key-value editor): Fix locked focus when the autocomplete is open and improve styling by @gatzjames in <https://github.com/Kong/insomnia/pull/7597>
- chore(publish): move snap and deb publish steps to the end by @gatzjames in <https://github.com/Kong/insomnia/pull/7599>
- upgrade inso pkgs by @jackkav in <https://github.com/Kong/insomnia/pull/7592>

## New Contributors

- @pimothyxd made their first contribution in <https://github.com/Kong/insomnia/pull/7473>

- @arbezerra made their first contribution in <https://github.com/Kong/insomnia/pull/7472>
- @Ahavaz made their first contribution in <https://github.com/Kong/insomnia/pull/7537>
- @cootshk made their first contribution in <https://github.com/Kong/insomnia/pull/7572>

**Full Changelog**: <https://github.com/Kong/insomnia/compare/core@9.2.0...core@9.3.0>

## [core@9.2.0] - 2024-05-15

### What's Changed

- Types/ipc-channels by @jackkav in <https://github.com/Kong/insomnia/pull/7379>
- fix(analytics): add missing session id by @gatzjames in <https://github.com/Kong/insomnia/pull/7389>
- point changelog url at releases by @jackkav in <https://github.com/Kong/insomnia/pull/7387>
- fix: add missing 9.1.1 changelog [no-ticket] by @filfreire in <https://github.com/Kong/insomnia/pull/7392>
- fixes codemirror measure issue by @jackkav in <https://github.com/Kong/insomnia/pull/7391>
- fix: extract correct position through err message by @CurryYangxx in <https://github.com/Kong/insomnia/pull/7398>
- fix(ui): Misalignments in the UI by @gatzjames in <https://github.com/Kong/insomnia/pull/7400>
- fix: environment edit modal save by @oahmed-OS in <https://github.com/Kong/insomnia/pull/7371>
- perf: improve performance when spec lint [INS-3724] by @CurryYangxx in <https://github.com/Kong/insomnia/pull/7374>
- improve VCS api by @jackkav in <https://github.com/Kong/insomnia/pull/7404>
- Feat: add-faker by @jackkav in <https://github.com/Kong/insomnia/pull/7390>
- fix(Preferences): Error when there is no active project in the preferences data tab by @gatzjames in <https://github.com/Kong/insomnia/pull/7406>
- feat(command-palette): Add global search for unsynced files by @gatzjames in <https://github.com/Kong/insomnia/pull/7405>
- only prompt with private envs by @jackkav in <https://github.com/Kong/insomnia/pull/7407>
- fix(Project): Show errors when something goes wrong while updating projects by @gatzjames in <https://github.com/Kong/insomnia/pull/7412>
- fix(Spec): Expand lint errors and hide the preview pane appropriately by @gatzjames in <https://github.com/Kong/insomnia/pull/7413>
- fix(CloudSync Pull): Fix issue where workspaces could change parentId on pull by @gatzjames in <https://github.com/Kong/insomnia/pull/7414>
- fix(UI): add titles to some elements in Test view by @filfreire in <https://github.com/Kong/insomnia/pull/7416>

## New Contributors

- @oahmed-OS made their first contribution in <https://github.com/Kong/insomnia/pull/7371>

**Full Changelog**: <https://github.com/Kong/insomnia/compare/core@9.1.1...core@9.2.0>

## [core@9.1.1] - 2024-05-07

## What's Changed

- unify all app requests behind a common api convention by @jackkav in <https://github.com/Kong/insomnia/pull/7338>
- reduce reload noise coming from learning feature by @jackkav in <https://github.com/Kong/insomnia/pull/7346>
- remove read only pairs from all kvp editors by @jackkav in <https://github.com/Kong/insomnia/pull/7351>
- network-cleanup by @jackkav in <https://github.com/Kong/insomnia/pull/7355>
- fix: should not refetch as much [INS-3817] by @jackkav in <https://github.com/Kong/insomnia/pull/7377>
- fix(project-data): Move remote file fetching outside the main path by @gatzjames in <https://github.com/Kong/insomnia/pull/7378>

**Full Changelog**: <https://github.com/Kong/insomnia/compare/core@9.1.0...core@9.1.1>

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
