import NetworkResponseConfig from '../response-config';

describe('NetworkResponseConfig', () => {
  it('Build basic response with all fields', () => {
    const body = new Buffer('Hello World!', 'utf8');
    const config = new NetworkResponseConfig()
      .setStartTime(8001)
      .setEndTime(9001)
      .setStatusCode(200)
      .setStatusMessage('OK')
      .setBody(body.toString('base64'), 'base64', body.length)
      .setContentType('text/plain')
      .setError('Test error')
      .setHeader('set-cookie', 'cookie_1=foo')
      .setHeader('set-cookie', 'cookie_2=bar')
      .setHeader('x-testing', 'foo');

    expect(config.startTime).toBe(8001);
    expect(config.endTime).toBe(9001);
    expect(config.getElapsedTime()).toBe(1000);

    expect(config.statusCode).toBe(200);
    expect(config.statusMessage).toBe('OK');

    expect(config.contentType).toBe('text/plain');
    expect(config.body).toBe('SGVsbG8gV29ybGQh');
    expect(config.bodyEncoding).toBe('base64');
    expect(config.bodySize).toBe(12);

    expect(config.error).toBe('Test error');

    expect(config.headers).toEqual([
      {name: 'set-cookie', value: 'cookie_1=foo'},
      {name: 'set-cookie', value: 'cookie_2=bar'},
      {name: 'x-testing', value: 'foo'}
    ]);
  });
});
