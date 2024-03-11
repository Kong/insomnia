import url from 'node:url';

import { describe, expect, it } from '@jest/globals';

import { QueryParam, setUrlParser, Url, UrlMatchPattern } from '../urls';
import { Variable } from '../variables';

describe('test Url object', () => {
    setUrlParser(url.URL);

    it('test QueryParam', () => {
        const queryParam = new QueryParam({
            key: 'uname',
            value: 'patrick star',
        });

        expect(queryParam.toString()).toEqual('uname=patrick+star');

        queryParam.update('uname=peter+parker');
        expect(queryParam.toString()).toEqual('uname=peter+parker');

        expect(
            QueryParam.unparseSingle({ key: 'uname', value: 'patrick star' })
        ).toEqual('uname=patrick+star');

        expect(
            QueryParam.unparse({ uname: 'patrick star', password: '123' })
        ).toEqual('uname=patrick+star&password=123');

        expect(
            QueryParam.parseSingle('uname=patrick+star')
        ).toEqual({ key: 'uname', value: 'patrick star' });

        expect(
            QueryParam.parse('uname=patrick+star&password=123')
        ).toEqual([{ 'key': 'uname', 'value': 'patrick star' }, { 'key': 'password', 'value': '123' }]);
    });

    it('test Url methods', () => {
        const url = new Url({
            auth: {
                username: 'usernameValue',
                password: 'passwordValue',
            },
            hash: 'hashValue',
            host: ['hostValue', 'com'],
            path: ['pathLevel1', 'pathLevel2'],
            port: '777',
            protocol: 'https:',
            query: [
                new QueryParam({ key: 'key1', value: 'value1' }),
                new QueryParam({ key: 'key2', value: 'value2' }),
            ],
            variables: [
                new Variable({ key: 'varKey', value: 'varValue' }),
            ],
        });

        expect(url.getHost()).toEqual('hostvalue.com');
        expect(url.getPath()).toEqual('/pathLevel1/pathLevel2');
        expect(url.getQueryString()).toEqual('key1=value1&key2=value2');
        expect(url.getPathWithQuery()).toEqual('/pathLevel1/pathLevel2?key1=value1&key2=value2');
        expect(url.getRemote(true)).toEqual('hostvalue.com:777');
        expect(url.getRemote(false)).toEqual('hostvalue.com:777'); // TODO: add more cases

        url.removeQueryParams([
            new QueryParam({ key: 'key1', value: 'value1' }),
        ]);
        expect(url.getQueryString()).toEqual('key2=value2');
        expect(url.toString()).toEqual('https://usernameValue:passwordValue@hostvalue.com:777/pathLevel1/pathLevel2?key2=value2#hashValue');

        const url2 = new Url('https://usernameValue:passwordValue@hostvalue.com:777/pathLevel1/pathLevel2?key1=value1&key2=value2#hashValue');
        expect(url2.getHost()).toEqual('hostvalue.com');
        expect(url2.getPath()).toEqual('/pathLevel1/pathLevel2');
        expect(url2.getQueryString()).toEqual('key1=value1&key2=value2');
        expect(url2.getPathWithQuery()).toEqual('/pathLevel1/pathLevel2?key1=value1&key2=value2');
        expect(url2.getRemote(true)).toEqual('hostvalue.com:777');
        expect(url2.getRemote(false)).toEqual('hostvalue.com:777'); // TODO: add more cases

        url2.removeQueryParams([
            new QueryParam({ key: 'key1', value: 'value1' }),
        ]);
        expect(url2.getQueryString()).toEqual('key2=value2');
        expect(url2.toString()).toEqual('https://usernameValue:passwordValue@hostvalue.com:777/pathLevel1/pathLevel2?key2=value2#hashValue');
    });

    it('test Url static methods', () => {
        // static methods
        const urlStr = 'https://myhost.com/path1/path2';
        const urlOptions = Url.parse(urlStr);
        const urlObj = new Url(urlOptions || '');

        expect(urlObj.toString()).toEqual(urlStr);
    });
});

