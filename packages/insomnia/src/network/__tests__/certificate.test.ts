import { beforeEach, describe, expect, it } from '@jest/globals';

import { globalBeforeEach } from '../../__jest__/before-each';
import { ClientCertificate } from '../../models/client-certificate';
import { filterClientCertificates } from '../certificate';

describe('filterClientCertificates', () => {
  beforeEach(globalBeforeEach);

  const requestUrl = 'https://www.example.com:1234';
  const clientCertificatesWithMatchPort: ClientCertificate[] = [
    {
      host: 'https://www.example.com:1234',
      _id: '',
      parentId: '',
      passphrase: '',
      cert: '',
      key: '',
      pfx: '',
      disabled: false,
      isPrivate: true,
      modified: 0,
      type: '',
      created: 0,
      name: '',
    },
    {
      host: 'https://www.example.com',
      _id: '',
      parentId: '',
      passphrase: '',
      cert: '',
      key: '',
      pfx: '',
      disabled: false,
      isPrivate: true,
      modified: 0,
      type: '',
      created: 0,
      name: '',
    },
  ];

  const clientCertificatesOnlyMatchHost = [
    {
      host: 'https://www.example.com',
      _id: '',
      parentId: '',
      passphrase: '',
      cert: '',
      key: '',
      pfx: '',
      disabled: false,
      isPrivate: true,
      modified: 0,
      type: '',
      created: 0,
      name: '',
    },
  ];
  it('should return certificate which can match both host and port', () => {
    const res = filterClientCertificates(clientCertificatesWithMatchPort, requestUrl, 'https:');
    expect(res.length).toEqual(1);
    expect(res[0].host).toEqual('https://www.example.com:1234');
  });

  it('should return certificate which can match host', () => {
    const res = filterClientCertificates(clientCertificatesOnlyMatchHost, requestUrl, 'https:');
    expect(res.length).toEqual(1);
    expect(res[0].host).toEqual('https://www.example.com');
  });
});
