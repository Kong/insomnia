import * as analytics from '../index';
import {GA_HOST} from '../../common/constants';

global.document = {
  getElementsByTagName () {
    return {
      parentNode: {
        insertBefore() {

        }
      }
    }
  }
};

describe('init()', () => {
  it('correctly initializes', async () => {
    window.localStorage = {};

    analytics.trackEvent('premature', 'event');
    analytics.setAccountId('acct_premature');

    window.ga = jest.genMockFunction();
    analytics.initAnalytics('acct_123');

    // Verify that Google Analytics works
    expect(window.ga.mock.calls.length).toBe(5);
    expect(window.ga.mock.calls[0]).toEqual(['create', 'UA-86416787-1', {
      clientId: 'dd2ccc1a-2745-477a-881a-9e8ef9d42403',
      storage: 'none'
    }]);
    expect(window.ga.mock.calls[1].slice(0, 2)).toEqual(['set', 'checkProtocolTask']);
    expect(window.ga.mock.calls[1][2]()).toBeNull();
    expect(window.ga.mock.calls[2]).toEqual(['set', 'location', `https://${GA_HOST}/`]);
    expect(window.ga.mock.calls[3]).toEqual(['send', 'pageview']);
    expect(window.ga.mock.calls[4]).toEqual(['set', 'userId', 'acct_123']);

    analytics.trackEvent('foo', 'bar', 'baz');
    expect(window.ga.mock.calls.length).toBe(6);
    expect(window.ga.mock.calls[5]).toEqual(['send', 'event', 'foo', 'bar', 'baz']);

    analytics.setAccountId('acct_456');
    expect(window.ga.mock.calls.length).toBe(7);
    expect(window.ga.mock.calls[6]).toEqual(['set', 'userId', 'acct_456']);

    // Try reinitializing
    analytics.initAnalytics();
    expect(window.ga.mock.calls.length).toBe(7);

    // TODO: Verify that Segment works (although it's not that important)
  });
});
