import { parse as urlParse } from 'url';

import { escapeRegex } from '../common/misc';
import { setDefaultProtocol } from '../utils/url/protocol';

const DEFAULT_PORT = 443;

export function urlMatchesCertHost(certificateHost: string, requestUrl: string) {
  const cHostWithProtocol = setDefaultProtocol(certificateHost, 'https:');
  const { hostname, port } = urlParse(requestUrl);
  let certificateHostWithProtocol = new URL('https://example.com');
  try {
    certificateHostWithProtocol = new URL(cHostWithProtocol);
  } catch (err) {
    // return false early if the certificate host is invalid
    return false;
  }
  const { hostname: cHostname, port: cPort } = certificateHostWithProtocol;
  // @ts-expect-error -- TSCONVERSION `parseInt(null)` returns `NaN`
  const assumedPort = parseInt(port) || DEFAULT_PORT;
  const assumedCPort = parseInt(cPort) || DEFAULT_PORT;
  const cHostnameRegex = escapeRegex(cHostname || '').replace(/\\\*/g, '.*');
  const cPortRegex = escapeRegex(cPort || '').replace(/\\\*/g, '.*');

  // Check ports
  if ((cPort + '').includes('*')) {
    if (!(port || '').match(`^${cPortRegex}$`)) {
      return false;
    }
  } else {
    if (assumedCPort !== assumedPort) {
      return false;
    }
  }

  // Check hostnames
  if (!(hostname || '').match(`^${cHostnameRegex}$`)) {
    return false;
  }

  // Everything matches
  return true;
}
