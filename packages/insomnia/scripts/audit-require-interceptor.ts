import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

/**
 * Audit script for require-interceptor.ts
 *
 * Compares the functions/exports currently whitelisted in require-interceptor.ts against
 * the actual live exports available in each package's current version.
 *
 * Usage:
 *   npm run sandbox:require:imports
 *   npm run sandbox:require:imports -- --json (for machine-readable output)
 *   or: npx esr packages/insomnia/scripts/audit-require-interceptor.ts
 *
 * Output:
 *   - Lists each intercepted module with counts of allowed vs. live exports
 *   - Shows missing exports (in live package, not whitelisted)
 *   - Shows stale exports (whitelisted but no longer in live package)
 *   - With --json flag, outputs structured JSON for AI/automation tools
 */

const INTERCEPTOR_PATH = path.resolve(__dirname, '../src/scripting/require-interceptor.ts');
const INSOMNIA_PKG_ROOT = path.resolve(__dirname, '..');
const MONOREPO_ROOT = path.resolve(INSOMNIA_PKG_ROOT, '../..');

interface ModuleAuditData {
  moduleName: string;
  allowedKeys: Set<string>;
  excludedKeys: Set<string>;
}

interface ModuleReport {
  moduleName: string;
  allowedKeys: Set<string>;
  liveKeys: Set<string>;
  missing: string[];
  stale: string[];
  excluded: string[];
  isModuleStale: boolean;
}

function collectObjectKeys(node: ts.ObjectLiteralExpression, prefix = ''): string[] {
  const keys: string[] = [];
  for (const prop of node.properties) {
    if (ts.isPropertyAssignment(prop) || ts.isMethodDeclaration(prop) || ts.isShorthandPropertyAssignment(prop)) {
      const name = (prop.name as any)?.text || (prop.name as any)?.escapedText;
      if (!name) continue;

      const fullKey = prefix ? `${prefix}.${name}` : name;

      if (ts.isPropertyAssignment(prop)) {
        let objectLit = prop.initializer;
        // Unwrap Object.freeze(...) or similar wrapper calls
        if (ts.isCallExpression(prop.initializer)) {
          const arg = prop.initializer.arguments[0];
          if (arg && ts.isObjectLiteralExpression(arg)) {
            objectLit = arg;
          }
        }
        // Recurse one level for nested objects
        if (ts.isObjectLiteralExpression(objectLit)) {
          keys.push(fullKey, ...collectObjectKeys(objectLit, fullKey));
        } else {
          keys.push(fullKey);
        }
      } else {
        keys.push(fullKey);
      }
    }
  }
  return keys;
}

function parseExcludedKeysPerModule(sourceText: string): Map<string, Set<string>> {
  const excluded = new Map<string, Set<string>>();
  const lines = sourceText.split('\n');
  let currentModule = '';

  for (const line of lines) {
    // Track which variable/module we're in (e.g., safeBuffer, safeAssert)
    const varMatch = line.match(/^const (safe\w+)\s*=/);
    if (varMatch) {
      currentModule = varMatch[1];
      if (!excluded.has(currentModule)) {
        excluded.set(currentModule, new Set());
      }
    }

    // Find unsafe comments: extract item names before any opening paren or description
    const unsafeMatch = line.match(/\/\/\s*(?:unsafe|EXCLUDED):\s*(.+)/);
    if (unsafeMatch && currentModule) {
      let content = unsafeMatch[1];
      // Remove description in parentheses: "addFormat (registers custom formats...)" -> "addFormat"
      content = content.replace(/\s*\([^)]*\).*$/, '');
      const items = content.split(',').map(item => item.trim()).filter(Boolean);
      items.forEach(item => excluded.get(currentModule)?.add(item));
    }
  }

  return excluded;
}

