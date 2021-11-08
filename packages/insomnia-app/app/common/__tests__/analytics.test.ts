import { globalBeforeEach } from '../../__jest__/before-each';
import * as models from '../../models/index';
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

describe('init()', () => {
  beforeEach(async () => {
    await globalBeforeEach();
    window.main = {
      analytics: { viewportSize: '1900x1060', screenResolution: '1920x1080', locale: 'en-US' },
    };
    window.net = {};

    window.net.request = jest.fn(() => {
      return { headers: {} };
    });
    jest.useFakeTimers();
  });

  it('does not work with tracking disabled', async () => {
    const settings = await models.settings.patch({
      enableAnalytics: false,
      deviceId: 'device',
    });
    expect(settings.enableAnalytics).toBe(false);
    expect(window.net.request).toHaveBeenCalledTimes(0);
    await _trackEvent(true, 'Foo', 'Bar');
    jest.runAllTimers();
    expect(window.net.request).toHaveBeenCalledTimes(0);
  });

  it('works with tracking enabled', async () => {
    const settings = await models.settings.patch({
      enableAnalytics: true,
      deviceId: 'device',
    });
    expect(settings.enableAnalytics).toBe(true);
    expect(window.net.request).toHaveBeenCalledTimes(0);
    await _trackEvent(true, 'Foo', 'Bar');
    jest.runAllTimers();
    expect(window.net.request).toHaveBeenCalledWith(
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
    );
  });

  it('tracks non-interactive event', async () => {
    await models.settings.patch({
      deviceId: 'device',
      enableAnalytics: true,
    });
    await _trackEvent(false, 'Foo', 'Bar');
    jest.runAllTimers();
    expect(window.net.request).toHaveBeenCalledWith(
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
          'ni=1'
    );
  });

  it('tracks page view', async () => {
    await models.settings.patch({
      deviceId: 'device',
      enableAnalytics: true,
    });
    await _trackPageView('/my/path');
    jest.runAllTimers();
    expect(window.net.request).toHaveBeenCalledWith(
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
    );
  });

  it('tracking page view remembers path', async () => {
    await models.settings.patch({
      deviceId: 'device',
      enableAnalytics: true,
    });
    await _trackPageView('/my/path');
    jest.runAllTimers();
    await _trackEvent(true, 'cat', 'act', 'lab', 'val');
    expect(window.net.request).toHaveBeenNthCalledWith(1,
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
          't=pageview');
    expect(window.net.request).toHaveBeenNthCalledWith(2,
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
          'ev=val');
  });
});
