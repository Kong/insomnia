import { FLEXIBLE_URL_REGEX } from '../constants';
import { globalBeforeEach } from '../../__jest__/before-each';
describe('URL Regex', () => {
  beforeEach(globalBeforeEach);
  it('matches valid URLs', () => {
    expect('https://google.com').toMatch(FLEXIBLE_URL_REGEX);
    expect('http://google.com').toMatch(FLEXIBLE_URL_REGEX);
    expect('https://google.com/').toMatch(FLEXIBLE_URL_REGEX);
    expect('http://google.com/').toMatch(FLEXIBLE_URL_REGEX);
    expect('https://google').toMatch(FLEXIBLE_URL_REGEX);
    expect('https://dash-domain.com').toMatch(FLEXIBLE_URL_REGEX);
    expect('http://localhost:8000').toMatch(FLEXIBLE_URL_REGEX);
    expect('http://localhost:8000/foo/b@@r?hi=there#hello').toMatch(
      FLEXIBLE_URL_REGEX
    );
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
