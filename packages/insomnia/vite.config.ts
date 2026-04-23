import fs from 'node:fs';
import { builtinModules } from 'node:module';
import path from 'node:path';

import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import * as ts from 'typescript';
import { defineConfig, type ResolvedConfig } from 'vite';

import pkg from './package.json';
import { electronNodeRequire } from './vite-plugin-electron-node-require';
//These will be excluded from the bundle and remain as runtime dependencies
export const externalDependencies = ['@apidevtools/swagger-parser', 'mocha', 'tough-cookie'];
export default defineConfig(({ mode }) => {
  const __DEV__ = mode !== 'production';

  return {
    define: {
      '__DEV__': JSON.stringify(__DEV__),
      'process.env.NODE_ENV': JSON.stringify(mode),
      'process.env.INSOMNIA_ENV': JSON.stringify(mode),
    },
    server: {
      port: pkg.dev['dev-server-port'],
      warmup: {
        clientFiles: [
          // https://github.com/remix-run/react-router/issues/12786#issuecomment-2634033513
          './src/components/**/*',
          './src/entry.client.tsx',
          './src/root.tsx',
          './src/routes/**/*',
          '!**/*.server.ts',
        ],
      },
    },

    build: {
      target: 'esnext',
      sourcemap: true,
      rollupOptions: {
        external: ['@getinsomnia/node-libcurl'],
      },
    },
    optimizeDeps: {
      exclude: ['@getinsomnia/node-libcurl'],
      force: true, // wipe vite cache
      include: ['codemirror-graphql/utils/SchemaReference', '@stoplight/spectral-core', 'isomorphic-git'],
    },
    resolve: {
      alias: {
        '~': path.resolve(__dirname, './src'),
      },
    },
    plugins: [
      // Allows us to import modules that will be resolved by Node's require() function.
      // e.g. import fs from 'fs'; will get transformed to const fs = require('fs'); so that it works in the renderer process.
      // This is necessary because we use nodeIntegration: true in the renderer process and allow importing modules from node.
      electronNodeRequire({
        modules: [
          'electron',
          ...externalDependencies,
          ...builtinModules.filter(m => m !== 'buffer'),
          ...builtinModules.map(m => `node:${m}`),
        ],
      }),
      reactRouter(),
      tailwindcss(),
      DetectNodeBuiltinImports(),
    ],
    worker: {
      format: 'es',
    },
  };
});

const NODE_BUILTIN_REPORT_ENV = 'INSOMNIA_NODE_IMPORT_REPORT';
const NODE_BUILTIN_REPORT_FILE = path.resolve(__dirname, '.reports', 'renderer-node-imports.json');
const VIRTUAL_NODE_PREFIX = 'virtual:external:node:';