describe('test Url Match Pattern', () => {
    it('test UrlMatchPattern', () => {
        const pattern = 'http+https+custom://*.insomnia.com:80/p1/*';
        const matchPattern = new UrlMatchPattern(pattern);

        expect(matchPattern.getProtocols()).toEqual(['http', 'https', 'custom']);
        expect(matchPattern.testProtocol('http')).toBeTruthy();
        expect(matchPattern.testProtocol('https')).toBeTruthy();
        expect(matchPattern.testProtocol('custom')).toBeTruthy();
        expect(matchPattern.testProtocol('unmatched')).toBeFalsy();

        expect(matchPattern.testHost('download.insomnia.com')).toBeTruthy();
        expect(matchPattern.testHost('bin.download.insomnia.com')).toBeFalsy();
        expect(matchPattern.testHost('insomnia.com')).toBeFalsy();
        expect(matchPattern.testHost('com')).toBeFalsy();

        expect(matchPattern.testPath('/p1/abc')).toBeTruthy();
        expect(matchPattern.testPath('/p1/')).toBeTruthy();
        expect(matchPattern.testPath('/p1')).toBeFalsy();
        expect(matchPattern.testPath('/')).toBeFalsy();
        expect(matchPattern.testPath('')).toBeFalsy();

        expect(matchPattern.testPort('80', 'https')).toBeTruthy();
        expect(matchPattern.testPort('443', 'https')).toBeFalsy();
        expect(matchPattern.testPort('80', 'http')).toBeTruthy();
        expect(matchPattern.testPort('80', 'unmatched')).toBeFalsy();
    });

    it('test UrlMatchPattern with no protocol', () => {
        const pattern = '*.insomnia.com/p1/*';
        try {
            const matchPattern = new UrlMatchPattern(pattern);
            matchPattern.testProtocol('http');
        } catch (e) {
            expect(e.message).toContain('UrlMatchPattern: protocol is not specified');
        }
    });

    it('test UrlMatchPattern with no port', () => {
        const pattern = 'http+https+custom://*.insomnia.com/p1/*';
        const matchPattern = new UrlMatchPattern(pattern);

        expect(matchPattern.getProtocols()).toEqual(['http', 'https', 'custom']);
        expect(matchPattern.testProtocol('http')).toBeTruthy();
        expect(matchPattern.testProtocol('https')).toBeTruthy();
        expect(matchPattern.testProtocol('custom')).toBeTruthy();
        expect(matchPattern.testProtocol('unmatched')).toBeFalsy();

        expect(matchPattern.testHost('download.insomnia.com')).toBeTruthy();
        expect(matchPattern.testHost('bin.download.insomnia.com')).toBeFalsy();
        expect(matchPattern.testHost('insomnia.com')).toBeFalsy();
        expect(matchPattern.testHost('com')).toBeFalsy();

        expect(matchPattern.testPath('/p1/abc')).toBeTruthy();
        expect(matchPattern.testPath('/p1/')).toBeTruthy();
        expect(matchPattern.testPath('/p1')).toBeFalsy();
        expect(matchPattern.testPath('/')).toBeFalsy();
        expect(matchPattern.testPath('')).toBeFalsy();

        expect(matchPattern.testPort('443', 'https')).toBeTruthy();
        expect(matchPattern.testPort('80', 'http')).toBeTruthy();
        expect(matchPattern.testPort('443', 'http')).toBeFalsy();
        expect(matchPattern.testPort('80', 'https')).toBeFalsy();
    });

    it('test UrlMatchPattern with no path', () => {
        const pattern = 'http+https+custom://*.insomnia.com';
        const matchPattern = new UrlMatchPattern(pattern);

        expect(matchPattern.getProtocols()).toEqual(['http', 'https', 'custom']);
        expect(matchPattern.testProtocol('http')).toBeTruthy();
        expect(matchPattern.testProtocol('https')).toBeTruthy();
        expect(matchPattern.testProtocol('custom')).toBeTruthy();
        expect(matchPattern.testProtocol('unmatched')).toBeFalsy();

        expect(matchPattern.testHost('download.insomnia.com')).toBeTruthy();
        expect(matchPattern.testHost('bin.download.insomnia.com')).toBeFalsy();
        expect(matchPattern.testHost('insomnia.com')).toBeFalsy();
        expect(matchPattern.testHost('com')).toBeFalsy();

        expect(matchPattern.testPath('')).toBeTruthy();
        expect(matchPattern.testPath('/')).toBeFalsy(); // it is not handled temporarily

        expect(matchPattern.testPort('443', 'https')).toBeTruthy();
        expect(matchPattern.testPort('80', 'http')).toBeTruthy();
        expect(matchPattern.testPort('443', 'http')).toBeFalsy();
        expect(matchPattern.testPort('80', 'https')).toBeFalsy();
    });
});
