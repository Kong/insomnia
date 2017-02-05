import NetworkRequestConfig from '../request-config';

describe('NetworkRequestConfig', () => {
  it('Build basic request with all fields', () => {
    const config = new NetworkRequestConfig()
      .setMethod('GET')
      .setUrl('https://google.com')
      .setBody('Hello World!')
      .setHeader('Content-Type', 'text/plain')
      .setHeader('x-testing', 'foo');

    expect(config.method).toBe('GET');
    expect(config.url).toBe('https://google.com');
    expect(config.body).toBe('Hello World!');
    expect(config.headers).toEqual([
      {name: 'Content-Type', value: 'text/plain'},
      {name: 'x-testing', value: 'foo'}
    ]);
  });
});

describe('NetworkRequestConfig.setMethod()', () => {
  it('Sets uppercase method', () => {
    const config = new NetworkRequestConfig().setMethod('GET');
    expect(config.method).toBe('GET');
  });

  it('Sets lowercase method', () => {
    const config = new NetworkRequestConfig().setMethod('get');
    expect(config.method).toBe('GET');
  });

  it('Trims spaces', () => {
    const config = new NetworkRequestConfig().setMethod('   get ');
    expect(config.method).toBe('GET');
  });
});

describe('NetworkRequestConfig.setUrl()', () => {
  it('Sets proper URL', () => {
    const config = new NetworkRequestConfig().setUrl('https://insomnia.rest');
    expect(config.url).toBe('https://insomnia.rest');
  });

  it('Fixes invalid protocols', () => {
    const config = new NetworkRequestConfig().setUrl('insomnia.rest');
    expect(config.url).toBe('http://insomnia.rest');
  });
});

describe('NetworkRequestConfig.setHeader()', () => {
  it('Sets basic headers', () => {
    const config = new NetworkRequestConfig()
      .setHeader('Content-Type', 'application/json')
      .setHeader('foo', 'bar');

    expect(config.headers).toEqual([
      {name: 'Content-Type', value: 'application/json'},
      {name: 'foo', value: 'bar'},
    ]);
  });

  it('Does not overwrite by default', () => {
    const config = new NetworkRequestConfig()
      .setHeader('Content-Type', 'application/json')
      .setHeader('Content-Type', 'text/plain');

    expect(config.headers).toEqual([
      {name: 'Content-Type', value: 'application/json'},
    ]);
  });

  it('Overwrites if desired', () => {
    const config = new NetworkRequestConfig()
      .setHeader('Content-Type', 'application/json')
      .setHeader('Content-Type', 'text/plain', true);

    expect(config.headers).toEqual([
      {name: 'Content-Type', value: 'text/plain'},
    ]);
  });
});
