import url from 'node:url';

import { describe, expect, it } from '@jest/globals';

import { PropertyList } from '../base';
import { QueryParam, setUrlParser, Url } from '../urls';
import { Variable } from '../variables';

describe('test Certificate object', () => {
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
  });

  it('test Url static methods', () => {
    // static methods
    const urlStr = 'https://myhost.com/path1/path2';
    const urlOptions = Url.parse(urlStr);
    const urlOpt = new Url(urlOptions || '');

    expect(urlOpt.toString()).toEqual(urlStr);

  });

  it('test UrlMatchPattern', () => {
  });
});
