const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseTag, comparePrerelease, resolvePreviousTag } = require('./resolve-previous-release-tag');

// spans the CalVer/SemVer boundary, a beta->stable line, and an out-of-order hotfix
const FIXTURE_TAGS = [
  'core@2023.5.8',
  'core@8.0.0-beta.1',
  'core@8.0.0',
  'core@13.0.2',
  'core@13.1.0-beta.0',
  'core@13.1.0-beta.1',
  'core@13.1.0',
  'core@13.1.1',
  'core@13.2.0-beta.0',
];

function resolve(currentTag, tags = FIXTURE_TAGS) {
  return resolvePreviousTag(tags, parseTag(currentTag));
}

test('legacy CalVer tags are never selected as the previous tag', () => {
  assert.equal(resolve('core@8.0.0', ['core@2023.5.8']), null);
});

test('a stable release resolves to the prior stable release, not its own beta', () => {
  assert.equal(resolve('core@13.1.0'), 'core@13.0.2');
});

test('a beta resolves to the prior beta of the same version', () => {
  assert.equal(resolve('core@13.1.0-beta.1'), 'core@13.1.0-beta.0');
});

test('an out-of-order hotfix stays scoped to its own release line', () => {
  // core@13.2.0-beta.0 postdates 13.1.1 in precedence despite tagging order
  assert.equal(resolve('core@13.1.1'), 'core@13.1.0');
});

test('returns null when no qualifying previous tag exists (first-ever release)', () => {
  assert.equal(resolvePreviousTag([], parseTag('core@1.0.0')), null);
});

test('malformed tags are skipped rather than breaking resolution', () => {
  assert.equal(resolve('core@13.1.0', ['not-a-real-tag', 'core@garbage', 'core@13.0.0']), 'core@13.0.0');
});

test('parseTag discards build metadata without dropping the tag', () => {
  assert.deepEqual(parseTag('core@13.1.0+build.5'), {
    tag: 'core@13.1.0+build.5',
    major: 13,
    minor: 1,
    patch: 0,
    prerelease: null,
  });
  assert.equal(parseTag('core@13.1.0-beta.1+build.5').prerelease, 'beta.1');
});

test('comparePrerelease ranks numeric identifiers below alphanumeric ones regardless of value', () => {
  assert.ok(comparePrerelease('99', '8a') < 0);
  assert.ok(comparePrerelease('8a', '99') > 0);
});
