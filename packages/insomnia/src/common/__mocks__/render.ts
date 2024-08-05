import { vi } from 'vitest';

import * as renderOriginal from '../render';

const _render = vi.requireActual('../render') as typeof renderOriginal;
_render.getRenderedGrpcRequest = vi.fn();
_render.getRenderedGrpcRequestMessage = vi.fn();

// WARNING: changing this to `export default` will break the mock and be incredibly hard to debug. Ask me how I know.
module.exports = _render;
