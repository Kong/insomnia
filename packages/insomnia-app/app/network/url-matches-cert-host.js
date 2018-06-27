import { parse as urlParse } from 'url';
import certificateUrlParse from './certificate-url-parse';
import { escapeRegex } from '../common/misc';
import { setDefaultProtocol } from 'insomnia-url';

const DEFAULT_PORT = 443;

export function urlMatchesCertHost(certificateHost, requestUrl) {
  const cHostWithProtocol = setDefaultProtocol(certificateHost, 'https:');
  const { hostname, port } = urlParse(requestUrl);
  const { hostname: cHostname, port: cPort } = certificateUrlParse(
    cHostWithProtocol
  );

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