export const normalizeModuleIdForFs = (id: string) => {
  const suffixIndex = id.search(/[?#]/);
  return suffixIndex === -1 ? id : id.slice(0, suffixIndex);
};

type ImportKind = 'dynamic-import' | 'export' | 'import' | 'require';

interface ImportLocation {
  column: number;
  kind: ImportKind;
  line: number;
  statement: string;
}

interface NodeBuiltinImportRecord {
  builtin: string;
  importer: string;
  locations: ImportLocation[];
  rawSpecifiers: string[];
}

function DetectNodeBuiltinImports() {
  const builtins = new Set(builtinModules);
  let isSsrBuild = false;
  const records = new Map<string, NodeBuiltinImportRecord>();
  const reportEnabled = process.env[NODE_BUILTIN_REPORT_ENV] === '1';
  const seenTransforms = new Set<string>();

  const normalizeSpecifier = (source: string) => {
    const strippedSource = source.startsWith(VIRTUAL_NODE_PREFIX) ? source.slice(VIRTUAL_NODE_PREFIX.length) : source;
    return strippedSource.startsWith('node:') ? strippedSource.slice(5) : strippedSource;
  };

  const mergeLocations = (existing: ImportLocation[], incoming: ImportLocation[]) => {
    const seen = new Set(
      existing.map(location => `${location.kind}:${location.line}:${location.column}:${location.statement}`),
    );

    for (const location of incoming) {
      const key = `${location.kind}:${location.line}:${location.column}:${location.statement}`;
      if (!seen.has(key)) {
        existing.push(location);
        seen.add(key);
      }
    }
  };

  const getScriptKind = (filePath: string) => {
    if (filePath.endsWith('.tsx')) {
      return ts.ScriptKind.TSX;
    }

    if (filePath.endsWith('.ts')) {
      return ts.ScriptKind.TS;
    }

    if (filePath.endsWith('.jsx')) {
      return ts.ScriptKind.JSX;
    }

    return ts.ScriptKind.JS;
  };

  const getStatementText = (sourceFile: ts.SourceFile, node: ts.Node) => {
    return node
      .getText(sourceFile)
      .split('\n')
      .map(line => line.trim())
      .join(' ');
  };

  const addLocation = (
    locationsByBuiltin: Map<string, { locations: ImportLocation[]; rawSpecifiers: Set<string> }>,
    specifier: string,
    sourceFile: ts.SourceFile,
    node: ts.Node,
    kind: ImportKind,
  ) => {
    const normalizedSpecifier = normalizeSpecifier(specifier);
    if (!builtins.has(normalizedSpecifier)) {
      return;
    }

    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const location: ImportLocation = {
      line: line + 1,
      column: character + 1,
      kind,
      statement: getStatementText(sourceFile, node),
    };

    const entry = locationsByBuiltin.get(normalizedSpecifier) ?? { locations: [], rawSpecifiers: new Set<string>() };
    entry.locations.push(location);
    entry.rawSpecifiers.add(specifier);
    locationsByBuiltin.set(normalizedSpecifier, entry);
  };

  const collectNodeBuiltinImports = (importer: string, sourceText: string) => {
    const locationsByBuiltin = new Map<string, { locations: ImportLocation[]; rawSpecifiers: Set<string> }>();
    const sourceFile = ts.createSourceFile(importer, sourceText, ts.ScriptTarget.Latest, true, getScriptKind(importer));

    const visit = (node: ts.Node) => {
      if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly && ts.isStringLiteral(node.moduleSpecifier)) {
        addLocation(locationsByBuiltin, node.moduleSpecifier.text, sourceFile, node, 'import');
      }

      if (
        ts.isExportDeclaration(node) &&
        !node.isTypeOnly &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        addLocation(locationsByBuiltin, node.moduleSpecifier.text, sourceFile, node, 'export');
      }

      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'require' &&
        node.arguments.length > 0 &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        addLocation(locationsByBuiltin, node.arguments[0].text, sourceFile, node, 'require');
      }

      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments.length > 0 &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        addLocation(locationsByBuiltin, node.arguments[0].text, sourceFile, node, 'dynamic-import');
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return locationsByBuiltin;
  };

  const recordNodeBuiltinImports = (importer: string, sourceText: string) => {
    const relativeImporter = path.relative(process.cwd(), importer);
    const importsByBuiltin = collectNodeBuiltinImports(importer, sourceText);

    for (const [builtin, entry] of importsByBuiltin) {
      const recordKey = `${relativeImporter}::${builtin}`;
      const existingRecord = records.get(recordKey);

      if (existingRecord) {
        mergeLocations(existingRecord.locations, entry.locations);
        for (const rawSpecifier of entry.rawSpecifiers) {
          if (!existingRecord.rawSpecifiers.includes(rawSpecifier)) {
            existingRecord.rawSpecifiers.push(rawSpecifier);
          }
        }
      } else {
        records.set(recordKey, {
          builtin,
          importer: relativeImporter,
          locations: [...entry.locations],
          rawSpecifiers: [...entry.rawSpecifiers],
        });
      }
    }

    if (importsByBuiltin.size === 0) {
      return;
    }
  };

  const writeReport = () => {
    const report = [...records.values()]
      .sort((left, right) => left.importer.localeCompare(right.importer) || left.builtin.localeCompare(right.builtin))
      .map(record => ({
        builtin: record.builtin,
        importer: record.importer,
        locations: record.locations.sort((left, right) => left.line - right.line || left.column - right.column),
        rawSpecifiers: [...record.rawSpecifiers].sort(),
      }));

    fs.mkdirSync(path.dirname(NODE_BUILTIN_REPORT_FILE), { recursive: true });
    fs.writeFileSync(
      NODE_BUILTIN_REPORT_FILE,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          recordCount: report.length,
          records: report,
        },
        null,
        2,
      ),
    );

    if (report.length === 0) {
      console.warn(
        `No renderer Node builtin imports found. Report written to ${path.relative(process.cwd(), NODE_BUILTIN_REPORT_FILE)}`,
      );
      return;
    }

    console.warn('Renderer Node builtin import report:');
    for (const record of report) {
      const locationSummary = record.locations
        .map(location => `${location.line}:${location.column} ${location.kind}`)
        .join(', ');
      console.warn(`- ${record.importer}`);
      console.warn(`  ${record.builtin} via ${record.rawSpecifiers.join(', ')} at ${locationSummary}`);
    }
    console.warn(`Report written to ${path.relative(process.cwd(), NODE_BUILTIN_REPORT_FILE)}`);
  };

  return {
    name: 'detect-node-builtin-imports',
    enforce: 'pre' as const,

    configResolved(config: ResolvedConfig) {
      isSsrBuild = Boolean(config.build.ssr);
    },

    transform(code: string, id: string, options?: { ssr?: boolean }) {
      if (!reportEnabled) return null;
      if (isSsrBuild) return null;
      if (options?.ssr) return null;
      if (id.includes('node_modules')) return null;
      const normalizedId = normalizeModuleIdForFs(id);
      if (!path.isAbsolute(normalizedId) || !fs.existsSync(normalizedId)) return null;
      if (seenTransforms.has(normalizedId)) return null;

      seenTransforms.add(normalizedId);
      recordNodeBuiltinImports(normalizedId, code);
      return null;
    },

    closeBundle() {
      if (isSsrBuild) {
        return;
      }

      if (!reportEnabled) {
        return;
      }

      writeReport();
    },
  };
}
