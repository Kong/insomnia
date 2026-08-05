/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'insomnia-data-no-electron',
      comment:
        'insomnia-data must stay usable from both the renderer and Node/CLI contexts. Importing electron ' +
        'directly would break that and inject Electron types into non-Electron consumers.',
      severity: 'warn',
      from: { path: '^packages/insomnia-data' },
      to: { path: '^(node_modules/)?electron($|/)' },
    },
    {
      name: 'routes-ui-no-direct-database-access',
      comment:
        'Routes and UI code should read/write through insomnia-data services rather than the raw ' +
        'database port, so query logic stays centralized and swappable.',
      severity: 'warn',
      from: { path: '(^|/)src/(routes|ui)/' },
      to: { path: '(^|/)src/common/database\\.ts$' },
    },
    {
      name: 'domain-no-outward-deps',
      comment:
        'domain is the hexagon center: pure business logic with zero dependency on application, ' +
        'infrastructure, any app, or Electron/transport libs. Everything else depends on domain, never ' +
        'the reverse.',
      severity: 'warn',
      from: { path: '^domain/' },
      to: { path: '^(application|infrastructure|apps)/|^(node_modules/)?electron($|/)' },
    },
    {
      name: 'application-domain-only',
      comment:
        'application orchestrates domain entities/repositories and depends on domain only - never ' +
        'infrastructure (concrete adapters) or a specific app.',
      severity: 'warn',
      from: { path: '^application/' },
      to: { path: '^(infrastructure|apps)/' },
    },
    {
      name: 'infrastructure-no-application-or-apps',
      comment:
        'infrastructure implements domain-defined ports and depends on domain plus external libs/' +
        'Electron/Node - never application (that direction is backwards) or a specific app (infrastructure ' +
        'is reached from an app\'s bootstrap/wiring code, not the other way around).',
      severity: 'warn',
      from: { path: '^infrastructure/' },
      to: { path: '^(application|apps)/' },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    exclude: {
      path: '(\\.test\\.tsx?$|__tests__|__mocks__|node_modules)',
    },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
};
