import fs from 'node:fs';
import path from 'node:path';

interface ReportRecord {
  builtin: string;
  importer: string;
}

interface ReportFile {
  records: ReportRecord[];
}

interface BaselineEntry {
  builtin: string;
  importer: string;
}

interface BaselineFile {
  entries: BaselineEntry[];
}

const packageRoot = path.resolve(__dirname, '..');
const reportPath = path.resolve(packageRoot, '.reports', 'renderer-node-imports.json');
const baselinePath = path.resolve(packageRoot, 'config', 'renderer-node-import-baseline.json');
const shouldWriteBaseline = process.argv.includes('--write-baseline');

const readJson = <T>(filePath: string): T => {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
};

const toKey = (entry: BaselineEntry) => `${entry.importer}::${entry.builtin}`;

const normalizeEntries = (entries: BaselineEntry[]) => {
  const uniqueEntries = new Map<string, BaselineEntry>();

  for (const entry of entries) {
    uniqueEntries.set(toKey(entry), {
      importer: entry.importer,
      builtin: entry.builtin,
    });
  }

  return [...uniqueEntries.values()].sort(
    (left, right) => left.importer.localeCompare(right.importer) || left.builtin.localeCompare(right.builtin),
  );
};

if (!fs.existsSync(reportPath)) {
  console.error(`Renderer Node import report not found at ${path.relative(packageRoot, reportPath)}.`);
  console.error('Run `npm run analyze:renderer-node-imports -w insomnia` first.');
  process.exit(1);
}

const report = readJson<ReportFile>(reportPath);
const currentEntries = normalizeEntries(report.records.map(({ importer, builtin }) => ({ importer, builtin })));

if (shouldWriteBaseline) {
  fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
  fs.writeFileSync(
    baselinePath,
    JSON.stringify(
      {
        entries: currentEntries,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`Updated renderer Node import baseline at ${path.relative(packageRoot, baselinePath)}.`);
  process.exit(0);
}

if (!fs.existsSync(baselinePath)) {
  console.error(`Renderer Node import baseline not found at ${path.relative(packageRoot, baselinePath)}.`);
  console.error('Run `npm run update:renderer-node-import-baseline -w insomnia` to create it.');
  process.exit(1);
}

const baseline = readJson<BaselineFile>(baselinePath);
const baselineEntries = normalizeEntries(baseline.entries);

const currentByKey = new Map(currentEntries.map(entry => [toKey(entry), entry]));
const baselineByKey = new Map(baselineEntries.map(entry => [toKey(entry), entry]));

const additions = currentEntries.filter(entry => !baselineByKey.has(toKey(entry)));
const removals = baselineEntries.filter(entry => !currentByKey.has(toKey(entry)));

if (additions.length > 0) {
  console.error('Renderer Node import baseline check failed. New renderer Node builtin imports were introduced:');
  for (const addition of additions) {
    console.error(`- ${addition.importer} -> ${addition.builtin}`);
  }

  if (removals.length > 0) {
    console.error('Resolved imports detected during the same run:');
    for (const removal of removals) {
      console.error(`- ${removal.importer} -> ${removal.builtin}`);
    }
  }

  console.error('If these additions are intentional migration baseline changes, update the baseline explicitly.');
  process.exit(1);
}

console.log('Renderer Node import baseline check passed. No new renderer Node builtin imports were introduced.');

if (removals.length > 0) {
  console.log('Resolved imports not yet reflected in the baseline:');
  for (const removal of removals) {
    console.log(`- ${removal.importer} -> ${removal.builtin}`);
  }
  console.log(
    'Run `npm run update:renderer-node-import-baseline -w insomnia` after intentionally ratcheting the baseline down.',
  );
}
