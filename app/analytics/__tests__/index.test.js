import * as analytics from '../index';
import {GA_HOST, getAppVersion, getAppPlatform} from '../../common/constants';
import * as db from '../../common/database';
import * as models from '../../models';

describe('init()', () => {
  beforeEach(() => {
    window.localStorage = {};
    global.document = {
      getElementsByTagName () {
        return {
          parentNode: {
            insertBefore () {
            }
          }
        };
      }
    };
    return db.init(models.types(), {inMemoryOnly: true}, true);
  });

  afterEach(() => {
    // Remove any trace of GA
    global.document = undefined;
    global.window.ga = undefined;
  });

  it('correctly initializes', async () => {
    jest.useFakeTimers();

    analytics.trackEvent('premature', 'event');
    analytics.setAccountId('acct_premature');
    jest.runAllTicks();

    window.ga = jest.genMockFunction();
    await analytics.init('acct_123');
    jest.runAllTicks();

    // Make sure we have it enabled
    const settings = await models.settings.getOrCreate();
    expect(settings.disableAnalyticsTracking).toBe(false);

    // Verify that Google Analytics works
    expect(window.ga.mock.calls.length).toBe(7);
    expect(window.ga.mock.calls[0][0]).toBe('create');
    expect(window.ga.mock.calls[0][1]).toBe('UA-86416787-1');
    expect(window.ga.mock.calls[0][2].storage).toBe('none');
    expect(window.ga.mock.calls[0][2].clientId.length).toBe(36);
    expect(window.ga.mock.calls[0].length).toBe(3);
    expect(window.ga.mock.calls[1].slice(0, 2)).toEqual(['set', 'checkProtocolTask']);
    expect(window.ga.mock.calls[1][2]()).toBeNull();
    expect(window.ga.mock.calls[2]).toEqual(['set', 'location', `https://${GA_HOST}/`]);
    expect(window.ga.mock.calls[3]).toEqual(['set', 'userId', 'acct_123']);
    expect(window.ga.mock.calls[4]).toEqual(['set', 'dimension1', getAppPlatform()]);
    expect(window.ga.mock.calls[5]).toEqual(['set', 'dimension2', getAppVersion()]);
    expect(window.ga.mock.calls[6]).toEqual(['send', 'pageview']);

    analytics.trackEvent('foo', 'bar', 'baz');
    jest.runAllTicks();
    expect(window.ga.mock.calls.length).toBe(8);
    expect(window.ga.mock.calls[7]).toEqual(['send', 'event', 'foo', 'bar', 'baz']);

    analytics.setAccountId('acct_456');
    jest.runAllTicks();
    expect(window.ga.mock.calls.length).toBe(9);
    expect(window.ga.mock.calls[8]).toEqual(['set', 'userId', 'acct_456']);

    // Try reinitializing
    analytics.init();
    jest.runAllTicks();
    expect(window.ga.mock.calls.length).toBe(9);
  });

  it('Does not work with click tracking disabled', async () => {
    jest.useFakeTimers();

    // Make sure we have it disabled
    const settings = await models.settings.getOrCreate({disableAnalyticsTracking: true});
    expect(settings.disableAnalyticsTracking).toBe(true);

    await analytics.init('acct_123');
    jest.runAllTicks();
    expect(window.ga).toBeUndefined();

    analytics.trackEvent('foo', 'bar', 'baz');
    jest.runAllTicks();
    expect(window.ga).toBeUndefined();
  });
});
