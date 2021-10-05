// WARNING: changing this to `export default` will break the mock and be incredibly hard to debug. Ask me how I know.
const _analytics = jest.requireActual('../analytics');
_analytics.trackEvent = jest.fn();
_analytics.trackSegmentEvent = jest.fn();
module.exports = _analytics;
