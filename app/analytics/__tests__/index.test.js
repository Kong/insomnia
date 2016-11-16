import * as analytics from '../index';
import {GA_HOST} from '../../common/constants';
import * as db from '../../common/database';
import * as models from '../../models';

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
  beforeEach(() => {
    return db.init(models.types(), {inMemoryOnly: true}, true);
  });

  it('correctly initializes', async () => {
    window.localStorage = {};

    analytics.trackEvent('premature', 'event');
    analytics.setAccountId('acct_premature');

    window.ga = jest.genMockFunction();
    await analytics.init('acct_123');

    // Verify that Google Analytics works
    expect(window.ga.mock.calls.length).toBe(5);
    expect(window.ga.mock.calls[0][0]).toBe('create');
    expect(window.ga.mock.calls[0][1]).toBe('UA-86416787-1');
    expect(window.ga.mock.calls[0][2].storage).toBe('none');
    expect(window.ga.mock.calls[0][2].clientId.length).toBe(36);
    expect(window.ga.mock.calls[0].length).toBe(3);
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
    analytics.init();
    expect(window.ga.mock.calls.length).toBe(7);

    // TODO: Verify that Segment works (although it's not that important)
  });
});
