import { jest } from '@jest/globals';

import * as analyticsOriginal from '../analytics';

// WARNING: changing this to `export default` will break the mock and be incredibly hard to debug. Ask me how I know.
const _analytics = jest.requireActual('../analytics') as typeof analyticsOriginal;
_analytics.trackSegmentEvent = jest.fn();
module.exports = _analytics;
