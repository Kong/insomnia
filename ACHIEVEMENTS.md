# Contributions to Insomnia — Jack Kavanagh

> 746 commits across ~5 years on [Kong/Insomnia](https://github.com/Kong/insomnia), an open-source API client used by millions of developers. Work spans features, architecture, tooling, performance, and security.

---

# 2021

_First contributions (Aug–Dec). Focus on build tooling, testing infrastructure, and developer experience for Kong's config generation pipeline._

## TypeScript Migration

Spiked and landed the transition from Flow to TypeScript using `babel-preset-typescript` for the main application package. This unblocked a multi-year incremental migration to a strongly-typed codebase, improving maintainability and IDE tooling for all contributors.

## Testing Infrastructure Overhaul

Replaced the deprecated Spectron testing framework with Playwright for end-to-end tests. This future-proofed the test suite against Electron upgrades and enabled more reliable, cross-platform smoke testing.

## Electron Upgrade (v12)

Landed the Electron v12 upgrade and refactored the app to comply with new security requirements around native module loading — specifically disabling native modules in the renderer process to reduce the attack surface of the Electron app.

## Kong Config Generation Improvements

Extended the `inso generate config` CLI command with a `--format` option, allowing users to output Kong declarative config as either JSON or YAML. Also improved the config generator plugin API to expose documentation links, improving the experience for Kong Gateway users automating their API lifecycle.

## Build Tooling

Reduced Webpack noise in CI/dev output, streamlined the build pipeline by removing the convenience bundle, and cleaned up lint caching — all reducing friction for contributors.

---

# 2022

_150 commits. The largest architectural year: modernised the entire React codebase, hardened security, added WebSocket features, and significantly improved the gRPC experience._

## React Modernisation (Class → Functional Components)

Led a systematic, component-by-component migration of the entire UI from legacy class components to modern React functional components with hooks. This touched 30+ components including the code editor, response pane, sidebar, modals, environment editor, git sync modals, settings, and more. The result was a lighter, more testable, and easier-to-maintain codebase that enabled adoption of modern React patterns going forward.

## Redux Removal

Started the multi-phase project to eliminate Redux from the application state model. Moved analytics, loading state, and gRPC request handling out of Redux, reducing the global state surface area and making data flow easier to reason about.

## Electron Security & Process Architecture

Moved Electron APIs out of the renderer process and into the main process, significantly reducing the renderer's privilege level. This is a critical security improvement for Electron apps, limiting the blast radius of any renderer-side vulnerability.

## WebSocket Enhancements

Added WebSocket subprotocol support, showed live connection state in the sidebar, and enabled team sync for WebSocket requests — bringing feature parity between WebSocket and HTTP request workflows.

## gRPC Server Reflection

Implemented gRPC server reflection support, allowing users to introspect a gRPC server's available methods without needing to provide `.proto` files manually. Added CA certificate support for secure gRPC connections, improving compatibility with enterprise environments.

## Analytics Migration (GA → Segment)

Migrated the analytics pipeline from Google Analytics to Segment, moving event tracking to the renderer process. Added tracking for HTTP version and auth type, improving product telemetry quality.

## Custom Spectral Ruleset Support (inso CLI)

Extended the `inso` CLI's linting capability to support custom Spectral rulesets, allowing teams to enforce their own API design rules in CI pipelines alongside the defaults.

## CA Certificate Support

Added CA certificate support for HTTPS requests, enabling users in corporate environments with custom certificate authorities to use Insomnia without SSL errors.

---

# 2023

_238 commits. Highest-volume year. Shipped major user-facing features including SSE/EventStream, multi-window, auto-backup, and the Paste from cURL workflow. Completed the Redux→Remix routing migration._

## SSE / Server-Sent Events Support

Implemented full Server-Sent Events (SSE / EventStream) support, allowing developers to test real-time streaming APIs directly in Insomnia. This filled a significant gap for users building event-driven backends.

## Multi-Window Support

Added the ability to open a second Insomnia window, a commonly requested feature for users who want to work across multiple workspaces or requests simultaneously.

## Paste from cURL

Shipped a "Paste from cURL" workflow — users can paste a cURL command directly into the app and have it automatically converted into a full request. Also added a dedicated cURL paste modal with a preview. This dramatically lowers the friction for importing requests from browser DevTools or documentation.

## Auto-Backup on Update

Added an automatic database backup performed before each in-app update, protecting users from data loss during upgrades. Also improved the in-app update UX with clearer messaging and a reduced 10-second delay.

## Redux → Remix Routing (Completion)

Completed the multi-phase elimination of Redux by migrating the remaining workspace and request state to React Router (Remix-style file-based routing). This removed thousands of lines of boilerplate, simplified navigation, and laid the groundwork for future deep-linking and URL-based navigation.

## OAuth2 Refactor

Refactored the OAuth2 authentication flow to decouple it from the database layer and fix several correctness issues including optional redirect URI handling, token/type defaults, and cookie setter bugs. Reduced Sentry error volume by fixing a root cause responsible for 248,000 reported errors.

## Import Improvements

Added support for importing files containing multiple workspaces at once. Fixed `$refs` dereferencing and flattening in `inso`, improving compatibility with complex multi-file OpenAPI specs.

## Folder Duplicate & Export Fixes

Added folder duplication to the request tree context menu, and fixed export behaviour for requests outside the main workspace — small but frequently requested quality-of-life improvements.

## TypeScript 5 Upgrade

Upgraded the codebase to TypeScript 5, enabling use of newer language features and improving type-checking strictness across the project.

---

# 2024

_206 commits. Focused on making `inso` CLI a first-class CI/CD tool with scripting and collection runner, and on technical debt reduction (styled-components removal, Vitest migration)._

## inso CLI Collection Runner

Implemented a full collection runner for the `inso` CLI, allowing users to run an entire Insomnia collection against an environment from the command line. This is foundational for API testing in CI/CD pipelines, enabling teams to automate regression testing of their APIs on every deployment.

## After-Response Scripting (CLI)

Added support for after-response scripts in the `inso` CLI, bringing parity with Postman's test scripting model. Users can now write JavaScript that runs after each request to validate responses, extract values, or chain requests — all executable in CI without a GUI.

## inso CLI: Folder Auth Inheritance

Implemented parent folder authentication inheritance in `inso`, so requests nested inside authenticated folders correctly pick up their auth config when run from the CLI. Previously, users had to configure auth on every individual request.

## inso CLI: Environment Variable Overrides

Added `--env-var` flag support to `inso`, allowing users to override specific environment variable values at runtime from the command line. This is essential for CI where secrets should not be stored in committed environment files.

## Mock Server Improvements

Added method-based routing to the mock server, improved tab rendering on mock route changes, and added `x-mock-method` header support — improving the reliability and expressiveness of Insomnia's built-in mock server.

## Remove styled-components

Removed `styled-components` from the entire application, replacing it with utility-class and CSS module patterns. This reduced bundle size, eliminated a runtime CSS-in-JS dependency, and improved rendering performance.

## Vitest Migration

Migrated the test suite from Jest to Vitest, aligning tests with the Vite build toolchain and significantly improving test run speed.

## SDK Type Checking

Added TypeScript type checking to the SDK package, catching contract violations at compile time and improving developer experience for plugin authors.

## Playwright Improvements

Refactored the CI test pipeline to run app and CLI tests in parallel, improving CI feedback loop speed.

---

# 2025

_105 commits. Emphasis on performance, security hardening, and developer tooling modernisation._

## Templating Moved to Web Worker

Moved the default Nunjucks template rendering engine into a Web Worker, offloading CPU-intensive templating from the main thread. This improves UI responsiveness when working with large requests or complex environment variables.

## Spec Linting in Utility Process

Moved OpenAPI spec linting (Spectral) into a dedicated Electron utility process, isolating it from the renderer process. This improves performance for large specs and increases security by reducing what the renderer process can access.

## Security: Disable Node Integration in Workers

Disabled Node.js integration in worker processes, reducing the privilege level of background workers. This follows Electron's security best practices and reduces the attack surface of the application.

## Security: Sensitive File Access Wrapping

Wrapped all sensitive `readFile` calls in a security boundary (INS-1442), ensuring file system access is auditable and controllable — an important hardening step for enterprise deployments.

## ESLint v9 Migration

Migrated the entire codebase to ESLint v9 with the new flat config format, added new lint rules (unicorn, unused vars, strict mode), and ran full auto-fix passes. This modernised the linting pipeline and enforced a more consistent code style across the monorepo.

## Vite v6 & v7 Upgrades

Upgraded the build toolchain to Vite v6 and subsequently v7, keeping the build pipeline on the latest supported major and benefiting from build performance and compatibility improvements.

## Replace lodash with es-toolkit

Replaced the `lodash` utility library with the modern, tree-shakeable `es-toolkit`, reducing bundle size and removing a commonly flagged dependency from security audits.

## Electron Upgrade Series (33 → 38)

Landed four major Electron upgrades (v33, v36, v37, v38) across the year, keeping the app on a supported and secure runtime, adapting to API changes, and maintaining compatibility with the latest Chromium and Node.js versions bundled with each release.

## CI: Playwright Warning Fixes & 10% CI Time Reduction

Fixed all outstanding Playwright test warnings and restructured the CI pipeline, cutting total CI run time by 10% — improving developer iteration speed across the team.

## TypeScript & Database Improvements

Improved TypeScript strictness across the database layer, pruned unused DB methods, improved type-checking of model queries, and removed legacy hacks (e.g. `fromSync` workaround). This reduced the chance of runtime data model errors and made the DB API easier to work with.

## Prettier Standardisation

Ran a full Prettier formatting pass across the entire codebase and enforced it in CI, eliminating formatting noise from code review diffs going forward.

---

# 2026

_20 commits (Jan–Feb). Import UX overhaul, with a focus on making cURL import a first-class, friction-free workflow._

## cURL Import Overhaul

Externalised the cURL conversion logic to the `curlconverter` library, gaining significantly more accurate and comprehensive parsing of cURL commands. Added support for:
- **Multipart form data** in cURL imports
- **Multiple content types** via mime-type detection
- **Semicolon-separated arguments**

This substantially improves the accuracy of curl-to-request conversion, which is one of the most common onboarding paths for new users.

## Import UX: Lower Friction

Reduced the number of steps required to import a collection or spec, making the import flow faster and more discoverable for new users.

## OAS Import: Preserve Requests

Improved OpenAPI Spec import to create individual requests where possible, rather than only importing as a design document — bridging the gap between spec-first and request-first workflows.

## Deep Link Improvements

Added support for curl import via deep link (allowing external tools to open Insomnia with a pre-populated cURL command), added navigation to the imported workspace post-import, and hardened the deep link handler to block unsafe import URLs when the user is logged out.
