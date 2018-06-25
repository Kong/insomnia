import certificateUrlParse from '../certificate-url-parse';
import { parse as urlParse } from 'url';
import { globalBeforeEach } from '../../__jest__/before-each';

describe('certificateUrlParse', () => {
  beforeEach(globalBeforeEach);
  it('should return the result of url.parse if no wildcard paths are supplied', () => {
    const url =
      'https://www.example.org:80/some/resources?query=1&other=2#myfragment';
    const expected = urlParse(url);
    expect(certificateUrlParse(url)).toEqual(expected);
  });

  it('should return the correct hostname if a single wildcard is present', () => {
    const protocol = 'https';
    const host = 'www.exam*ple.org';
    const port = '123';
    const path = '/some/resources';
    const query = 'query=1&other=2';
    const fragment = 'myfragment';

    const url = `${protocol}://${host}:${port}${path}?${query}#${fragment}`;
    expect(certificateUrlParse(url).hostname).toEqual(host);
  });

  it('should return the correct hostname if multiple wildcards are present', () => {
    const protocol = 'https';
    const host = 'www.e*xamp*le.or*g';
    const port = '123';
    const path = '/some/resources';
    const query = 'query=1&other=2';
    const fragment = 'myfragment';

    const url = `${protocol}://${host}:${port}${path}?${query}#${fragment}`;
    expect(certificateUrlParse(url).hostname).toEqual(host);
  });

  it('should return the correct hostname if a wildcard prefix is present', () => {
    const protocol = 'https';
    const host = '*.example.org';
    const port = '123';
    const path = '/some/resources';
    const query = 'query=1&other=2';
    const fragment = 'myfragment';

    const url = `${protocol}://${host}:${port}${path}?${query}#${fragment}`;
    expect(certificateUrlParse(url).hostname).toEqual(host);
  });

  it('should return the correct hostname if a wildcard suffix is present', () => {
    const protocol = 'https';
    const host = 'www.example.*';
    const port = '123';
    const path = '/some/resources';
    const query = 'query=1&other=2';
    const fragment = 'myfragment';

    const url = `${protocol}://${host}:${port}${path}?${query}#${fragment}`;
    expect(certificateUrlParse(url).hostname).toEqual(host);
  });

  it('should return a host of null if no protocol is provided for a wildcard hostname', () => {
    const host = 'www.example.*';
    const path = '/some/resources';
    const query = 'query=1&other=2';
    const fragment = 'myfragment';

    const url = `${host}${path}?${query}#${fragment}`;
    expect(certificateUrlParse(url).hostname).toEqual(null);
  });

  it('should return the correct host if basic auth is included', () => {
    const protocol = 'https';
    const user = 'myuser';
    const password = 'mypass';
    const host = 'www.example.*';
    const path = '/some/resources';
    const query = 'query=1&other=2';
    const fragment = 'myfragment';

    const url = `${protocol}://${user}:${password}@${host}${path}?${query}#${fragment}`;
    expect(certificateUrlParse(url).hostname).toEqual(host);
  });

  it('should return the correct host if the path contains an @ symbol', () => {
    const protocol = 'https';
    const host = 'www.example.*';
    const path = '/@some/resources';
    const query = 'query=1&other=2';
    const fragment = 'myfragment';

    const url = `${protocol}://${host}${path}?${query}#${fragment}`;
    expect(certificateUrlParse(url).hostname).toEqual(host);
  });

  it('should return the correct non-hostname properties for wildcard paths', () => {
    const protocol = 'https';
    const user = 'myuser';
    const password = 'mypass';
    const nonWildcardHost = 'www.example.';
    const host = 'www.example.*';
    const port = '123';
    const path = '/some/resources';
    const query = 'query=1&other=2';
    const fragment = 'myfragment';

    const url = `${protocol}://${user}:${password}@${host}:${port}${path}?${query}#${fragment}`;
    const nonWildcardUrl = `${protocol}://${user}:${password}@${nonWildcardHost}:${port}${path}?${query}#${fragment}`;
    const expected = urlParse(nonWildcardUrl);
    expected.hostname = host;
    expected.href = url;
    expected.host = `${host}:${port}`;
    expect(certificateUrlParse(url)).toEqual(expected);
  });

  it('should return the correct port if wildcard in port', () => {
    const protocol = 'https';
    const host = 'localhost';
    const port = '*';
    const path = '/some/resources';
    const query = 'query=1&other=2';
    const fragment = 'myfragment';

    const url = `${protocol}://${host}:${port}${path}?${query}#${fragment}`;
    expect(certificateUrlParse(url).port).toEqual(port);
  });
});
