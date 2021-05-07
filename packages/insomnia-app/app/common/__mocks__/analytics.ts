// WARNING: changing this to `export default` will break the mock and be incredibly hard to debug. Ask me how I know.
const trackEvent = jest.fn();
const trackSegmentEvent = jest.fn();
module.exports = { trackEvent, trackSegmentEvent };
