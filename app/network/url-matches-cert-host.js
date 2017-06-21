import {parse as urlParse} from 'url';
import certificateUrlParse from './certificate-url-parse';
import {setDefaultProtocol} from '../common/misc';

const DEFAULT_PORT = 443;

export default function urlMatchesCertHost (certificateHost, requestUrl) {
  const cHostWithProtocol = setDefaultProtocol(certificateHost, 'https:');
  const {hostname, port} = urlParse(requestUrl);
  const {hostname: cHostname, port: cPort} = certificateUrlParse(cHostWithProtocol);

  const assumedPort = parseInt(port) || DEFAULT_PORT;
  const assumedCPort = parseInt(cPort) || DEFAULT_PORT;

  const cHostnameRegex = (cHostname || '').replace(/([.+?^=!:${}()|[\]/\\])/g, '\\$1')
                                          .replace(/\*/g, '.*');

  return (assumedCPort === assumedPort && !!hostname.match(`^${cHostnameRegex}$`));
}
