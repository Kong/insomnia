const render = jest.requireActual('../render');

render.getRenderedGrpcRequest = jest.fn();
render.getRenderedGrpcRequestMessage = jest.fn();

module.exports = render;
