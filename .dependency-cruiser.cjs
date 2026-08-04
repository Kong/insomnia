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
