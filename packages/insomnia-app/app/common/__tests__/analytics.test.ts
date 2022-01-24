import { globalBeforeEach } from '../../__jest__/before-each';
import * as models from '../../models/index';
import * as axiosModule from '../../network/axios-request';
import { _trackEvent, _trackPageView } from '../analytics';
import {
  getAppId,
  getAppName,
  getAppPlatform,
  getAppVersion,
  getBrowserUserAgent,
  getGoogleAnalyticsId,
  getGoogleAnalyticsLocation,
} from '../constants';

const axiosRequest = jest.spyOn(axiosModule, 'axiosRequest');
describe('init()', () => {
  beforeEach(async () => {
    await globalBeforeEach();
    axiosRequest.mockResolvedValue({ data:{}, headers:{} });
    jest.useFakeTimers();
  });

  it('does not work with tracking disabled', async () => {
    const settings = await models.settings.patch({
      enableAnalytics: false,
      deviceId: 'device',
    });
    expect(settings.enableAnalytics).toBe(false);
    expect(axiosRequest.mock.calls).toEqual([]);
    await _trackEvent({ interactive: true, category: 'Foo', action: 'Bar' });
    jest.runAllTimers();
    expect(axiosRequest.mock.calls).toEqual([]);
  });

  it('works with tracking enabled', async () => {
    const settings = await models.settings.patch({
      enableAnalytics: true,
      deviceId: 'device',
    });
    expect(settings.enableAnalytics).toBe(true);
    expect(axiosRequest.mock.calls).toEqual([]);
    await _trackEvent({ interactive: true, category: 'Foo', action: 'Bar' });
    jest.runAllTimers();
    expect(axiosRequest.mock.calls).toEqual([
      [{ url:
        'https://www.google-analytics.com/collect?' +
        'v=1&' +
        `tid=${getGoogleAnalyticsId()}&` +
        'cid=device&' +
        `ua=${getBrowserUserAgent()}&` +
        `dl=${encodeURIComponent(getGoogleAnalyticsLocation())}%2F&` +
        'sr=1920x1080&' +
        'ul=en-US&' +
        `dt=${getAppId()}%3A${getAppVersion()}&` +
        `cd1=${getAppPlatform()}&` +
        `cd2=${getAppVersion()}&` +
        'aip=1&' +
        `an=${encodeURI(getAppName())}&` +
        `aid=${getAppId()}&` +
        `av=${getAppVersion()}&` +
        'vp=1900x1060&' +
        'de=UTF-8&' +
        't=event&' +
        'ec=Foo&' +
        'ea=Bar',
      }],
    ]);
  });

  it('tracks non-interactive event', async () => {
    await models.settings.patch({
      deviceId: 'device',
      enableAnalytics: true,
    });
    await _trackEvent({ interactive: false, category: 'Foo', action: 'Bar' });
    jest.runAllTimers();
    expect(axiosRequest.mock.calls).toEqual([
      [{ url:
        'https://www.google-analytics.com/collect?' +
        'v=1&' +
        `tid=${getGoogleAnalyticsId()}&` +
        'cid=device&' +
        `ua=${getBrowserUserAgent()}&` +
        `dl=${encodeURIComponent(getGoogleAnalyticsLocation())}%2F&` +
        'sr=1920x1080&' +
        'ul=en-US&' +
        `dt=${getAppId()}%3A${getAppVersion()}&` +
        `cd1=${getAppPlatform()}&` +
        `cd2=${getAppVersion()}&` +
        'aip=1&' +
        `an=${encodeURI(getAppName())}&` +
        `aid=${getAppId()}&` +
        `av=${getAppVersion()}&` +
        'vp=1900x1060&' +
        'de=UTF-8&' +
        't=event&' +
        'ec=Foo&' +
        'ea=Bar&' +
        'ni=1',
      }],
    ]);
  });

  it('tracks page view', async () => {
    await models.settings.patch({
      deviceId: 'device',
      enableAnalytics: true,
    });
    await _trackPageView('/my/path');
    jest.runAllTimers();
    expect(axiosRequest.mock.calls).toEqual([
      [{ url:
        'https://www.google-analytics.com/collect?' +
        'v=1&' +
        `tid=${getGoogleAnalyticsId()}&` +
        'cid=device&' +
        `ua=${getBrowserUserAgent()}&` +
        `dl=${encodeURIComponent(getGoogleAnalyticsLocation())}%2Fmy%2Fpath&` +
        'sr=1920x1080&' +
        'ul=en-US&' +
        `dt=${getAppId()}%3A${getAppVersion()}&` +
        `cd1=${getAppPlatform()}&` +
        `cd2=${getAppVersion()}&` +
        'aip=1&' +
        `an=${encodeURI(getAppName())}&` +
        `aid=${getAppId()}&` +
        `av=${getAppVersion()}&` +
        'vp=1900x1060&' +
        'de=UTF-8&' +
        't=pageview',
      }],
    ]);
  });

  it('tracking page view remembers path', async () => {
    await models.settings.patch({
      deviceId: 'device',
      enableAnalytics: true,
    });
    await _trackPageView('/my/path');
    jest.runAllTimers();
    await _trackEvent({
      interactive: true,
      category: 'cat',
      action: 'act',
      label: 'lab',
      value: 'val',
    });
    expect(axiosRequest.mock.calls).toEqual([
      [
        'https://www.google-analytics.com/collect?' +
        'v=1&' +
        `tid=${getGoogleAnalyticsId()}&` +
        'cid=device&' +
        `ua=${getBrowserUserAgent()}&` +
        `dl=${encodeURIComponent(getGoogleAnalyticsLocation())}%2Fmy%2Fpath&` +
        'sr=1920x1080&' +
        'ul=en-US&' +
        `dt=${getAppId()}%3A${getAppVersion()}&` +
        `cd1=${getAppPlatform()}&` +
        `cd2=${getAppVersion()}&` +
        'aip=1&' +
        `an=${encodeURI(getAppName())}&` +
        `aid=${getAppId()}&` +
        `av=${getAppVersion()}&` +
        'vp=1900x1060&' +
        'de=UTF-8&' +
        't=pageview',
      }],
      [{ url:
        'https://www.google-analytics.com/collect?' +
        'v=1&' +
        `tid=${getGoogleAnalyticsId()}&` +
        'cid=device&' +
        `ua=${getBrowserUserAgent()}&` +
        `dl=${encodeURIComponent(getGoogleAnalyticsLocation())}%2Fmy%2Fpath&` +
        'sr=1920x1080&' +
        'ul=en-US&' +
        `dt=${getAppId()}%3A${getAppVersion()}&` +
        `cd1=${getAppPlatform()}&` +
        `cd2=${getAppVersion()}&` +
        'aip=1&' +
        `an=${encodeURI(getAppName())}&` +
        `aid=${getAppId()}&` +
        `av=${getAppVersion()}&` +
        'vp=1900x1060&' +
        'de=UTF-8&' +
        't=event&' +
        'ec=cat&' +
        'ea=act&' +
        'el=lab&' +
        'ev=val',
      }],
    ]);
  });
});
