const _render = jest.requireActual('../render');
_render.getRenderedGrpcRequest = jest.fn();
_render.getRenderedGrpcRequestMessage = jest.fn();

// WARNING: changing this to `export default` will break the mock and be incredibly hard to debug. Ask me how I know.
module.exports = _render;
