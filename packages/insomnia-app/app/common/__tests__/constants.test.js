import {
  ACTIVITY_DEBUG,
  ACTIVITY_HOME,
  ACTIVITY_MIGRATION,
  ACTIVITY_ONBOARDING,
  ACTIVITY_SPEC,
  ACTIVITY_UNIT_TEST,
  FLEXIBLE_URL_REGEX,
  isValidActivity,
  isWorkspaceActivity,
} from '../constants';

describe('URL Regex', () => {
  it('matches valid URLs', () => {
    expect('https://google.com').toMatch(FLEXIBLE_URL_REGEX);
    expect('http://google.com').toMatch(FLEXIBLE_URL_REGEX);
    expect('https://google.com/').toMatch(FLEXIBLE_URL_REGEX);
    expect('http://google.com/').toMatch(FLEXIBLE_URL_REGEX);
    expect('https://google').toMatch(FLEXIBLE_URL_REGEX);
    expect('https://dash-domain.com').toMatch(FLEXIBLE_URL_REGEX);
    expect('http://localhost:8000').toMatch(FLEXIBLE_URL_REGEX);
    expect('http://localhost:8000/foo/b@@r?hi=there#hello').toMatch(FLEXIBLE_URL_REGEX);
  });

  it('does not match "stop" characters', () => {
    expect('string').not.toMatch(FLEXIBLE_URL_REGEX);
    expect('//relative-url.com').not.toMatch(FLEXIBLE_URL_REGEX);
    expect('//relative').not.toMatch(FLEXIBLE_URL_REGEX);
    expect('//relative').not.toMatch(FLEXIBLE_URL_REGEX);
    expect('google.com').not.toMatch(FLEXIBLE_URL_REGEX);
    expect('smtp://mailserver.com').not.toMatch(FLEXIBLE_URL_REGEX);
    expect('"https://google.com"').not.toMatch(FLEXIBLE_URL_REGEX);
    expect('(https://google.com)').not.toMatch(FLEXIBLE_URL_REGEX);
    expect('[https://google.com]').not.toMatch(FLEXIBLE_URL_REGEX);
  });
});

describe('isWorkspaceActivity', () => {
  it('should return true', () => {
    expect(isWorkspaceActivity(ACTIVITY_SPEC)).toBe(true);
    expect(isWorkspaceActivity(ACTIVITY_DEBUG)).toBe(true);
    expect(isWorkspaceActivity(ACTIVITY_UNIT_TEST)).toBe(true);
  });

  it('should return false', () => {
    expect(isWorkspaceActivity(ACTIVITY_HOME)).toBe(false);
    expect(isWorkspaceActivity(ACTIVITY_ONBOARDING)).toBe(false);
    expect(isWorkspaceActivity(ACTIVITY_MIGRATION)).toBe(false);
  });
});

describe('isValidActivity', () => {
  it('should return true', () => {
    expect(isValidActivity(ACTIVITY_SPEC)).toBe(true);
    expect(isValidActivity(ACTIVITY_DEBUG)).toBe(true);
    expect(isValidActivity(ACTIVITY_UNIT_TEST)).toBe(true);
    expect(isValidActivity(ACTIVITY_HOME)).toBe(true);
    expect(isValidActivity(ACTIVITY_ONBOARDING)).toBe(true);
    expect(isValidActivity(ACTIVITY_MIGRATION)).toBe(true);
  });

  it('should return false', () => {
    expect(isValidActivity('something else')).toBe(false);
    expect(isValidActivity(null)).toBe(false);
    expect(isValidActivity(undefined)).toBe(false);
  });
});
