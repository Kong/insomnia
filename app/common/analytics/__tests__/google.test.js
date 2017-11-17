import * as electron from 'electron';
import {EventEmitter} from 'events';
import {globalBeforeEach} from '../../../__jest__/before-each';
import {GoogleAnalytics} from '../google';

describe('init()', () => {
  beforeEach(globalBeforeEach);

  it('works with tracking enabled', async () => {
    electron.net.request = jest.fn(url => {
      const req = new EventEmitter();
      req.end = function () {
      };
      return req;
    });

    const analytics = new GoogleAnalytics(
      'trackingId',
      'clientId',
      'https://tests.insomnia.rest',
      false
    );

    expect(electron.net.request.mock.calls).toEqual([]);
    analytics.trackEvent(true, 'category', 'action', 'label', 'value');
    expect(electron.net.request.mock.calls).toEqual([[
      'https://www.google-analytics.com/collect?v=1&' +
      'tid=trackingId&' +
      'cid=clientId&' +
      'dl=https%3A%2F%2Ftests.insomnia.rest&' +
      'sr=1920x1080&' +
      'ul=en-US&' +
      'dt=Insomnia%205.11.7&' +
      'vp=1900x1060&' +
      'de=UTF-8&' +
      't=event&' +
      'ec=category&' +
      'ea=action&' +
      'el=label&' +
      'ev=value'
    ]]);
  });

  it('does not work with tracking disabled', async () => {
    electron.net.request = jest.fn(url => {
      const req = new EventEmitter();
      req.end = function () {
      };
      return req;
    });

    const analytics = new GoogleAnalytics(
      'trackingId',
      'clientId',
      'https://tests.insomnia.rest',
      true
    );

    expect(electron.net.request.mock.calls).toEqual([]);
    analytics.trackEvent(true, 'foo', 'bar', 'baz');
    expect(electron.net.request.mock.calls).toEqual([]);
  });
});
