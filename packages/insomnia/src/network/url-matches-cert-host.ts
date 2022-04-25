import { setDefaultProtocol } from 'insomnia-url';

import { escapeRegex } from '../common/misc';

const DEFAULT_PORT = 443;

export function urlMatchesCertHost(certificateHost, requestUrl) {
  const cHostWithProtocol = setDefaultProtocol(certificateHost, 'https:');
  const { hostname, port } = new URL(requestUrl);
  let cHostname, cPort;
  try {
    const c = new URL(cHostWithProtocol);
    cHostname = c.hostname;
    cPort = c.port;
  } catch (_) {
    return false;
  }
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
