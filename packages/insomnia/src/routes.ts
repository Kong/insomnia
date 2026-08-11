import { flatRoutes } from '@react-router/fs-routes';

// Exclude colocated unit tests (`*.test.ts`) from route discovery. Without this,
// flatRoutes() treats every file under `routes/` as a route module, so a test file
// importing Node-only code (e.g. `~/main/database.main`) gets pulled into the
// browser production bundle and breaks the build.
// NOTE: only `.test.ts` is ignored, not `.test.tsx` — some real routes end their
// last URL segment in literally "test" (e.g. the unit-testing feature's
// `...workspace.$workspaceId.test.tsx`), and those are `.tsx` files.
export default flatRoutes({
  ignoredRouteFiles: ['**/*.test.ts'],
});
