const render = jest.requireActual('../render');

render.getRenderedGrpcRequestAndContext = jest.fn();

module.exports = render;