function isModuleUsedInCodebase(moduleName: string): boolean {
  try {
    execSync(`grep -r "${moduleName.replace(/"/g, '\\"')}" ${INSOMNIA_PKG_ROOT}/src --include="*.ts" --include="*.tsx" -q`, {
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}

function parseInterceptor(filePath: string): Map<string, ModuleAuditData> {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);

  const varMap = new Map<string, Set<string>>();
  const result = new Map<string, ModuleAuditData>();
  const excludedPerModule = parseExcludedKeysPerModule(sourceText);

  // First pass: collect all safe*Methods and safe* variables
  function firstPass(node: ts.Node): void {
    if (ts.isVariableDeclaration(node)) {
      const name = node.name.getText(sourceFile);
      if ((name.startsWith('safe') || name === 'safeAtob' || name === 'safeBtoa') && node.initializer) {
        if (ts.isObjectLiteralExpression(node.initializer)) {
          const keys = collectObjectKeys(node.initializer);
          varMap.set(name, new Set(keys));
        } else if (ts.isFunctionExpression(node.initializer)) {
          // Single function like safeAtob, safeBtoa
          varMap.set(name, new Set([name.replace('safe', '').toLowerCase()]));
        }
      }
    }
    ts.forEachChild(node, firstPass);
  }
  firstPass(sourceFile);

  // Second pass: resolve Proxy wrappers and transfer excluded keys
  function secondPass(node: ts.Node): void {
    if (ts.isVariableDeclaration(node)) {
      const name = node.name.getText(sourceFile);
      if (name.startsWith('safe') && node.initializer && ts.isNewExpression(node.initializer)) {
        const arg = node.initializer.arguments?.[0];
        if (arg && ts.isIdentifier(arg)) {
          const targetName = arg.text;
          const targetSet = varMap.get(targetName);
          if (targetSet && !varMap.has(name)) {
            varMap.set(name, new Set(targetSet));
          }
          // Transfer excluded keys from the target to the proxy
          const targetExcluded = excludedPerModule.get(targetName);
          if (targetExcluded) {
            excludedPerModule.set(name, new Set(targetExcluded));
          }
        }
      }
    }

    ts.forEachChild(node, secondPass);
  }

  secondPass(sourceFile);

  // Third pass: extract moduleMap entries
  function thirdPass(node: ts.Node): void {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(sourceFile) === 'moduleMap' &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      for (const prop of node.initializer.properties) {
        if (ts.isPropertyAssignment(prop)) {
          const moduleName = (prop.name as any)?.text || (prop.name as any)?.escapedText;
          if (!moduleName) continue;

          let varName = '';
          if (ts.isIdentifier(prop.initializer)) {
            varName = prop.initializer.text;
          }

          if (varName && varMap.has(varName)) {
            const allowedKeys = varMap.get(varName)!;
            const excludedKeys = excludedPerModule.get(varName) || new Set<string>();
            result.set(moduleName, {
              moduleName,
              allowedKeys,
              excludedKeys,
            });
          }
        }
      }
    }

    ts.forEachChild(node, thirdPass);
  }

  thirdPass(sourceFile);

  return result;
}

function resolvePackage(moduleName: string): string {
  const mapping: Record<string, string> = {
    'csv-parse/lib/sync': 'csv-parse/sync',
    lodash: 'es-toolkit/compat',
  };

  const resolved = mapping[moduleName] || moduleName;

  if (moduleName.startsWith('insomnia-') || moduleName === 'postman-collection') {
    return 'skip';
  }

  if (moduleName === 'atob' || moduleName === 'btoa') {
    return 'global';
  }

  // List of Node.js built-in modules
  const nodeBuiltins = [
    'assert', 'buffer', 'events', 'path', 'punycode', 'querystring',
    'stream', 'string_decoder', 'timers', 'url', 'util'
  ];

  if (nodeBuiltins.includes(resolved)) {
    return `node:${resolved}`;
  }

  try {
    return require.resolve(resolved, { paths: [INSOMNIA_PKG_ROOT, MONOREPO_ROOT] });
  } catch {
    return '';
  }
}

function getLiveKeys(moduleName: string, resolvedPath: string): Set<string> {
  if (resolvedPath === 'skip') {
    return new Set();
  }

  if (resolvedPath === 'global') {
    return new Set([moduleName]);
  }

  try {
    const mod = require(resolvedPath);

    const keys = new Set<string>();

    // Handle default export
    let target = mod;
    if (mod && typeof mod === 'object' && mod.default && moduleName === 'ajv') {
      target = mod.default;
    }

    // Special case: ajv instance methods
    if (moduleName === 'ajv' && typeof target === 'function') {
      try {
        const inst = new target();
        const protoKeys = Object.getOwnPropertyNames(Object.getPrototypeOf(inst)).filter(k => k !== 'constructor');
        protoKeys.forEach(k => keys.add(k));
        return keys;
      } catch {
        // Fallback to regular enumeration
      }
    }

    if (typeof target !== 'object' && typeof target !== 'function') {
      return keys;
    }

    // Enumerate top-level keys
    Object.keys(target).forEach(key => {
      if (key === '__esModule' || key === 'default') return;
      keys.add(key);

      // One-level recursion for nested objects (skip self-referential keys)
      const val = target[key];
      if (val && typeof val === 'object' && !Array.isArray(val) && typeof val !== 'function' && val !== target) {
        Object.keys(val).forEach(subKey => {
          keys.add(`${key}.${subKey}`);
        });
      }
    });

    return keys;
  } catch {
    // Silently return empty for unresolvable paths
    return new Set();
  }
}

function compare(auditData: ModuleAuditData, liveKeys: Set<string>): ModuleReport {
  // Check if a key is excluded, including namespace matching (e.g., if "tv4" is excluded, "tv4.xxx" is also excluded)
  const isExcluded = (key: string): boolean => {
    if (auditData.excludedKeys.has(key)) return true;
    // Check if this key is nested under an excluded namespace
    const namespace = key.split('.')[0];
    return auditData.excludedKeys.has(namespace);
  };

  const allMissing = Array.from(liveKeys).filter(k => !auditData.allowedKeys.has(k)).sort();
  const excluded = Array.from(auditData.excludedKeys).sort();
  const missing = allMissing.filter(k => !isExcluded(k)).sort();
  const allStale = Array.from(auditData.allowedKeys).filter(k => !liveKeys.has(k)).sort();
  const stale = allStale.filter(k => !isExcluded(k)).sort();
  const isModuleStale = !isModuleUsedInCodebase(auditData.moduleName);

  return {
    moduleName: auditData.moduleName,
    allowedKeys: auditData.allowedKeys,
    liveKeys,
    missing,
    stale,
    excluded,
    isModuleStale,
  };
}

function printReport(reports: ModuleReport[], jsonOutput: boolean): void {
  let totalMissing = 0;
  let totalStale = 0;
  let modulesWithGaps = 0;
  let staleModules = 0;

  for (const report of reports) {
    const hasMissing = report.missing.length > 0;
    const hasStale = report.stale.length > 0;

    if (hasMissing || hasStale) {
      modulesWithGaps++;
      totalMissing += report.missing.length;
      totalStale += report.stale.length;
    }

    if (report.isModuleStale) {
      staleModules++;
    }
  }

  if (jsonOutput) {
    const output = {
      modules: reports.map(report => ({
        name: report.moduleName,
        interceptor: report.allowedKeys.size,
        live: report.liveKeys.size,
        missing: report.missing,
        stale: report.stale,
        excluded: report.excluded,
        isFullyCovered: report.allowedKeys.size + report.excluded.length === report.liveKeys.size,
        isModuleStale: report.isModuleStale,
      })),
      summary: {
        modulesWithGaps,
        totalMissing,
        totalStale,
        staleModules,
        inSync: modulesWithGaps === 0 && staleModules === 0,
      },
    };
    console.log(JSON.stringify(output, null, 2));
  } else {
    for (const report of reports) {
      const hasMissing = report.missing.length > 0;
      const hasStale = report.stale.length > 0;
      const hasExcluded = report.excluded.length > 0;

      console.log(report.moduleName);
      if (report.isModuleStale) {
        console.log('  [stale: not used in codebase]');
      }

      // Main coverage line
      const coverageStr = `${report.allowedKeys.size}/${report.liveKeys.size}`;
      console.log(`  coverage: ${coverageStr}`);

      // Excluded section with count
      if (hasExcluded) {
        const excludedStr = report.excluded.join(', ');
        console.log(`  excluded: ${excludedStr} (${report.excluded.length})`);
      }

      // Missing section with count (only show if there are actual gaps)
      if (hasMissing) {
        const missingStr = report.missing.slice(0, 5).join(', ');
        const suffix = report.missing.length > 5 ? ` (+${report.missing.length - 5} more)` : '';
        console.log(`  missing: ${missingStr}${suffix} (${report.missing.length})`);
      } else if (!hasMissing && !hasStale) {
        // All accounted for (covered or excluded)
        console.log('  ✓ full coverage');
      }

      // Stale section
      if (hasStale) {
        const staleStr = report.stale.join(', ');
        console.log(`  stale: ${staleStr}`);
      }

      console.log();
    }

    console.log('─────────────────────────────────');
    if (modulesWithGaps === 0 && staleModules === 0) {
      console.log('all modules in sync');
    } else {
      const parts = [];
      if (modulesWithGaps > 0) {
        parts.push(`${modulesWithGaps} module${modulesWithGaps !== 1 ? 's' : ''} with gaps`);
      }
      if (totalMissing > 0) {
        parts.push(`${totalMissing} missing`);
      }
      if (totalStale > 0) {
        parts.push(`${totalStale} stale`);
      }
      if (staleModules > 0) {
        parts.push(`${staleModules} stale module${staleModules !== 1 ? 's' : ''}`);
      }
      console.log(parts.join(' | '));
    }
  }
}

async function main() {
  const jsonOutput = process.argv.includes('--json');
  const auditMap = parseInterceptor(INTERCEPTOR_PATH);
  const reports: ModuleReport[] = [];

  for (const [moduleName, auditData] of auditMap) {
    const resolvedPath = resolvePackage(moduleName);
    const liveKeys = getLiveKeys(moduleName, resolvedPath);
    reports.push(compare(auditData, liveKeys));
  }

  // Sort by name for consistent output
  reports.sort((a, b) => a.moduleName.localeCompare(b.moduleName));

  printReport(reports, jsonOutput);
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
