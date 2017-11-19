import * as electron from 'electron';
import {EventEmitter} from 'events';
import {globalBeforeEach} from '../../__jest__/before-each';
import * as models from '../../models/index';
import {_trackEvent} from '../analytics';
import {getAppPlatform, getAppVersion} from '../constants';

describe('init()', () => {
  beforeEach(async () => {
    await globalBeforeEach();
    electron.net.request = jest.fn(url => {
      const req = new EventEmitter();
      req.end = function () {
      };
      return req;
    });
    jest.useFakeTimers();
  });

  it('does not work with tracking disabled', async () => {
    const settings = await models.settings.getOrCreate({
      disableAnalyticsTracking: true,
      deviceId: 'device'
    });
    expect(settings.disableAnalyticsTracking).toBe(true);
    expect(electron.net.request.mock.calls).toEqual([]);

    await _trackEvent(true, 'Foo', 'Bar');
    jest.runAllTimers();
    expect(electron.net.request.mock.calls).toEqual([]);
  });

  it('works with tracking enabled', async () => {
    const settings = await models.settings.getOrCreate({
      disableAnalyticsTracking: false,
      deviceId: 'device'
    });
    expect(settings.disableAnalyticsTracking).toBe(false);
    expect(electron.net.request.mock.calls).toEqual([]);

    await _trackEvent(true, 'Foo', 'Bar');
    jest.runAllTimers();
    expect(electron.net.request.mock.calls).toEqual([
      [
        'https://www.google-analytics.com/collect?' +
        'v=1&' +
        'tid=UA-86416787-1&' +
        'cid=device&' +
        'dl=https%3A%2F%2Fdesktop.insomnia.rest%2F&' +
        'sr=1920x1080&' +
        'ul=en-US&' +
        `dt=Insomnia%20${getAppVersion()}&` +
        `cd1=${getAppPlatform()}&` +
        `cd2=${getAppVersion()}&` +
        'vp=1900x1060&' +
        'de=UTF-8&' +
        't=event&' +
        'ec=Foo&' +
        'ea=Bar'
      ]
    ]);
  });

  it('tracks non-interactive event', async () => {
    await models.settings.getOrCreate({deviceId: 'device'});

    await _trackEvent(false, 'Foo', 'Bar');
    jest.runAllTimers();
    expect(electron.net.request.mock.calls).toEqual([
      [
        'https://www.google-analytics.com/collect?' +
        'v=1&' +
        'tid=UA-86416787-1&' +
        'cid=device&' +
        'dl=https%3A%2F%2Fdesktop.insomnia.rest%2F&' +
        'sr=1920x1080&' +
        'ul=en-US&' +
        `dt=Insomnia%20${getAppVersion()}&` +
        `cd1=${getAppPlatform()}&` +
        `cd2=${getAppVersion()}&` +
        'vp=1900x1060&' +
        'de=UTF-8&' +
        't=event&' +
        'ec=Foo&' +
        'ea=Bar&' +
        'ni=1'
      ]
    ]);
  });

  it('tracks page view', async () => {
    await models.settings.getOrCreate({deviceId: 'device'});

    await _trackEvent(false, 'Foo', 'Bar');
    jest.runAllTimers();
    expect(electron.net.request.mock.calls).toEqual([
      [
        'https://www.google-analytics.com/collect?' +
        'v=1&' +
        'tid=UA-86416787-1&' +
        'cid=device&' +
        'dl=https%3A%2F%2Fdesktop.insomnia.rest%2F&' +
        'sr=1920x1080&' +
        'ul=en-US&' +
        `dt=Insomnia%20${getAppVersion()}&` +
        `cd1=${getAppPlatform()}&` +
        `cd2=${getAppVersion()}&` +
        'vp=1900x1060&' +
        'de=UTF-8&' +
        't=event&' +
        'ec=Foo&' +
        'ea=Bar&' +
        'ni=1'
      ]
    ]);
  });
});
