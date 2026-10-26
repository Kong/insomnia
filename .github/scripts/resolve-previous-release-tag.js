#!/usr/bin/env node
// Resolves the previous core@ tag for release notes by semver precedence, excluding a release's own beta versions.
const { execSync } = require('child_process');

function parseTag(tag) {
  const version = tag.replace(/^core@/, '');
  // build metadata doesn't affect precedence and is discarded
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-([^+]+))?(?:\+.+)?$/);
  if (!match) return null;
  const [, major, minor, patch, prerelease] = match;
  return { tag, major: +major, minor: +minor, patch: +patch, prerelease: prerelease || null };
}

function comparePrerelease(a, b) {
  if (a === null && b === null) return 0;
  if (a === null) return 1; // no prerelease outranks any prerelease
  if (b === null) return -1;
  const aParts = a.split('.');
  const bParts = b.split('.');
  const length = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < length; i++) {
    const x = aParts[i];
    const y = bParts[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const xIsNumeric = /^\d+$/.test(x);
    const yIsNumeric = /^\d+$/.test(y);
    if (xIsNumeric && yIsNumeric) {
      const diff = Number(x) - Number(y);
      if (diff) return diff;
    } else if (xIsNumeric !== yIsNumeric) {
      return xIsNumeric ? -1 : 1; // numeric identifiers always rank below alphanumeric ones
    } else {
      const diff = x.localeCompare(y);
      if (diff) return diff;
    }
  }
  return 0;
}

function compareVersions(a, b) {
  return (
    a.major - b.major ||
    a.minor - b.minor ||
    a.patch - b.patch ||
    comparePrerelease(a.prerelease, b.prerelease)
  );
}

function resolvePreviousTag(tags, current) {
  const previous = tags
    .map(parseTag)
    .filter(Boolean)
    .filter(parsed => parsed.major < 1000) // exclude legacy CalVer tags (2020.x-2023.x era)
    .filter(parsed => parsed.tag !== current.tag)
    .filter(parsed => (current.prerelease === null ? parsed.prerelease === null : true))
    .filter(parsed => compareVersions(parsed, current) < 0)
    .sort(compareVersions)
    .pop();

  return previous ? previous.tag : null;
}

if (require.main === module) {
  const currentTag = process.argv[2];
  if (!currentTag) {
    console.error('Usage: resolve-previous-release-tag.js <current-tag>');
    process.exit(1);
  }

  const current = parseTag(currentTag);
  if (!current) {
    console.error(`Could not parse current tag: ${currentTag}`);
    process.exit(1);
  }

  const tags = execSync("git tag --list 'core@*'").toString().split('\n').filter(Boolean);
  const previous = resolvePreviousTag(tags, current);

  process.stdout.write(previous || '');
}

module.exports = { parseTag, comparePrerelease, compareVersions, resolvePreviousTag };
