import { vi } from 'vitest';

import * as analyticsOriginal from '../analytics';

// WARNING: changing this to `export default` will break the mock and be incredibly hard to debug. Ask me how I know.
const _analytics = vi.requireActual('../analytics') as typeof analyticsOriginal;
_analytics.trackSegmentEvent = vi.fn();
module.exports = _analytics;
