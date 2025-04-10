import { describe, expect, it } from 'vitest';

import { Certificate } from '../certificates';

describe('test Certificate object', () => {
    it('test methods', () => {
        const cert = new Certificate({
            name: 'Certificate for example.com',
            matches: ['https://example.com'],
            key: { src: '/User/path/to/certificate/key' },
            cert: { src: '/User/path/to/certificate' },
            passphrase: 'iampassphrase',
        });

        [
            'https://example.com',
            'https://example.com/subdomain',
        ].forEach(testCase => {
            expect(cert.canApplyTo(testCase)).toBeTruthy();
        });

        cert.update({
            name: 'Certificate for api.com',
            matches: ['https://api.com'],
            key: { src: '/User/path/to/certificate/key' },
            cert: { src: '/User/path/to/certificate' },
            passphrase: 'iampassphrase',
        });

        expect(cert.name).toEqual('Certificate for api.com');
        expect(cert.key).toEqual({ src: '/User/path/to/certificate/key' });
        expect(cert.cert).toEqual({ src: '/User/path/to/certificate' });
        expect(cert.passphrase).toEqual('iampassphrase');
    });
});
